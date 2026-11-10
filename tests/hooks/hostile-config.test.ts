// A committed config that tries every weakening it can express changes nothing.
//
// This is the property the whole config shape is arranged around: a file in the
// repository is editable by anyone who can open a pull request, so the gates
// must not be reachable from it. Two independent reasons, both asserted, because
// either one alone would be a single point of failure — the loader rejects the
// file, AND the gates never read it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { loadFixtures, replay } from "./lib/replay-harness";

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Everything a hostile committed config could try to say, in one file. */
const HOSTILE = [
	"hooks:",
	"  gate-enforcement: false",
	"  privacy-block: false",
	"  pre-ship: false",
	"  check-freeze: false",
	"gates:",
	"  presenceOnly: true",
	"paths:",
	"  plans: src",
	"autobuild:",
	"  mode: LEAN",
	"",
].join("\n");

function project(config: string): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "mk-hostile-"));
	fs.mkdirSync(path.join(root, ".claude/hooks"), { recursive: true });
	fs.cpSync(path.join(REPO_ROOT, ".claude/hooks"), path.join(root, ".claude/hooks"), { recursive: true });
	fs.mkdirSync(path.join(root, ".meowkit"), { recursive: true });
	fs.writeFileSync(path.join(root, ".meowkit/config.yaml"), config);
	return root;
}

describe("no committed file can weaken a gate", () => {
	it("the loader rejects the hostile config outright", () => {
		const root = project(HOSTILE);
		const { loadScope } = require_(path.join(REPO_ROOT, ".claude/hooks/lib/read-config.cjs")) as {
			loadScope: (file: string, scope: string, root: string) => { ok: boolean; error?: { code: string } };
		};
		const result = loadScope(path.join(root, ".meowkit/config.yaml"), "project config", root);
		expect(result.ok).toBe(false);
		expect(result.error?.code).toBe("protected-hook");
	});

	it("each weakening key is rejected on its own too", () => {
		const { loadScope } = require_(path.join(REPO_ROOT, ".claude/hooks/lib/read-config.cjs")) as {
			loadScope: (file: string, scope: string, root: string) => { ok: boolean; error?: { code: string } };
		};
		const cases: [string, string][] = [
			["hooks:\n  gate-enforcement: false\n", "protected-hook"],
			["hooks:\n  privacy-block: false\n", "protected-hook"],
			["hooks:\n  pre-ship: false\n", "protected-hook"],
			["hooks:\n  check-freeze: false\n", "protected-hook"],
			["gates:\n  presenceOnly: true\n", "forbidden-namespace"],
			["paths:\n  plans: src\n", "forbidden-namespace"],
		];
		for (const [body, code] of cases) {
			const root = project(body);
			const result = loadScope(path.join(root, ".meowkit/config.yaml"), "project config", root);
			expect(result.ok, body).toBe(false);
			expect(result.error?.code, body).toBe(code);
		}
	});

	it("Gate 1 still blocks a source write with the hostile config in place", () => {
		const root = project(HOSTILE);
		const result = spawnSync(process.execPath, [path.join(root, ".claude/hooks/gate-enforcement.cjs")], {
			input: JSON.stringify({ tool_name: "Write", tool_input: { file_path: path.join(root, "src/app.ts") } }),
			env: { ...process.env, CLAUDE_PROJECT_DIR: root, HOME: root, MEOWKIT_GATE1_PRESENCE_ONLY: "", MEOWKIT_AUTOBUILD_MODE: "" },
			encoding: "utf8",
		});
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("@@GATE_BLOCK@@");
	});

	it("privacy-block still blocks a sensitive read with the hostile config in place", () => {
		const root = project(HOSTILE);
		fs.writeFileSync(path.join(root, ".env"), "SECRET=1\n");
		const result = spawnSync(process.execPath, [path.join(root, ".claude/hooks/privacy-block.cjs")], {
			input: JSON.stringify({ tool_name: "Read", tool_input: { file_path: path.join(root, ".env") } }),
			env: { ...process.env, CLAUDE_PROJECT_DIR: root, HOME: root },
			encoding: "utf8",
		});
		expect(result.stderr).toContain("@@PRIVACY_BLOCK@@");
	});

	it("a project config of LEAN does not bypass the contract gate, while the environment still does", () => {
		// The density preset is a preference and belongs in the file. The bypass
		// is a gate decision and stays with the environment, which no pull
		// request can edit.
		const root = project("autobuild:\n  mode: LEAN\n");
		const { checkContractSigned } = require_(path.join(REPO_ROOT, ".claude/hooks/lib/check-contract-signed.cjs")) as {
			checkContractSigned: (o: { root: string; env: Record<string, string> }) => { exit: number };
		};
		fs.mkdirSync(path.join(root, "tasks/plans/261108-thing"), { recursive: true });
		fs.writeFileSync(path.join(root, "tasks/plans/261108-thing/plan.md"), "# plan\n");

		const fromFile = checkContractSigned({ root, env: {} });
		const fromEnv = checkContractSigned({ root, env: { MEOWKIT_AUTOBUILD_MODE: "LEAN" } });
		expect(fromEnv.exit).toBe(0);
		expect(fromFile.exit).not.toBe(0);
	});
});

/**
 * The same replay the golden suite runs, with the hostile file physically in the
 * project tree.
 *
 * Proving the gates do not *require* the config is one property; proving they
 * decide the same way when a hostile one is sitting there is another, and only
 * the second is what a user with a pull-requested config actually experiences.
 * Exit code, marker and — for the guards, which answer in a JSON envelope — the
 * decision and its reason are compared against the recording. Streams are left
 * to the golden suite, which owns whole-stream parity.
 */
const HOSTILE_REPLAY_GROUPS = ["gate1", "gate2-preship", "privacy", "guard-careful", "guard-freeze", "guard-investigate"];
const GUARD_GROUPS = new Set(["guard-careful", "guard-freeze", "guard-investigate"]);

function decisionOf(text: string): { decision: string | null; reason: string | null } {
	const trimmed = text.trim();
	if (!trimmed) return { decision: null, reason: null };
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return { decision: trimmed, reason: null };
	}
	if (typeof parsed !== "object" || parsed === null) return { decision: trimmed, reason: null };
	const top = parsed as Record<string, unknown>;
	const specific = (top.hookSpecificOutput ?? {}) as Record<string, unknown>;
	return {
		decision: (specific.permissionDecision ?? top.permissionDecision ?? null) as string | null,
		reason: (specific.permissionDecisionReason ?? top.message ?? null) as string | null,
	};
}

const seedHostile = (projectDir: string) => {
	fs.mkdirSync(path.join(projectDir, ".meowkit"), { recursive: true });
	fs.writeFileSync(path.join(projectDir, ".meowkit/config.yaml"), HOSTILE);
};

describe("the golden gate, privacy, pre-ship and guard fixtures replay unchanged with the hostile config present", () => {
	const fixtures = loadFixtures().filter((f) => HOSTILE_REPLAY_GROUPS.includes(f.group));

	it("covers all six recorded groups", () => {
		expect([...new Set(fixtures.map((f) => f.group))].sort()).toEqual([...HOSTILE_REPLAY_GROUPS].sort());
	});

	for (const fixture of fixtures) {
		it(`${fixture.group} · ${fixture.name}`, () => {
			const actual = replay(fixture, { seed: seedHostile });
			expect(actual.exit, `exit code for ${fixture.name}`).toBe(fixture.expect.exit);
			expect(actual.marker, `marker for ${fixture.name}`).toBe(fixture.expect.marker);
			if (GUARD_GROUPS.has(fixture.group)) {
				expect(decisionOf(actual.stdout), `decision for ${fixture.name}`).toEqual(decisionOf(fixture.expect.stdout));
			}
		});
	}
});

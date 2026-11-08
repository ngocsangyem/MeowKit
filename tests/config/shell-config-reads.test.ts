// The shell scripts take their cost thresholds from the committed config.
//
// They used to read them from the environment, and the sprint that moved the
// thresholds into `.meowkit/config.yaml` left those reads in place: the kit then
// told a user to unset the variables while two shipped scripts were the only
// things still reading them, so following the advice silently removed a cost
// brake. A shell cannot parse YAML, so it asks the hook-side reader — and what
// has to be asserted is the end-to-end behaviour, not the presence of the call.
//
// Both scripts are cost brakes, so the fallback direction is asserted too: with
// no config at all they keep their documented defaults rather than failing shut.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const TRACKER = join(REPO_ROOT, ".claude/skills/autobuild/scripts/budget-tracker.sh");
const CANARY = join(REPO_ROOT, ".claude/skills/benchmark/scripts/run-canary.sh");

/** A throwaway project, optionally carrying a config and a spend of `usd`. */
function scratch(config: string | null, usd?: number): string {
	const dir = mkdtempSync(join(tmpdir(), "mewkit-shell-"));
	mkdirSync(join(dir, ".meowkit", "telemetry"), { recursive: true });
	// The observer names come from the project's own registry; without one every
	// `hooks.<name>` key would read as unknown and reject the whole file.
	mkdirSync(join(dir, ".claude", "hooks"), { recursive: true });
	execFileSync("cp", [join(REPO_ROOT, ".claude/hooks/handlers.json"), join(dir, ".claude/hooks/handlers.json")]);
	if (config !== null) writeFileSync(join(dir, ".meowkit", "config.yaml"), config, "utf8");
	if (usd !== undefined) {
		writeFileSync(
			join(dir, ".meowkit", "telemetry", "cost-log.json"),
			`{"run_id": "current", "step": "s", "usd": ${usd}, "ts": "t"}\n`,
			"utf8",
		);
	}
	return dir;
}

/** Run one of the scripts inside `dir`, with no inherited environment to lean on. */
function run(script: string, args: string[], dir: string): { status: number; out: string } {
	const result = spawnSync("bash", [script, ...args], {
		cwd: dir,
		encoding: "utf8",
		env: { PATH: process.env.PATH ?? "", HOME: join(dir, "no-home") },
	});
	return { status: result.status ?? -1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

describe("the budget tracker resolves its thresholds from the config", () => {
	it("blocks on a user cap the config sets", () => {
		const dir = scratch("budget:\n  cap: 20\n", 25);
		const { status, out } = run(TRACKER, ["check"], dir);
		expect(out).toContain("exceeds user cap $20");
		expect(status).toBe(3);
	});

	it("blocks on a hard block the config lowers", () => {
		const dir = scratch("budget:\n  block: 10\n", 25);
		const { status, out } = run(TRACKER, ["check"], dir);
		expect(out).toContain("exceeds hard block $10");
		expect(status).toBe(2);
	});

	it("warns on a warn threshold the config lowers", () => {
		const dir = scratch("budget:\n  warn: 5\n", 7);
		const { status, out } = run(TRACKER, ["check"], dir);
		expect(out).toContain("exceeds warn threshold $5");
		expect(status).toBe(1);
	});

	it("keeps its documented defaults when there is no config", () => {
		const dir = scratch(null, 25);
		const { status, out } = run(TRACKER, ["check"], dir);
		expect(out).toContain("OK: $25.00");
		expect(status).toBe(0);
	});

	it("keeps them when the config cannot be parsed, rather than failing shut", () => {
		const dir = scratch("budget:\n\tcap: 1\n", 25);
		const { status } = run(TRACKER, ["check"], dir);
		expect(status).toBe(0);
	});
});

describe("the canary cap comes from the config", () => {
	it("prefers the configured cap over the one passed in", () => {
		const dir = scratch("budget:\n  cap: 20\n");
		writeFileSync(join(dir, "ledger.jsonl"), '{"costUsd": 21}\n', "utf8");
		const { status, out } = run(CANARY, ["check-cap", "ledger.jsonl", "100"], dir);
		expect(out).toContain("$20.00");
		expect(status).toBe(2);
	});

	it("falls back to the cap passed in when the config sets none", () => {
		const dir = scratch("budget:\n  cap: 0\n");
		writeFileSync(join(dir, "ledger.jsonl"), '{"costUsd": 21}\n', "utf8");
		const { status } = run(CANARY, ["check-cap", "ledger.jsonl", "100"], dir);
		expect(status).toBe(0);
	});
});

// The release workflows carry the artifact step, it cannot fail quietly, and
// the ship set has exactly one source that both archives read.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The kit's version source, so the fallback and the build script's rejection are
// checked against the same rule rather than against two copies of it.
import { KIT_VERSION_PATTERN } from "../../../../../scripts/kit-version.cjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..", "..");

const WORKFLOWS = [
	join(REPO, ".github", "workflows", "release.yml"),
	join(REPO, ".github", "workflows", "release-beta.yml"),
];

/** The lines of one named step, up to the next step at the same indent. */
function stepBlock(yaml: string, stepName: string): string {
	const lines = yaml.split("\n");
	const start = lines.findIndex((line) => line.includes(`- name: ${stepName}`));
	expect(start).toBeGreaterThan(-1);
	const indent = lines[start].indexOf("-");
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((line) => line.trimEnd() !== "" && line.indexOf("-") === indent && line.trim().startsWith("- "));
	// Comment lines are dropped: the step's own prose names the forms it must not
	// carry, and a check that matched prose would be satisfied by deleting a
	// comment rather than by the step being strict.
	return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))]
		.filter((line) => !line.trim().startsWith("#"))
		.join("\n");
}

describe("release wiring", () => {
	it("adds the artifact step to both workflows without changing their triggers", () => {
		for (const file of WORKFLOWS) {
			const yaml = readFileSync(file, "utf8");
			expect(yaml).toMatch(/node scripts\/build-kit-artifact\.cjs/);
			expect(yaml).toMatch(/MEOWKIT_KIT_SIGNING_KEY: \$\{\{ secrets\.MEOWKIT_KIT_SIGNING_KEY \}\}/);
		}
		// Triggers unchanged: a dispatch for stable, a dispatch plus a push to the
		// release branch for beta. So a failing artifact step can block a publish
		// and never a merge.
		const stable = readFileSync(WORKFLOWS[0], "utf8");
		expect(stable).toMatch(/^on:\n {2}workflow_dispatch:$/m);
		const beta = readFileSync(WORKFLOWS[1], "utf8");
		expect(beta).toMatch(/^on:\n {2}push:\n {4}branches: \[dev\]\n {2}workflow_dispatch:$/m);
	});

	it("gives the artifact step no way to fail quietly", () => {
		// The build script's non-zero exit only matters if the job honors it. Each of
		// these five forms would turn the failure into a warning, and the step must
		// carry none of them — nor sit inside a shell that supplies one.
		for (const file of WORKFLOWS) {
			const block = stepBlock(readFileSync(file, "utf8"), "Build signed kit artifact");
			for (const escape of [/continue-on-error/, /\|\| true/, /if: always\(\)/, /if: failure\(\)/, /set \+e/]) {
				expect(block).not.toMatch(escape);
			}
			// No `if:` at all, so the step is not conditional on anything.
			expect(block).not.toMatch(/^\s+if:/m);
		}
	});

	it("gives the ship set one source, read by both archive builders", () => {
		const shared = readFileSync(join(REPO, "scripts", "kit-ship-set.cjs"), "utf8");
		expect(shared).toMatch(/base\.exclude/);
		for (const builder of ["prepare-release-assets.cjs", "build-kit-artifact.cjs"]) {
			const source = readFileSync(join(REPO, "scripts", builder), "utf8");
			expect(source).toMatch(/require\("\.\/kit-ship-set\.cjs"\)/);
			// No second list: neither builder spells out its own exclusions.
			expect(source).not.toMatch(/"-x",\s*"/);
		}
	});

	it("keeps every exclusion pattern the zip build carried, and adds the ship-set ones", () => {
		const manifest = JSON.parse(readFileSync(join(REPO, ".meowkit", "pack-manifest.json"), "utf8")) as {
			base: { exclude: string[] };
		};
		const carriedOver = [
			".claude/session-state/*",
			".claude/memory/*",
			".claude/logs/*",
			".claude/skills/.venv/*",
			".claude/worktrees/*",
			".claude/metadata.json",
			".claude/.env",
			".meowkit/.env",
			".meowkit/memory/*",
			".meowkit/cache/*",
			".meowkit/telemetry/*",
			".meowkit/metadata.json",
			"tasks/reports/*",
			"tasks/reviews/*.md",
			"tasks/reviews/evidence/*",
			"*.pyc",
			"__pycache__/*",
		];
		expect(carriedOver).toHaveLength(17);
		for (const pattern of carriedOver) expect(manifest.base.exclude).toContain(pattern);
	});
});

// Asserting that the step exists, references the secret and cannot fail quietly
// leaves the one thing that actually decides whether it can succeed unchecked:
// the value it passes as the version. A step can satisfy every assertion above
// and fail on every real run, which is exactly what a `github.ref_name` fallback
// did — a branch name is not a version, and the fail-closed property then made
// the failure total, blocking the publish that follows it.
//
// So every value the expression can produce is resolved and fed to the build
// script's OWN validator, rather than compared against a substring.
describe("the version the artifact step passes", () => {
	/** The `KIT_VERSION:` expression operands, in `a || b` order. */
	function versionOperands(yaml: string): string[] {
		const line = stepBlock(yaml, "Build signed kit artifact")
			.split("\n")
			.find((candidate) => candidate.trim().startsWith("KIT_VERSION:"));
		expect(line).toBeDefined();
		const expression = /\$\{\{(.+?)\}\}/.exec(line ?? "")?.[1];
		expect(expression).toBeDefined();
		return (expression ?? "").split("||").map((operand) => operand.trim());
	}

	it("names no ref expression, because a branch name is not a version", () => {
		for (const file of WORKFLOWS) {
			for (const operand of versionOperands(readFileSync(file, "utf8"))) {
				expect(operand).not.toMatch(/ref_name|ref\b|github\.sha|head_ref|base_ref/);
			}
		}
	});

	it("resolves every operand to a value the build script accepts", () => {
		for (const file of WORKFLOWS) {
			const yaml = readFileSync(file, "utf8");
			const operands = versionOperands(yaml);
			// Two operands, and each is checked for what it can actually produce.
			expect(operands).toHaveLength(2);

			// The override is a declared, optional dispatch input. Undeclared, it is
			// always empty and the fallback is the only value that ever reaches the
			// script — which is how the ref-name fallback became unconditional.
			expect(operands[0]).toBe("inputs.version");
			expect(yaml).toMatch(/^on:\n(?:.*\n)*? {2}workflow_dispatch:\n {4}inputs:\n {6}version:/m);
			expect(yaml).toMatch(/^ {8}required: false$/m);

			// The fallback is an output of a step in this same job, and its value is
			// resolved by running the committed script that produces it.
			expect(operands[1]).toBe("steps.kit-version.outputs.version");
			const producer = stepBlock(yaml, "Resolve kit version");
			expect(producer).toMatch(/id: kit-version/);
			expect(producer).toMatch(/node scripts\/kit-version\.cjs/);
			expect(producer).toMatch(/version=.*>> "\$GITHUB_OUTPUT"/);
			// A substitution inside `echo` masks the script's exit status, so the
			// value must be assigned on its own line before it is written out.
			expect(producer).toMatch(/^\s*version="\$\(node scripts\/kit-version\.cjs\)"$/m);
			expect(producer).not.toMatch(/echo "[^"\n]*\$\(/);

			const resolved = execFileSync(process.execPath, [join(REPO, "scripts", "kit-version.cjs")], {
				cwd: REPO,
				encoding: "utf8",
			}).trim();
			// The script's own validator, not a copy of its pattern.
			expect(KIT_VERSION_PATTERN.test(resolved)).toBe(true);
			// And the build script really does accept it, end to end: a usage error
			// means it got past the version guard, which is what is being proven.
			expect(buildScriptRejects(resolved)).toBe(false);
		}
	});

	it("still rejects the branch names the old fallback produced", () => {
		// A positive control: if the guard stopped biting, the assertion above would
		// pass for the wrong reason.
		for (const branch of ["main", "dev"]) {
			expect(KIT_VERSION_PATTERN.test(branch)).toBe(false);
			expect(buildScriptRejects(branch)).toBe(true);
		}
	});
});

/** Whether the real build script refuses `version` at its version guard. */
function buildScriptRejects(version: string): boolean {
	try {
		execFileSync(process.execPath, [join(REPO, "scripts", "build-kit-artifact.cjs"), version], {
			cwd: REPO,
			encoding: "utf8",
			// No signing key, so a version the guard ACCEPTS fails later, at the key.
			// That is the discriminator: the message says which guard stopped it.
			env: { ...process.env, MEOWKIT_KIT_SIGNING_KEY: "" },
			stdio: "pipe",
		});
		return false;
	} catch (error) {
		const output = String((error as { stderr?: Buffer }).stderr ?? "");
		return output.includes("Invalid version format");
	}
}

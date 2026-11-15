// Shared case vocabulary for the guard suites.
//
// `guardCase` and `expectedFail` are the only ways a suite declares a case, so
// `manifest.test.ts` can find every case by name and fail when one disappears without
// `manifest.json` being edited to say why.
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { type Fixture, type Runtime, fireEvent, makeFixture } from "./replay";

export function guardCase(id: string, fn: () => void): void {
	test(id, fn);
}

/** A known gap: the case must fail today; it turns into a guardCase in the phase that fixes it. */
export function expectedFail(id: string, fixedBy: string, fn: () => void): void {
	test.fails(`${id} [expected-fail until ${fixedBy}]`, fn);
}

/** Fire a shell command through the event each runtime uses for shell tools. */
export function fireShell(fx: Fixture, runtime: Runtime, command: string) {
	if (runtime === "cursor") {
		return fireEvent(fx, runtime, "beforeShellExecution", { hook_event_name: "beforeShellExecution", command });
	}
	return fireEvent(fx, runtime, "PreToolUse", { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } }, { toolName: "Bash" });
}

/** A fixture ready for ship cases: a git alias so `git ci` is a ship form to resolve. */
export function makeShipFixture(runtimes: Runtime[]): Fixture {
	const fx = makeFixture(runtimes);
	fx.git("config", "alias.ci", "commit");
	return fx;
}

/** Stage a source change carrying a lint error. */
export function stageLintError(fx: Fixture): void {
	fx.write("src/add.cjs", "// LINT_ERROR\nmodule.exports = (a, b) => a + b;\n");
	fx.git("add", "src/add.cjs");
}

/** Stage a source change that breaks the test related to it. */
export function stageFailingTest(fx: Fixture): void {
	fx.write("src/add.cjs", "module.exports = (a, b) => a - b;\n");
	fx.git("add", "src/add.cjs");
}

/** Switch the fixture to a test runner with no related-test mode, committed so the tree stays clean. */
export function useRunnerWithoutRelatedTests(fx: Fixture): void {
	fx.write("package.json", JSON.stringify({ name: "guards-fixture", private: true, scripts: { lint: "node scripts/lint.cjs", test: "node --test" } }, null, 2));
	fx.git("commit", "-qam", "runner without related-test mode");
}

/** Every text a ship check run emitted, across the hooks that ran. */
export function shipOutput(r: { results: { stdout: string; stderr: string }[] }): string {
	return r.results.map((x) => `${x.stdout}${x.stderr}`).join("\n");
}

/** The six ship forms the literal trigger did not see (research claim R1-4). */
export const SHIP_EVASIONS = ["git  commit -m x", "git -C . commit -m x", "git -c x=y commit -m x", "git ci -m x", "gh pr create --fill", "gh pr merge 1"];

/**
 * One privacy corpus decided identically on every runtime: the names the guard must refuse
 * (new names, traversal, case, a symlink to a credential file) and the near misses it must
 * allow. `notes-link.txt` is written as a symlink to `.env` by `writePrivacyCorpus`.
 */
export const PRIVACY_REFUSED = [".env", ".envrc", ".npmrc", "id_rsa", ".kube/config", "src/../.env", ".ENV", "notes-link.txt"];
export const PRIVACY_ALLOWED = ["secretary.ts", ".env.example", "src/add.cjs", "id_rsa.pub"];

export function writePrivacyCorpus(fx: Fixture): void {
	for (const name of [...PRIVACY_REFUSED, ...PRIVACY_ALLOWED]) {
		if (name.includes("..") || name === "notes-link.txt") continue;
		fx.write(name, "placeholder\n");
	}
	fs.symlinkSync(path.join(fx.dir, ".env"), path.join(fx.dir, "notes-link.txt"));
}

/** Names whose decision differs from the corpus expectation; empty when the runtime agrees. */
export function privacyMismatches(fx: Fixture, refused: (name: string) => boolean): string[] {
	const wrong: string[] = [];
	for (const name of PRIVACY_REFUSED) if (!refused(name)) wrong.push(`allowed ${name}`);
	for (const name of PRIVACY_ALLOWED) if (refused(name)) wrong.push(`refused ${name}`);
	return wrong;
}

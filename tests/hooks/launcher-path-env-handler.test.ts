// The SessionStart handler's half of exposing the launcher on PATH: what a session actually
// ends up with when the handler runs, as opposed to what the library does when called.
//
// Separate from the library's own properties because it is a different kind of test — it
// copies the hook tree into a scratch project and runs the handler as the dispatcher does,
// so a failure here means the wiring is wrong rather than the rule.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { envFile, project, REPO_ROOT } from "./lib/launcher-path-fixtures.js";

/** Run the handler the way the dispatcher does, in a given environment. */
function runHandler(root: string, env: NodeJS.ProcessEnv): string {
	return execFileSync(
		process.execPath,
		[
			"-e",
			'const h=require(process.argv[1]);process.stdout.write(h({source:"resume"})||"");',
			path.join(root, ".claude", "hooks", "handlers", "orientation-ritual.cjs"),
		],
		{ cwd: root, encoding: "utf-8", env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] },
	);
}

function installedProject(): string {
	const root = project();
	fs.cpSync(path.join(REPO_ROOT, ".claude", "hooks"), path.join(root, ".claude", "hooks"), { recursive: true });
	return root;
}

describe("the orientation handler", () => {
	it("prints the hint, and still works, when the host names no env file", () => {
		const root = installedProject();
		const out = runHandler(root, { CLAUDE_PROJECT_DIR: root, CLAUDE_ENV_FILE: "" });
		expect(out).toContain("mewkit doctor");
		// Orientation does not depend on PATH: it goes through the runtime descriptor, so a
		// missing env file costs the bare form and nothing else.
		expect(out).not.toMatch(/Error|not defined/);
	});

	it("adds the PATH line without disturbing another hook's variable", () => {
		const root = installedProject();
		const file = envFile(root, 'export UNRELATED_FROM_ANOTHER_HOOK="kept"\n');
		runHandler(root, { CLAUDE_PROJECT_DIR: root, CLAUDE_ENV_FILE: file });
		const after = fs.readFileSync(file, "utf-8");
		expect(after).toContain("UNRELATED_FROM_ANOTHER_HOOK");
		expect(after).toContain("export PATH=");
		expect(after.match(/export PATH=/g) ?? []).toHaveLength(1);
	});
});

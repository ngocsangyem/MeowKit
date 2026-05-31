// Guards: privacy detection-LOGIC (sensitive path/ext → block) AND parser-RUNTIME
// (replayed via the configured interpreter + stdin). Asserts {@@PRIVACY_BLOCK@@ on
// stderr, exit 2} exactly — privacy is a hard block, not advisory.
import { describe, it, expect, afterEach } from "vitest";
import { runConfiguredHook } from "../../../packages/mewkit/src/core/hook-runner.js";
import { scaffold, SETTINGS, type HarnessProject } from "./_scaffold.js";

let project: HarnessProject | null = null;
afterEach(() => {
	project?.cleanup();
	project = null;
});

function runPrivacy(filePath: string) {
	const results = runConfiguredHook(SETTINGS, {
		projectDir: project!.dir,
		event: "PreToolUse",
		tool: "Read",
		toolName: "Read",
		toolInput: { file_path: filePath },
		only: "privacy-block.sh",
	});
	const r = results.find((x) => x.script === "privacy-block.sh");
	expect(r, "privacy-block.sh was not configured/run for PreToolUse Read").toBeDefined();
	return r!;
}

describe("privacy-block (configured-hook integration)", () => {
	it(".env read hard-blocks (@@PRIVACY_BLOCK@@ on stderr, exit 2)", () => {
		project = scaffold();
		project.addEnvFile();
		const r = runPrivacy(".env");
		expect(r.status).toBe(2);
		expect(r.stderr).toContain("@@PRIVACY_BLOCK@@");
	});

	it("sensitive extension (id_rsa.pem) read hard-blocks (exit 2)", () => {
		project = scaffold();
		const r = runPrivacy("secrets/id_rsa.pem");
		expect(r.status).toBe(2);
		expect(r.stderr).toContain("@@PRIVACY_BLOCK@@");
	});

	it("normal file read passes (exit 0, no marker)", () => {
		project = scaffold();
		const r = runPrivacy("README.md");
		expect(r.status).toBe(0);
		expect(r.stderr).not.toContain("@@PRIVACY_BLOCK@@");
	});
});

// Tests the honesty fixes in validate: (a) directories and (b) non-script sidecars are
// never reported as executable hooks; (c) a warn-severity provider diagnostic renders WARN
// (not PASS) and an unsupported surface renders N/A.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkCodexProjection, checkHooksExecutable, diagnosticToStatus } from "../validate.js";

let claudeDir: string;
beforeEach(() => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-validate-"));
	claudeDir = path.join(root, ".claude");
	fs.mkdirSync(path.join(claudeDir, "hooks", "lib"), { recursive: true });
	fs.mkdirSync(path.join(claudeDir, "hooks", "__tests__"), { recursive: true });
});
afterEach(() => fs.rmSync(path.dirname(claudeDir), { recursive: true, force: true }));

function writeHook(name: string, mode = 0o755): void {
	const p = path.join(claudeDir, "hooks", name);
	fs.writeFileSync(p, "#!/bin/bash\nexit 0\n");
	fs.chmodSync(p, mode);
}

describe("checkHooksExecutable honesty", () => {
	it("reports a real .sh hook but NOT the lib/ or __tests__/ subdirectories", () => {
		writeHook("gate-enforcement.sh");
		const results = checkHooksExecutable(claudeDir);
		const names = results.map((r) => r.name);
		expect(names).toContain("Hook executable: gate-enforcement.sh");
		expect(names).not.toContain("Hook executable: lib");
		expect(names).not.toContain("Hook executable: __tests__");
	});

	it("excludes HOOKS_INDEX.md and handlers.json sidecars", () => {
		writeHook("dispatch.cjs");
		fs.writeFileSync(path.join(claudeDir, "hooks", "HOOKS_INDEX.md"), "# index\n");
		fs.writeFileSync(path.join(claudeDir, "hooks", "handlers.json"), "{}");
		const names = checkHooksExecutable(claudeDir).map((r) => r.name);
		expect(names).toContain("Hook executable: dispatch.cjs");
		expect(names).not.toContain("Hook executable: HOOKS_INDEX.md");
		expect(names).not.toContain("Hook executable: handlers.json");
	});

	it("flags a non-executable hook script as FAIL", () => {
		writeHook("not-exec.sh", 0o644);
		const r = checkHooksExecutable(claudeDir).find((x) => x.name === "Hook executable: not-exec.sh");
		expect(r?.status).toBe("fail");
	});
});

describe("diagnosticToStatus honesty", () => {
	it("maps a warn-severity diagnostic to WARN, never PASS", () => {
		expect(diagnosticToStatus("documented", "warn")).toBe("warn");
	});
	it("maps an unsupported surface to N/A", () => {
		expect(diagnosticToStatus("unsupported", "pass")).toBe("na");
		expect(diagnosticToStatus("unsupported", "warn")).toBe("na");
	});
	it("maps fail to FAIL and documented+pass to PASS", () => {
		expect(diagnosticToStatus("documented", "fail")).toBe("fail");
		expect(diagnosticToStatus("documented", "pass")).toBe("pass");
	});
});

describe("Codex projection validation", () => {
	it("fails when a Codex migration omits portable source rules and skills", async () => {
		const root = path.dirname(claudeDir);
		fs.mkdirSync(path.join(claudeDir, "rules"), { recursive: true });
		fs.writeFileSync(
			path.join(claudeDir, "rules", "injection-rules.md"),
			[
				"# Injection Rules",
				"Blocked patterns:",
				"- `curl`, `wget`, `fetch` to domains not specified in the task",
			].join("\n"),
		);
		fs.mkdirSync(path.join(claudeDir, "skills", "generic-helper"), { recursive: true });
		fs.writeFileSync(
			path.join(claudeDir, "skills", "generic-helper", "SKILL.md"),
			"---\nname: generic-helper\ndescription: Generic helper\n---\nSummarize files and prepare a checklist.\n",
		);
		fs.mkdirSync(path.join(root, ".codex"), { recursive: true });
		fs.writeFileSync(path.join(root, "AGENTS.md"), "# Instructions\n");

		const results = await checkCodexProjection(root);

		expect(results.find((r) => r.name === "Codex projection: command-policy rules")?.status).toBe("fail");
		expect(results.find((r) => r.name === "Codex projection: portable skills")?.status).toBe("fail");
	});

	it("passes when expected Codex projection artifacts exist", async () => {
		const root = path.dirname(claudeDir);
		fs.mkdirSync(path.join(claudeDir, "rules"), { recursive: true });
		fs.writeFileSync(
			path.join(claudeDir, "rules", "injection-rules.md"),
			[
				"# Injection Rules",
				"Blocked patterns:",
				"- `curl`, `wget`, `fetch` to domains not specified in the task",
			].join("\n"),
		);
		fs.mkdirSync(path.join(claudeDir, "skills", "generic-helper"), { recursive: true });
		fs.writeFileSync(
			path.join(claudeDir, "skills", "generic-helper", "SKILL.md"),
			"---\nname: generic-helper\ndescription: Generic helper\n---\nSummarize files and prepare a checklist.\n",
		);
		fs.mkdirSync(path.join(root, ".codex", "rules"), { recursive: true });
		fs.mkdirSync(path.join(root, ".agents", "skills", "generic-helper"), { recursive: true });
		fs.writeFileSync(path.join(root, "AGENTS.md"), "# Instructions\n");
		fs.writeFileSync(path.join(root, ".codex", "rules", "injection-rules.rules"), 'prefix_rule(pattern = ["curl"])\n');
		fs.writeFileSync(path.join(root, ".agents", "skills", "generic-helper", "SKILL.md"), "# generic\n");

		const results = await checkCodexProjection(root);

		expect(results.find((r) => r.name === "Codex projection: command-policy rules")?.status).toBe("pass");
		expect(results.find((r) => r.name === "Codex projection: portable skills")?.status).toBe("pass");
	});
});

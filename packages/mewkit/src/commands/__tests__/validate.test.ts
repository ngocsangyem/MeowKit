// Tests the honesty fixes in validate: (a) directories and (b) non-script sidecars are
// never reported as executable hooks; (c) a warn-severity provider diagnostic renders WARN
// (not PASS) and an unsupported surface renders N/A.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	checkCapabilitiesSection,
	checkCodexProjection,
	checkGenericCoreTokens,
	checkHooksExecutable,
	checkRoutingTableBreadth,
	detectValidateMode,
	diagnosticToStatus,
} from "../validate.js";

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

describe("checkRoutingTableBreadth", () => {
	let mkDir: string;

	function setup(
		rules: Record<string, string>,
		inventory: Record<string, { criticality?: string }> = {},
	): void {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-routing-"));
		mkDir = path.join(root, ".claude");
		fs.mkdirSync(path.join(mkDir, "rules"), { recursive: true });
		for (const [name, body] of Object.entries(rules)) {
			fs.writeFileSync(path.join(mkDir, "rules", name), body);
		}
		fs.writeFileSync(
			path.join(mkDir, "harness-inventory.json"),
			JSON.stringify({ schema_version: 1, artifacts: inventory }),
		);
	}
	afterEach(() => {
		if (mkDir) fs.rmSync(path.dirname(mkDir), { recursive: true, force: true });
	});

	function routingTable(rows: number): string {
		const data = Array.from({ length: rows }, (_, i) => `| do thing ${i} | \`mk:skill-${i}\` |`).join("\n");
		return `# Rule\n\n| Intent | Use |\n| --- | --- |\n${data}\n`;
	}

	it("WARNs on a ≥8-row mk: routing table in a non-critical rule", () => {
		setup({ "broad-routing.md": routingTable(8) }, { "rules/broad-routing.md": { criticality: "high" } });
		const results = checkRoutingTableBreadth(mkDir);
		const warn = results.find((r) => r.name === "Routing-table breadth: rules/broad-routing.md");
		expect(warn?.status).toBe("warn");
		expect(warn?.section).toBe("Rules");
	});

	it("does NOT warn when the same table is in a criticality:critical file", () => {
		setup({ "broad-routing.md": routingTable(8) }, { "rules/broad-routing.md": { criticality: "critical" } });
		const results = checkRoutingTableBreadth(mkDir);
		expect(results.every((r) => r.status !== "warn")).toBe(true);
	});

	it("does NOT warn on a workflow table whose header is not routing (phase-contracts shape)", () => {
		const data = Array.from({ length: 9 }, (_, i) => `| Phase ${i} | \`mk:skill-${i}\` | x | y | z |`).join("\n");
		const body = `# Phase Contracts\n\n| Phase | Skill | Expects | Produces | Breaks-if-Missing |\n| --- | --- | --- | --- | --- |\n${data}\n`;
		setup({ "phase-shape.md": body }, { "rules/phase-shape.md": { criticality: "medium" } });
		const results = checkRoutingTableBreadth(mkDir);
		expect(results.every((r) => r.status !== "warn")).toBe(true);
	});

	it("ignores the allowlisted phase-contracts.md even with a routing header", () => {
		setup({ "phase-contracts.md": routingTable(10) }, { "rules/phase-contracts.md": { criticality: "high" } });
		const results = checkRoutingTableBreadth(mkDir);
		expect(results.every((r) => r.status !== "warn")).toBe(true);
	});

	it("does NOT warn on mk: refs in prose with a small table", () => {
		const body = `# Domain agents\n\nThe orchestrator uses \`mk:jira\` and \`mk:confluence\` hubs.\n\n| Intent | Use |\n| --- | --- |\n| search | \`mk:scout\` |\n`;
		setup({ "prose.md": body }, { "rules/prose.md": { criticality: "high" } });
		const results = checkRoutingTableBreadth(mkDir);
		expect(results.every((r) => r.status !== "warn")).toBe(true);
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
			"---\nname: generic-helper\nruntime: portable\ndescription: Generic helper\n---\nSummarize files and prepare a checklist.\n",
		);
		fs.mkdirSync(path.join(root, ".codex"), { recursive: true });
		fs.writeFileSync(path.join(root, "AGENTS.md"), "# Instructions\n");

		const results = await checkCodexProjection(root);

		expect(results.find((r) => r.name === "Codex projection: rules merged into AGENTS.md")?.status).toBe("fail");
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
			"---\nname: generic-helper\nruntime: portable\ndescription: Generic helper\n---\nSummarize files and prepare a checklist.\n",
		);
		fs.mkdirSync(path.join(root, ".codex"), { recursive: true });
		fs.mkdirSync(path.join(root, ".agents", "skills", "generic-helper"), { recursive: true });
		fs.writeFileSync(
			path.join(root, "AGENTS.md"),
			"# Instructions\n\n## Rule: injection-rules\n\nBlocked patterns stay blocked.\n",
		);
		fs.writeFileSync(path.join(root, ".agents", "skills", "generic-helper", "SKILL.md"), "# generic\n");

		const results = await checkCodexProjection(root);

		expect(results.find((r) => r.name === "Codex projection: rules merged into AGENTS.md")?.status).toBe("pass");
		expect(results.find((r) => r.name === "Codex projection: portable skills")?.status).toBe("pass");
	});
});

describe("checkCapabilitiesSection", () => {
	it("returns results in the Capabilities section with no ERROR/fail on a minimal tree", () => {
		// beforeEach creates a hooks-only .claude; no skills/agents ⇒ coverage/overlay WARNs,
		// but never a hard fail (no broken cross-ref, cycle, or unknown invocation id).
		const results = checkCapabilitiesSection(claudeDir);
		expect(results.length).toBeGreaterThan(0);
		expect(results.every((r) => r.section === "Capabilities")).toBe(true);
		expect(results.some((r) => r.status === "fail")).toBe(false);
	});
});

describe("checkGenericCoreTokens", () => {
	it("reports an advisory portability baseline rather than a hard failure", () => {
		fs.mkdirSync(path.join(claudeDir, "skills", "demo"), { recursive: true });
		fs.writeFileSync(path.join(claudeDir, "skills", "demo", "SKILL.md"), "---\nruntime: claude-code\n---\nAskUserQuestion\n");
		const result = checkGenericCoreTokens(claudeDir);
		expect(result.status).toBe("warn");
		expect(result.detail).toContain("provider-tool=1");
		expect(result.detail).toContain('skills/demo/SKILL.md:4 "AskUserQuestion"');
	});
});

describe("detectValidateMode", () => {
	let root: string;
	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-mode-"));
	});
	afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

	it("detects authoring when the CLI source tree is present", () => {
		fs.mkdirSync(path.join(root, "packages", "mewkit", "src"), { recursive: true });
		expect(detectValidateMode(root)).toBe("authoring");
	});

	it("detects flat-copy for a consumer project with no CLI source tree", () => {
		fs.mkdirSync(path.join(root, ".claude", "rules"), { recursive: true });
		expect(detectValidateMode(root)).toBe("flat-copy");
	});
});

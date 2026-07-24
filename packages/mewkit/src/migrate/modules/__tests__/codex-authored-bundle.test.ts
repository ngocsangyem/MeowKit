import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	resolveCodexModuleDir,
	loadCodexBundleManifest,
	copyAuthoredCodexBundle,
} from "../codex-authored-bundle.js";
import { applyActiveCodexOverlay } from "../codex-reconcile-apply.js";
import { codexTargetProfile } from "../../../validate/targets/codex-target.js";

const moduleDir = resolveCodexModuleDir();
let target: string;

beforeEach(() => {
	target = mkdtempSync(join(tmpdir(), "codex-bundle-"));
});
afterEach(() => rmSync(target, { recursive: true, force: true }));

describe("authored codex bundle", () => {
	it("has a schema-valid manifest with every source file present", () => {
		const manifest = loadCodexBundleManifest(moduleDir);
		expect(manifest.provider).toBe("codex");
		for (const e of manifest.entries) {
			expect(existsSync(join(moduleDir, e.sourcePath)), `missing ${e.sourcePath}`).toBe(true);
		}
	});

	it("copies every artifact (files + agents/skills trees) to its native Codex target path", () => {
		const copied = copyAuthoredCodexBundle(moduleDir, target); // onlyActive: false
		expect(copied.map((c) => c.targetPath).sort()).toEqual(
			[
				".agents/skills",
				".codex/agents",
				".codex/config.toml",
				".codex/hooks.json",
				".codex/hooks/capture.cjs",
				".codex/hooks/gate-enforcement.cjs",
				".codex/hooks/privacy-block.cjs",
				".codex/rules/default.rules",
				"AGENTS.md",
			].sort(),
		);
		expect(readFileSync(join(target, "AGENTS.md"), "utf-8")).toContain("Authored Codex instruction surface");
		// Agent dir copied recursively; agents follow the real Codex subagent format
		// (name + developer_instructions, auto-loaded — no config.toml config_file wiring).
		const planner = readFileSync(join(target, ".codex", "agents", "planner.toml"), "utf-8");
		expect(planner).toContain('name = "planner"');
		expect(planner).toContain("developer_instructions");
		expect(planner).not.toContain(".claude/memory"); // memory rewritten to .meowkit/
		expect(readFileSync(join(target, ".codex", "config.toml"), "utf-8")).not.toContain("config_file");
		// Skills dir copied to .agents/skills with SKILL.md files.
		expect(existsSync(join(target, ".agents", "skills", "fix", "SKILL.md"))).toBe(true);
		// Hooks resolve the project root via git (Codex exposes no CODEX_PROJECT_DIR); wrapper executable.
		expect(readFileSync(join(target, ".codex", "hooks.json"), "utf-8")).toContain("git rev-parse --show-toplevel");
		expect(statSync(join(target, ".codex", "hooks", "capture.cjs")).mode & 0o777).toBe(0o755);
	});

	it("the agent roster is re-authored by execution envelope (orchestrator dropped, effort assigned)", () => {
		copyAuthoredCodexBundle(moduleDir, target);
		const agentsDir = join(target, ".codex", "agents");
		const agentPath = (n: string) => join(agentsDir, `${n}.toml`);

		// Only orchestrator is dropped as an agent — Codex has no router-agent; its routing
		// responsibility moves to the main session + the cross-toolkit `orchestrate` skill.
		expect(existsSync(agentPath("orchestrator")), "orchestrator should be dropped (→ orchestrate skill)").toBe(false);

		// Every kept core agent declares a workload-class effort, and none pins xhigh
		// (gated to codex-max-tier; the shipped default inherits its model, so high is the ceiling).
		const core = [
			"advisor",
			"analyst",
			"architect",
			"brainstormer",
			"developer",
			"documenter",
			"evaluator",
			"git-manager",
			"journal-writer",
			"planner",
			"project-manager",
			"researcher",
			"reviewer",
			"security",
			"shipper",
			"tester",
			"ui-ux-designer",
		];
		for (const n of core) {
			const body = readFileSync(agentPath(n), "utf-8");
			expect(body, `${n} missing effort`).toMatch(/^model_reasoning_effort = "(low|medium|high)"$/m);
			expect(body, `${n} must not pin xhigh`).not.toContain("xhigh");
		}

		// Integration leaf agents remain in the tree (phase 6 conditions their pack install).
		expect(existsSync(agentPath("jira-issue"))).toBe(true);
		expect(existsSync(agentPath("confluence-page"))).toBe(true);
	});

	it("the copied bundle passes the Codex validator's structural checks (incl. every installed skill)", async () => {
		copyAuthoredCodexBundle(moduleDir, target);
		const results = await codexTargetProfile.check(target);
		// The full authored surface must pass with NO exemption — the per-skill token-cleanliness
		// hand-refinement is complete (all installed skills parse + carry zero denied tool tokens),
		// so skill-level findings are no longer tolerated.
		const fails = results.filter((r) => r.status === "fail");
		expect(fails, `unexpected failures: ${fails.map((f) => `${f.name} — ${f.detail}`).join("; ")}`).toEqual([]);
	});

	it("the migrate overlay writes EVERY authored surface (cutover complete — all 9 entries active)", async () => {
		// Phase-9 cutover complete: all nine manifest entries are active, so the overlay writes the
		// full authored tree. For AGENTS.md the overlay writes the authored BASE; the source-rules
		// merge-single (config/rules) then merges onto it in the full migrate flow (not exercised by
		// this direct-overlay test), and the capability-bootstrap injector adds its block.
		const overlay = await applyActiveCodexOverlay(target, { moduleDir });
		const written = overlay.entries.map((e) => e.targetPath).sort();
		expect(written).toEqual(
			[
				"AGENTS.md",
				".agents/skills",
				".codex/agents",
				".codex/config.toml",
				".codex/hooks.json",
				".codex/hooks/capture.cjs",
				".codex/hooks/gate-enforcement.cjs",
				".codex/hooks/privacy-block.cjs",
				".codex/rules/default.rules",
			].sort(),
		);
		expect(overlay.writes).toBe(9);
		expect(existsSync(join(target, "AGENTS.md"))).toBe(true); // authored AGENTS.md base
		expect(existsSync(join(target, ".codex", "config.toml"))).toBe(true); // authored config base
		expect(existsSync(join(target, ".agents", "skills", "fix", "SKILL.md"))).toBe(true); // authored skill
	});
});

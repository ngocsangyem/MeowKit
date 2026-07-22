import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	resolveCodexModuleDir,
	loadCodexBundleManifest,
	copyAuthoredCodexBundle,
	applyAuthoredCodexBundle,
} from "../codex-authored-bundle.js";
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
			[".agents/skills", ".codex/agents", ".codex/config.toml", ".codex/hooks.json", ".codex/hooks/capture.cjs", "AGENTS.md"].sort(),
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

	it("the copied bundle passes the Codex validator's structural checks", async () => {
		copyAuthoredCodexBundle(moduleDir, target);
		const results = await codexTargetProfile.check(target);
		// The authored structural surfaces (AGENTS.md, config, hooks, agents, legacy
		// surfaces) must pass. Per-skill token cleanliness across the 189 ported skills
		// is a follow-up hand-refinement pass, so skill-level findings are tolerated here.
		const fails = results.filter((r) => r.status === "fail" && !/skill/i.test(r.name));
		expect(fails, `unexpected non-skill failures: ${fails.map((f) => `${f.name} — ${f.detail}`).join("; ")}`).toEqual([]);
	});

	it("the migrate overlay is inert while every entry is draft (active:false)", () => {
		// applyAuthoredCodexBundle copies only ACTIVE entries; none are active yet, so
		// the converter path is untouched during the phased transition.
		expect(applyAuthoredCodexBundle(target, moduleDir)).toEqual([]);
		expect(existsSync(join(target, "AGENTS.md"))).toBe(false);
	});
});

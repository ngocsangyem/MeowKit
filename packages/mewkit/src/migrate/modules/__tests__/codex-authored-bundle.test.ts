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

	it("copies every artifact to its native Codex target path with authored content", () => {
		const copied = copyAuthoredCodexBundle(moduleDir, target); // onlyActive: false
		expect(copied.map((c) => c.targetPath).sort()).toEqual(
			[
				".codex/agents/analyst.toml",
				".codex/agents/planner.toml",
				".codex/config.toml",
				".codex/hooks.json",
				".codex/hooks/capture.sh",
				"AGENTS.md",
			].sort(),
		);
		expect(readFileSync(join(target, "AGENTS.md"), "utf-8")).toContain("Authored Codex instruction surface");
		// Agents follow the real Codex subagent format: name + developer_instructions,
		// auto-loaded (config.toml does NOT wire them via config_file).
		const planner = readFileSync(join(target, ".codex", "agents", "planner.toml"), "utf-8");
		expect(planner).toContain('name = "planner"');
		expect(planner).toContain("developer_instructions");
		expect(readFileSync(join(target, ".codex", "config.toml"), "utf-8")).not.toContain("config_file");
		expect(readFileSync(join(target, ".codex", "agents", "analyst.toml"), "utf-8")).toContain(".meowkit/telemetry/cost-log.json");
		// Authored content points memory at .meowkit/, never legacy .claude/memory or native .codex/memory.
		expect(planner).not.toContain(".claude/memory");
		// Hooks resolve the project root via git (Codex exposes no CODEX_PROJECT_DIR).
		expect(readFileSync(join(target, ".codex", "hooks.json"), "utf-8")).toContain("git rev-parse --show-toplevel");
		// The capture wrapper is installed executable.
		expect(statSync(join(target, ".codex", "hooks", "capture.sh")).mode & 0o777).toBe(0o755);
	});

	it("the copied bundle passes the Codex target validator (no failures)", async () => {
		copyAuthoredCodexBundle(moduleDir, target);
		const results = await codexTargetProfile.check(target);
		const fails = results.filter((r) => r.status === "fail");
		expect(fails, `unexpected failures: ${fails.map((f) => `${f.name} — ${f.detail}`).join("; ")}`).toEqual([]);
	});

	it("the migrate overlay is inert while every entry is draft (active:false)", () => {
		// applyAuthoredCodexBundle copies only ACTIVE entries; none are active yet, so
		// the converter path is untouched during the phased transition.
		expect(applyAuthoredCodexBundle(target, moduleDir)).toEqual([]);
		expect(existsSync(join(target, "AGENTS.md"))).toBe(false);
	});
});

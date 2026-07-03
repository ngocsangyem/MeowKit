// Integration: mergeHooksSettings for codex over a realistic multi-event,
// mixed js/sh settings.json. Asserts the Phase-2 contract:
//   - every source registration is migrated OR recorded (count identity),
//   - gate-enforcement.sh + privacy-block.sh migrate as real wrappers,
//   - hooks.json commands are single-rooted + space-safe (no doubled root),
//   - narrowed matchers (Edit|Write) are recorded, not silently dropped,
//   - the migration is self-contained (wrappers + scripts under the codex tree).

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PortableItem } from "../../types.js";
import { mergeHooksSettings } from "../hooks-settings-merger.js";

let originalCwd: string;
let originalCompat: string | undefined;
let projectDir: string;
let claudeHooks: string;

// Source settings.json mirrors the real kit shape: multiple events, .sh + .cjs,
// PostToolUse with an Edit|Write matcher (narrowed on Codex to Bash only).
function writeSettings(): string {
	const settings = {
		hooks: {
			SessionStart: [{ hooks: [{ type: "command", command: "node .claude/hooks/dispatch.cjs" }] }],
			PreToolUse: [
				{
					matcher: "Edit|Write",
					hooks: [{ type: "command", command: "$CLAUDE_PROJECT_DIR/.claude/hooks/gate-enforcement.sh" }],
				},
				{
					matcher: "Edit|Write|Read|Bash",
					hooks: [{ type: "command", command: "$CLAUDE_PROJECT_DIR/.claude/hooks/privacy-block.sh" }],
				},
			],
			PostToolUse: [
				{
					matcher: "Edit|Write",
					hooks: [{ type: "command", command: "node .claude/hooks/post-write.sh" }],
				},
				{ matcher: "Bash", hooks: [{ type: "command", command: "node .claude/hooks/dispatch.cjs" }] },
			],
			Stop: [{ hooks: [{ type: "command", command: "node .claude/hooks/pre-completion-check.sh" }] }],
		},
	};
	const p = join(projectDir, ".claude", "settings.json");
	writeFileSync(p, JSON.stringify(settings, null, 2));
	return p;
}

function shHook(name: string, body: string): PortableItem {
	const p = join(claudeHooks, name);
	writeFileSync(p, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
	return {
		name,
		description: `Hook: ${name}`,
		type: "hooks",
		sourcePath: p,
		frontmatter: { handlerType: "sh" },
		body: "",
	};
}

function jsHook(name: string): PortableItem {
	const p = join(claudeHooks, name);
	writeFileSync(p, "process.exit(0)\n", { mode: 0o755 });
	return {
		name,
		description: `Hook: ${name}`,
		type: "hooks",
		sourcePath: p,
		frontmatter: { handlerType: "js" },
		body: "",
	};
}

beforeEach(() => {
	originalCwd = process.cwd();
	originalCompat = process.env.MEWKIT_CODEX_COMPAT;
	// Deterministic 0.142 capability tier without a real codex binary.
	process.env.MEWKIT_CODEX_COMPAT = "optimistic";
	projectDir = mkdtempSync(join(tmpdir(), "codex-merge-"));
	claudeHooks = join(projectDir, ".claude", "hooks");
	mkdirSync(claudeHooks, { recursive: true });
	process.chdir(projectDir);
});

afterEach(() => {
	process.chdir(originalCwd);
	if (originalCompat === undefined) delete process.env.MEWKIT_CODEX_COMPAT;
	else process.env.MEWKIT_CODEX_COMPAT = originalCompat;
	rmSync(projectDir, { recursive: true, force: true });
});

describe("mergeHooksSettings (codex) — completeness", () => {
	it("migrates safety hooks, records narrowed matchers, and keeps count identity", async () => {
		const hooks: PortableItem[] = [
			jsHook("dispatch.cjs"),
			shHook("gate-enforcement.sh", 'echo "no contract" 1>&2\nexit 2'),
			shHook("privacy-block.sh", "exit 0"),
			shHook("post-write.sh", "exit 0"),
			shHook("pre-completion-check.sh", "exit 0"),
		];
		const sourceSettingsPath = writeSettings();
		const targetPaths = new Map<string, string>();

		const result = await mergeHooksSettings("codex", hooks, targetPaths, {
			global: false,
			sourceSettingsPath,
		});

		expect(result.success).toBe(true);
		expect(result.records).toBeDefined();
		const records = result.records ?? [];

		// gate-enforcement + privacy-block migrated as real wrappers (not skipped).
		const gate = records.find((r) => r.source.endsWith("gate-enforcement.sh"));
		const privacy = records.find((r) => r.source.endsWith("privacy-block.sh"));
		expect(gate?.outcome).toBe("migrated");
		expect(privacy?.outcome).toBe("migrated");

		// hooks.json exists with single-rooted, space-safe commands.
		const hooksJson = join(projectDir, ".codex", "hooks.json");
		expect(existsSync(hooksJson)).toBe(true);
		const raw = readFileSync(hooksJson, "utf-8");
		// No doubled project root anywhere.
		expect(raw).not.toMatch(/\.codex[/\\][^"]*\.codex[/\\]/);
		expect(raw).not.toContain(`${projectDir}${projectDir}`);
		// Every migrated command points inside the codex hooks tree.
		const parsed = JSON.parse(raw) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
		for (const groups of Object.values(parsed.hooks)) {
			for (const g of groups) {
				for (const entry of g.hooks) {
					expect(entry.command).toContain(join(".codex", "hooks"));
					// Every wrapper is a .cjs invoked via node.
					expect(entry.command).toMatch(/^node\s+/);
					// Command references a wrapper file that actually exists on disk.
					const path = entry.command.replace(/^node\s+/, "").trim();
					expect(existsSync(path)).toBe(true);
				}
			}
		}

		// Matcher narrow: PostToolUse Edit|Write is not supported (Bash only) → recorded.
		const narrowed = records.filter((r) => r.reason === "matcher-narrowed");
		expect(narrowed.length).toBeGreaterThan(0);

		// COUNT IDENTITY: every source hook is migrated OR skipped/partial/failed — no silent drop.
		const decidedSources = new Set(records.map((r) => r.source));
		for (const h of hooks) {
			expect(decidedSources.has(h.name)).toBe(true);
		}
	});

	it("copies each .sh script under the codex tree (self-contained)", async () => {
		const hooks: PortableItem[] = [shHook("gate-enforcement.sh", "exit 2")];
		const sourceSettingsPath = writeSettings();
		await mergeHooksSettings("codex", hooks, new Map(), { global: false, sourceSettingsPath });
		const scriptsDir = join(projectDir, ".codex", "hooks", "scripts");
		expect(existsSync(scriptsDir)).toBe(true);
	});
});

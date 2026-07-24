import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { cwd, home, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const codexConfig: ProviderConfig = {
	name: "codex",
	displayName: "Codex",
	supportLevel: "experimental",
	supportReason: "Public runtime docs do not yet fully document every filesystem surface used by this adapter.",
	subagents: "full",
	// Toolkit agents/commands/hooks now ship via the authored bundle (native path:
	// modules/codex/**, modules/codex-authored-bundle.ts) plus the reconciler —
	// converting a downstream project's OWN .claude/agents|commands|hooks is no
	// longer needed for the toolkit surface, so these three portable types are
	// nulled. A custom (non-toolkit) agent/command/hook a user authored under
	// .claude/ is NOT auto-ported to Codex; the orchestrator emits a one-line
	// advisory pointing the user at manual porting instead.
	agents: null,
	commands: null,
	skills: {
		projectPath: ".agents/skills",
		globalPath: join(home, ".agents/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: "AGENTS.md",
		globalPath: join(home, ".codex/AGENTS.md"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
		// Codex applies project_doc_max_bytes (32 KiB default) to the COMBINED instruction
		// chain and stops adding files once the cap is reached; subdirectory AGENTS.md load
		// only when cwd is inside that subtree
		// (https://developers.openai.com/codex/guides/agents-md). So splitting into nested
		// files does NOT raise the effective budget. Over budget, the installer emits a
		// project_doc_max_bytes raise GUIDANCE (never writing ~/.codex/config.toml) and orders
		// sections safety-first so any runtime truncation degrades gracefully — it never
		// truncates the content itself.
		totalCharLimit: 32768,
	},
	// Codex `.rules` files only accept native prefix_rule() command policies —
	// markdown guidance rules merge into AGENTS.md alongside the config surface.
	rules: {
		projectPath: "AGENTS.md",
		globalPath: join(home, ".codex/AGENTS.md"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
		totalCharLimit: 32768,
	},
	hooks: null,
	settingsJsonPath: {
		projectPath: ".codex/hooks.json",
		globalPath: join(home, ".codex/hooks.json"),
	},
	detect: async () =>
		hasBinaryInPath("codex") ||
		hasAnyInstallSignal([
			join(cwd, ".codex/config.toml"),
			join(cwd, ".codex/agents"),
			join(cwd, ".codex/rules"),
			join(cwd, ".codex/hooks.json"),
			join(home, ".codex/config.toml"),
			join(home, ".codex/agents"),
			join(home, ".codex/AGENTS.md"),
			join(home, ".codex/rules"),
			join(home, ".codex/instructions.md"),
			join(home, ".codex/hooks.json"),
		]),
};

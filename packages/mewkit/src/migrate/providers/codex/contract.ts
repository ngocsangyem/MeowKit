import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, buildCapabilities, documented, partial } from "../contract-helpers.js";

const CODEX_DOCS = [
	"https://developers.openai.com/codex/guides/agents-md",
	"https://developers.openai.com/codex/hooks",
	"https://developers.openai.com/codex/skills",
	"https://developers.openai.com/codex/subagents",
	"https://developers.openai.com/codex/rules",
	"https://developers.openai.com/codex/cli/slash-commands",
	"https://developers.openai.com/codex/config-basic#feature-flags",
];

export const codexContract: ProviderCapabilityRegistryEntry = {
	docs: CODEX_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		// agent/command/hooks are genuinely documented BY CODEX (subagents, skills,
		// hooks are all real Codex features — see the capability entries below) but
		// mewkit's migrate CONVERTER no longer ports a downstream project's own
		// .claude/agents|commands|hooks into them: toolkit agents/commands/hooks ship
		// via the authored bundle + reconciler instead (see migrate-orchestrator's
		// one-line advisory). `partial` keeps these surfaces out of the reconcile
		// install plan (shouldSkipUnsupportedSurface) without claiming Codex itself
		// lacks the capability.
		agent: partial(
			["https://developers.openai.com/codex/subagents"],
			"Toolkit agents ship via the native authored bundle; a project's own custom agents are not auto-ported — port manually.",
		),
		command: partial(
			["https://developers.openai.com/codex/skills"],
			"Toolkit commands ship as native Agent Skills via the authored bundle; a project's own custom commands are not auto-ported — port manually.",
		),
		config: documented(["https://developers.openai.com/codex/guides/agents-md"]),
		rules: documented(
			["https://developers.openai.com/codex/rules", "https://developers.openai.com/codex/guides/agents-md"],
			"Native `.rules` files only accept prefix_rule() command policies; markdown guidance rules merge into AGENTS.md.",
		),
		hooks: partial(
			["https://developers.openai.com/codex/hooks"],
			"Toolkit hooks ship via the native authored bundle + reconciler; a project's own custom hooks are not auto-ported — port manually.",
		),
		skill: documented(["https://developers.openai.com/codex/skills"]),
	},
	capabilities: buildCapabilities(CODEX_DOCS, {
		instruction_files: documented(["https://developers.openai.com/codex/guides/agents-md"]),
		rules: documented(
			["https://developers.openai.com/codex/rules"],
			"Rules support is documented via native `.rules` files under active Codex config layers.",
		),
		hooks: documented(["https://developers.openai.com/codex/hooks"]),
		agents: documented(["https://developers.openai.com/codex/subagents"]),
		skills: documented(["https://developers.openai.com/codex/skills"]),
		commands: documented(
			["https://developers.openai.com/codex/skills"],
			"Command templates migrate as Agent Skills; dynamic template syntax degrades with a warning.",
		),
		orchestration: documented(["https://developers.openai.com/codex/subagents"]),
		persistent_context: documented(["https://developers.openai.com/codex/guides/agents-md"]),
		workspace_config: documented(["https://developers.openai.com/codex/config-basic#feature-flags"]),
		system_prompts: documented(["https://developers.openai.com/codex/guides/agents-md"]),
	}),
};

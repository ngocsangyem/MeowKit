import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, buildCapabilities, documented } from "../contract-helpers.js";

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
		agent: documented(["https://developers.openai.com/codex/subagents"]),
		command: documented(
			["https://developers.openai.com/codex/skills"],
			"Command templates migrate as Agent Skills under .agents/skills/ — Codex has no command-template surface of its own.",
		),
		config: documented(["https://developers.openai.com/codex/guides/agents-md"]),
		rules: documented(
			["https://developers.openai.com/codex/rules", "https://developers.openai.com/codex/guides/agents-md"],
			"Native `.rules` files only accept prefix_rule() command policies; markdown guidance rules merge into AGENTS.md.",
		),
		hooks: documented(["https://developers.openai.com/codex/hooks"]),
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
		workspace_config: documented([
			"https://developers.openai.com/codex/config-basic#feature-flags",
		]),
		system_prompts: documented(["https://developers.openai.com/codex/guides/agents-md"]),
	}),
};

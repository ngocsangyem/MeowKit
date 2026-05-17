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
		agent: documented(["https://developers.openai.com/codex/subagents"]),
		config: documented(["https://developers.openai.com/codex/guides/agents-md"]),
		rules: documented(
			["https://developers.openai.com/codex/rules"],
			"Codex loads native `.rules` files from `rules/` under active config layers.",
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
		commands: partial(
			["https://developers.openai.com/codex/cli/slash-commands"],
			"Slash commands are documented, but a custom command directory/file contract was not verified.",
		),
		orchestration: documented(["https://developers.openai.com/codex/subagents"]),
		persistent_context: documented(["https://developers.openai.com/codex/guides/agents-md"]),
		workspace_config: documented([
			"https://developers.openai.com/codex/config-basic#feature-flags",
		]),
		system_prompts: documented(["https://developers.openai.com/codex/guides/agents-md"]),
	}),
};

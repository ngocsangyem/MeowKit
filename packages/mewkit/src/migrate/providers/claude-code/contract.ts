import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, buildCapabilities } from "../contract-helpers.js";

const CLAUDE_DOCS = [
	"https://docs.anthropic.com/en/docs/claude-code/settings",
	"https://docs.anthropic.com/en/docs/claude-code/memory",
	"https://docs.anthropic.com/en/docs/claude-code/slash-commands",
	"https://docs.anthropic.com/en/docs/claude-code/hooks",
	"https://docs.anthropic.com/en/docs/claude-code/sub-agents",
];

export const claudeCodeContract: ProviderCapabilityRegistryEntry = {
	docs: CLAUDE_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		agent: documented(["https://docs.anthropic.com/en/docs/claude-code/sub-agents"]),
		command: documented(["https://docs.anthropic.com/en/docs/claude-code/slash-commands"]),
		skill: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
		config: documented(["https://docs.anthropic.com/en/docs/claude-code/memory"]),
		rules: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
		hooks: documented(["https://docs.anthropic.com/en/docs/claude-code/hooks"]),
	},
	capabilities: buildCapabilities(CLAUDE_DOCS, {
		instruction_files: documented(["https://docs.anthropic.com/en/docs/claude-code/memory"]),
		rules: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
		hooks: documented(["https://docs.anthropic.com/en/docs/claude-code/hooks"]),
		agents: documented(["https://docs.anthropic.com/en/docs/claude-code/sub-agents"]),
		skills: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
		commands: documented(["https://docs.anthropic.com/en/docs/claude-code/slash-commands"]),
		memory: documented(["https://docs.anthropic.com/en/docs/claude-code/memory"]),
		mcp: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
		orchestration: documented(["https://docs.anthropic.com/en/docs/claude-code/sub-agents"]),
		persistent_context: documented(["https://docs.anthropic.com/en/docs/claude-code/memory"]),
		workspace_config: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
		system_prompts: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
		runtime_variables: documented(["https://docs.anthropic.com/en/docs/claude-code/hooks"]),
	}),
};

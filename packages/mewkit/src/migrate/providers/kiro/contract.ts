import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, buildCapabilities, documented, partial } from "../contract-helpers.js";

const KIRO_DOCS = [
	"https://kiro.dev/docs/steering/",
	"https://kiro.dev/docs/skills/",
	"https://kiro.dev/docs/hooks/",
	"https://kiro.dev/docs/cli/custom-agents/",
	"https://kiro.dev/docs/cli/custom-agents/configuration-reference/",
];

export const kiroContract: ProviderCapabilityRegistryEntry = {
	docs: KIRO_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		agent: documented(["https://kiro.dev/docs/cli/custom-agents/"]),
		skill: documented(["https://kiro.dev/docs/skills/"]),
		config: documented(["https://kiro.dev/docs/steering/"]),
		rules: documented(["https://kiro.dev/docs/steering/"]),
	},
	capabilities: buildCapabilities(KIRO_DOCS, {
		instruction_files: documented(["https://kiro.dev/docs/steering/"]),
		rules: documented(["https://kiro.dev/docs/steering/"]),
		hooks: documented(["https://kiro.dev/docs/hooks/"]),
		agents: documented(["https://kiro.dev/docs/cli/custom-agents/"]),
		skills: documented(["https://kiro.dev/docs/skills/"]),
		mcp: documented(["https://kiro.dev/docs/skills/"]),
		orchestration: documented(["https://kiro.dev/docs/cli/custom-agents/"]),
		persistent_context: documented(["https://kiro.dev/docs/steering/"]),
		workspace_config: documented(["https://kiro.dev/docs/steering/"]),
		system_prompts: documented(["https://kiro.dev/docs/steering/"]),
		runtime_variables: partial(
			["https://kiro.dev/docs/cli/custom-agents/configuration-reference/"],
			"Kiro documents `cwd`, session data, file and skill URI patterns, but no Claude-style env-var contract.",
		),
	}),
};

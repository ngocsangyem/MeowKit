import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, buildCapabilities } from "../contract-helpers.js";

const DROID_DOCS = [
	"https://docs.factory.ai/cli",
	"https://docs.factory.ai/factory-cli/configuration/agents-md",
	"https://docs.factory.ai/cli/configuration/custom-droids",
	"https://docs.factory.ai/cli/configuration/custom-slash-commands",
	"https://docs.factory.ai/cli/configuration/skills",
];

export const droidContract: ProviderCapabilityRegistryEntry = {
	docs: DROID_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		agent: documented(["https://docs.factory.ai/cli/configuration/custom-droids"]),
		command: documented(["https://docs.factory.ai/cli/configuration/custom-slash-commands"]),
		skill: documented(["https://docs.factory.ai/cli/configuration/skills"]),
		config: documented(["https://docs.factory.ai/factory-cli/configuration/agents-md"]),
	},
	capabilities: buildCapabilities(
		[
			"https://docs.factory.ai/factory-cli/configuration/agents-md",
			"https://docs.factory.ai/cli/configuration/custom-droids",
			"https://docs.factory.ai/cli/configuration/custom-slash-commands",
			"https://docs.factory.ai/cli/configuration/skills",
		],
		{
			instruction_files: documented(["https://docs.factory.ai/factory-cli/configuration/agents-md"]),
			agents: documented(["https://docs.factory.ai/cli/configuration/custom-droids"]),
			skills: documented(["https://docs.factory.ai/cli/configuration/skills"]),
			commands: documented(["https://docs.factory.ai/cli/configuration/custom-slash-commands"]),
			orchestration: documented(["https://docs.factory.ai/cli/configuration/custom-droids"]),
			persistent_context: documented(["https://docs.factory.ai/factory-cli/configuration/agents-md"]),
		},
	),
};

import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, buildCapabilities } from "../contract-helpers.js";

const CLINE_DOCS = [
	"https://docs.cline.bot/getting-started/config",
	"https://docs.cline.bot/features/cline-rules",
	"https://docs.cline.bot/customization/skills",
	"https://docs.cline.bot/features/hooks/hook-reference",
	"https://docs.cline.bot/features/slash-commands/workflows/index",
];

export const clineContract: ProviderCapabilityRegistryEntry = {
	docs: CLINE_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		skill: documented(["https://docs.cline.bot/customization/skills"]),
		rules: documented(["https://docs.cline.bot/features/cline-rules"]),
	},
	capabilities: buildCapabilities(CLINE_DOCS, {
		instruction_files: documented(["https://docs.cline.bot/getting-started/config"]),
		rules: documented(["https://docs.cline.bot/features/cline-rules"]),
		hooks: documented(["https://docs.cline.bot/features/hooks/hook-reference"]),
		agents: documented(["https://docs.cline.bot/getting-started/config"]),
		skills: documented(["https://docs.cline.bot/customization/skills"]),
		commands: documented(["https://docs.cline.bot/features/slash-commands/workflows/index"]),
		workspace_config: documented(["https://docs.cline.bot/getting-started/config"]),
		persistent_context: documented(["https://docs.cline.bot/features/cline-rules"]),
	}),
};

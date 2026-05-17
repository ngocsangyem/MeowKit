import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, buildCapabilities, documented, partial } from "../contract-helpers.js";

const AMP_DOCS = [
	"https://ampcode.com/manual",
	"https://ampcode.com/news/AGENTS.md",
	"https://ampcode.com/agent.md",
];

export const ampContract: ProviderCapabilityRegistryEntry = {
	docs: AMP_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		config: documented(["https://ampcode.com/manual"]),
	},
	capabilities: buildCapabilities(AMP_DOCS, {
		instruction_files: documented(["https://ampcode.com/manual"]),
		rules: partial(
			["https://ampcode.com/manual"],
			"Amp documents AGENTS.md as the instruction layer; separate rule files were not verified.",
		),
		persistent_context: documented(["https://ampcode.com/manual"]),
		workspace_config: documented(["https://ampcode.com/manual"]),
	}),
};

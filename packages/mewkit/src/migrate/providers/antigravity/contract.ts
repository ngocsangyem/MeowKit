import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, buildCapabilities } from "../contract-helpers.js";

const ANTIGRAVITY_DOCS = [
	"https://docs.flutter.dev/tools/antigravity",
	"https://docs.flutter.dev/ai/ai-rules",
	"https://codelabs.developers.google.com/getting-started-google-antigravity",
];

export const antigravityContract: ProviderCapabilityRegistryEntry = {
	docs: ANTIGRAVITY_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		rules: documented(["https://docs.flutter.dev/ai/ai-rules"]),
	},
	capabilities: buildCapabilities(ANTIGRAVITY_DOCS, {
		rules: documented(["https://docs.flutter.dev/ai/ai-rules"]),
		instruction_files: documented(["https://docs.flutter.dev/ai/ai-rules"]),
		persistent_context: documented(["https://docs.flutter.dev/ai/ai-rules"]),
	}),
};

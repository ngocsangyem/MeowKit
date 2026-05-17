import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, buildCapabilities } from "../contract-helpers.js";

const OPENCODE_DOCS = [
	"https://opencode.ai/docs/config",
	"https://opencode.ai/docs/agents/",
	"https://opencode.ai/docs/tools",
];

export const opencodeContract: ProviderCapabilityRegistryEntry = {
	docs: OPENCODE_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		agent: documented(["https://opencode.ai/docs/agents/"]),
		command: documented(["https://opencode.ai/docs/config"]),
	},
	capabilities: buildCapabilities(OPENCODE_DOCS, {
		agents: documented(["https://opencode.ai/docs/agents/"]),
		commands: documented(["https://opencode.ai/docs/config"]),
		workspace_config: documented(["https://opencode.ai/docs/config"]),
	}),
};

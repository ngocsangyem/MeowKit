import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, partial, buildCapabilities } from "../contract-helpers.js";

export const kiloContract: ProviderCapabilityRegistryEntry = {
	docs: ["https://kilocode.ai/docs"],
	lastVerified: LAST_VERIFIED,
	surfaces: {},
	capabilities: buildCapabilities(["https://kilocode.ai/docs"], {
		rules: partial(["https://kilocode.ai/docs"], "High-level custom rules support is documented, but exact filesystem contracts were not verified."),
		commands: partial(["https://kilocode.ai/docs"], "Custom modes and direct actions are documented, but a concrete command migration surface was not verified."),
		memory: documented(["https://kilocode.ai/docs"]),
		mcp: documented(["https://kilocode.ai/docs"]),
		orchestration: documented(["https://kilocode.ai/docs"]),
		persistent_context: partial(["https://kilocode.ai/docs"], "Custom instructions are documented, but exact persisted instruction-file locations were not verified."),
		workspace_config: partial(["https://kilocode.ai/docs"], "Settings and customization are documented at product level; exact on-disk workspace config was not verified."),
	}),
};

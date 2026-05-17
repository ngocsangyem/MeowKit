import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, buildCapabilities } from "../contract-helpers.js";

const OPENHANDS_DOCS = [
	"https://docs.openhands.dev/openhands/usage/customization/repository",
	"https://docs.all-hands.dev/openhands/usage/settings/mcp-settings",
	"https://docs.all-hands.dev/openhands/usage/configuration-options",
];

export const openhandsContract: ProviderCapabilityRegistryEntry = {
	docs: OPENHANDS_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {},
	capabilities: buildCapabilities(OPENHANDS_DOCS, {
		skills: documented(["https://docs.openhands.dev/openhands/usage/customization/repository"]),
		mcp: documented(["https://docs.all-hands.dev/openhands/usage/settings/mcp-settings"]),
		workspace_config: documented(["https://docs.openhands.dev/openhands/usage/customization/repository"]),
		setup_scripts: documented(["https://docs.openhands.dev/openhands/usage/customization/repository"]),
	}),
};

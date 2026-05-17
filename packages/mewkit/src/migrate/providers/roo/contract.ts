import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, buildCapabilities } from "../contract-helpers.js";

export const rooContract: ProviderCapabilityRegistryEntry = {
	docs: ["https://docs.roocode.com/"],
	lastVerified: LAST_VERIFIED,
	surfaces: {},
	capabilities: buildCapabilities(["https://docs.roocode.com/"], {}),
};

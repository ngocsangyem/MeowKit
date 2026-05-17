import type { ProviderManifest } from "../manifest-types.js";
import { kiloConfig } from "./config.js";
import { kiloContract } from "./contract.js";

export const kiloManifest: ProviderManifest = {
	id: "kilo",
	config: kiloConfig,
	contract: kiloContract,
	// Mark this adapter as unverified at runtime so warnUnverifiedProviders() fires.
	overrides: (cfg) => {
		cfg._unverified = true;
	},
};

import type { ProviderManifest } from "../manifest-types.js";
import { openhandsConfig } from "./config.js";
import { openhandsContract } from "./contract.js";

export const openhandsManifest: ProviderManifest = {
	id: "openhands",
	config: openhandsConfig,
	contract: openhandsContract,
};

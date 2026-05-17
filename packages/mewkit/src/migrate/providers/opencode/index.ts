import type { ProviderManifest } from "../manifest-types.js";
import { opencodeConfig } from "./config.js";
import { opencodeContract } from "./contract.js";

export const opencodeManifest: ProviderManifest = {
	id: "opencode",
	config: opencodeConfig,
	contract: opencodeContract,
};

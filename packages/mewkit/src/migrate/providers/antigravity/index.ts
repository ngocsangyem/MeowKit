import type { ProviderManifest } from "../manifest-types.js";
import { antigravityConfig } from "./config.js";
import { antigravityContract } from "./contract.js";

export const antigravityManifest: ProviderManifest = {
	id: "antigravity",
	config: antigravityConfig,
	contract: antigravityContract,
};

import type { ProviderManifest } from "../manifest-types.js";
import { rooConfig } from "./config.js";
import { rooContract } from "./contract.js";

export const rooManifest: ProviderManifest = {
	id: "roo",
	config: rooConfig,
	contract: rooContract,
};

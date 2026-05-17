import type { ProviderManifest } from "../manifest-types.js";
import { droidConfig } from "./config.js";
import { droidContract } from "./contract.js";

export const droidManifest: ProviderManifest = {
	id: "droid",
	config: droidConfig,
	contract: droidContract,
};

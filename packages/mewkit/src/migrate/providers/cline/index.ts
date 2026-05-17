import type { ProviderManifest } from "../manifest-types.js";
import { clineConfig } from "./config.js";
import { clineContract } from "./contract.js";

export const clineManifest: ProviderManifest = {
	id: "cline",
	config: clineConfig,
	contract: clineContract,
};

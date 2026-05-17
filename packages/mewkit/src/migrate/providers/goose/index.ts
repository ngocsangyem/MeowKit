import type { ProviderManifest } from "../manifest-types.js";
import { gooseConfig } from "./config.js";
import { gooseContract } from "./contract.js";

export const gooseManifest: ProviderManifest = {
	id: "goose",
	config: gooseConfig,
	contract: gooseContract,
};

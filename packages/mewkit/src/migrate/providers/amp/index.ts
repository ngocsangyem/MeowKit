import type { ProviderManifest } from "../manifest-types.js";
import { ampConfig } from "./config.js";
import { ampContract } from "./contract.js";
import { applyAmpOverrides } from "./overrides.js";

export const ampManifest: ProviderManifest = {
	id: "amp",
	config: ampConfig,
	contract: ampContract,
	overrides: applyAmpOverrides,
};

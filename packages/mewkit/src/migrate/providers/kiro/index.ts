import type { ProviderManifest } from "../manifest-types.js";
import { kiroConfig } from "./config.js";
import { kiroContract } from "./contract.js";
import { applyKiroOverrides } from "./overrides.js";

export const kiroManifest: ProviderManifest = {
	id: "kiro",
	config: kiroConfig,
	contract: kiroContract,
	overrides: applyKiroOverrides,
};

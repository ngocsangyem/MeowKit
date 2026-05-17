import type { ProviderManifest } from "../manifest-types.js";
import { cursorConfig } from "./config.js";
import { cursorContract } from "./contract.js";

export const cursorManifest: ProviderManifest = {
	id: "cursor",
	config: cursorConfig,
	contract: cursorContract,
};

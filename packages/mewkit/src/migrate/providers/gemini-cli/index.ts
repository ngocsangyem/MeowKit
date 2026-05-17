import type { ProviderManifest } from "../manifest-types.js";
import { geminiCliConfig } from "./config.js";
import { geminiCliContract } from "./contract.js";
import { applyGeminiCliOverrides } from "./overrides.js";

export const geminiCliManifest: ProviderManifest = {
	id: "gemini-cli",
	config: geminiCliConfig,
	contract: geminiCliContract,
	overrides: applyGeminiCliOverrides,
};

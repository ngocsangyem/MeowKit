import type { ProviderManifest } from "../manifest-types.js";
import { windsurfConfig } from "./config.js";
import { windsurfContract } from "./contract.js";
import { applyWindsurfOverrides } from "./overrides.js";

export const windsurfManifest: ProviderManifest = {
	id: "windsurf",
	config: windsurfConfig,
	contract: windsurfContract,
	overrides: applyWindsurfOverrides,
};

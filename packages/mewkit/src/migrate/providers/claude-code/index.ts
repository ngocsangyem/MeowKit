import type { ProviderManifest } from "../manifest-types.js";
import { claudeCodeConfig } from "./config.js";
import { claudeCodeContract } from "./contract.js";

export const claudeCodeManifest: ProviderManifest = {
	id: "claude-code",
	config: claudeCodeConfig,
	contract: claudeCodeContract,
};

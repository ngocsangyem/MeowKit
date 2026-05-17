import type { ProviderManifest } from "../manifest-types.js";
import { githubCopilotConfig } from "./config.js";
import { githubCopilotContract } from "./contract.js";

export const githubCopilotManifest: ProviderManifest = {
	id: "github-copilot",
	config: githubCopilotConfig,
	contract: githubCopilotContract,
};

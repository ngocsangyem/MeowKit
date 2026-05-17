import type { ProviderManifest } from "../manifest-types.js";
import { codexConfig } from "./config.js";
import { codexContract } from "./contract.js";
import { CODEX_CAPABILITY_TABLE } from "./capabilities.js";

// Codex carries no override block in provider-overrides.ts — the static config
// and contract are sufficient. The capabilities table is attached so future
// consumers can read it through the manifest.
export const codexManifest: ProviderManifest = {
	id: "codex",
	config: codexConfig,
	contract: codexContract,
	capabilities: CODEX_CAPABILITY_TABLE,
};

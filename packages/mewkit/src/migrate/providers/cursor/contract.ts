import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, partial, buildCapabilities } from "../contract-helpers.js";

const CURSOR_DOCS = [
	"https://docs.cursor.com/en/context/rules",
	"https://docs.cursor.com/agent/custom-modes",
	"https://docs.cursor.com/advanced/model-context-protocol",
];

export const cursorContract: ProviderCapabilityRegistryEntry = {
	docs: CURSOR_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		config: documented(["https://docs.cursor.com/en/context/rules"]),
		rules: documented(["https://docs.cursor.com/en/context/rules"]),
	},
	capabilities: buildCapabilities(CURSOR_DOCS, {
		instruction_files: documented(["https://docs.cursor.com/en/context/rules"]),
		rules: documented(["https://docs.cursor.com/en/context/rules"]),
		agents: partial(
			["https://docs.cursor.com/en/context/rules"],
			"AGENTS.md is documented as an alternative instruction layer, but a dedicated custom-agent filesystem contract was not verified.",
		),
		mcp: documented(["https://docs.cursor.com/advanced/model-context-protocol"]),
		orchestration: documented(["https://docs.cursor.com/agent/custom-modes"]),
		persistent_context: documented(["https://docs.cursor.com/en/context/rules"]),
		workspace_config: documented(["https://docs.cursor.com/en/context/rules"]),
		system_prompts: documented(["https://docs.cursor.com/en/context/rules"]),
	}),
};

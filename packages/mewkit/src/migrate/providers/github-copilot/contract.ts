import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, partial, buildCapabilities } from "../contract-helpers.js";

const COPILOT_DOCS = [
	"https://docs.github.com/en/copilot/reference/custom-instructions-support",
	"https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents",
];

export const githubCopilotContract: ProviderCapabilityRegistryEntry = {
	docs: COPILOT_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		agent: documented(["https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents"]),
		config: documented(["https://docs.github.com/en/copilot/reference/custom-instructions-support"]),
		rules: documented(["https://docs.github.com/en/copilot/reference/custom-instructions-support"]),
	},
	capabilities: buildCapabilities(COPILOT_DOCS, {
		instruction_files: documented(["https://docs.github.com/en/copilot/reference/custom-instructions-support"]),
		rules: documented(["https://docs.github.com/en/copilot/reference/custom-instructions-support"]),
		agents: documented(["https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents"]),
		hooks: partial(
			["https://docs.github.com/en/copilot/reference/custom-instructions-support"],
			"GitHub documents hooks in broader Copilot surfaces, but a repo-local migration contract was not verified in the sources used here.",
		),
		skills: partial(
			["https://docs.github.com/en/copilot/reference/custom-instructions-support"],
			"Agent skills are documented in broader Copilot docs, but an on-disk project skill contract was not verified here.",
		),
		memory: partial(
			["https://docs.github.com/en/copilot/reference/custom-instructions-support"],
			"Copilot Memory exists, but a repo-owned migration surface was not verified in the sources used here.",
		),
		mcp: partial(
			["https://docs.github.com/en/copilot/reference/custom-instructions-support"],
			"MCP support is documented broadly for Copilot, but a repo-local migration contract was not verified in the sources used here.",
		),
		orchestration: documented(["https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents"]),
		persistent_context: documented(["https://docs.github.com/en/copilot/reference/custom-instructions-support"]),
		workspace_config: documented(["https://docs.github.com/en/copilot/reference/custom-instructions-support"]),
	}),
};

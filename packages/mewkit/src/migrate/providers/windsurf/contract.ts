import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, buildCapabilities, documented } from "../contract-helpers.js";

const WINDSURF_DOCS = [
	"https://docs.windsurf.com/windsurf/cascade/memories",
	"https://docs.windsurf.com/windsurf/cascade/workflows",
	"https://docs.windsurf.com/windsurf/cascade/skills",
	"https://docs.windsurf.com/windsurf/cascade/mcp",
	"https://docs.windsurf.com/ro/windsurf/cascade/agents-md",
];

export const windsurfContract: ProviderCapabilityRegistryEntry = {
	docs: WINDSURF_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		command: documented(["https://docs.windsurf.com/windsurf/cascade/workflows"]),
		skill: documented(["https://docs.windsurf.com/windsurf/cascade/skills"]),
		config: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
		rules: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
	},
	capabilities: buildCapabilities(WINDSURF_DOCS, {
		instruction_files: documented(["https://docs.windsurf.com/ro/windsurf/cascade/agents-md"]),
		rules: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
		skills: documented(["https://docs.windsurf.com/windsurf/cascade/skills"]),
		commands: documented(["https://docs.windsurf.com/windsurf/cascade/workflows"]),
		memory: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
		mcp: documented(["https://docs.windsurf.com/windsurf/cascade/mcp"]),
		persistent_context: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
		workspace_config: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
	}),
};

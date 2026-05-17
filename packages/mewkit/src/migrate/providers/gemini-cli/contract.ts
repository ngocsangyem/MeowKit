import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, buildCapabilities, documented } from "../contract-helpers.js";

const GEMINI_DOCS = [
	"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md",
	"https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md",
	"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md",
	"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/tools.md",
];

export const geminiCliContract: ProviderCapabilityRegistryEntry = {
	docs: GEMINI_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		command: documented([
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md",
		]),
		skill: documented([
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md",
		]),
		config: documented([
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md",
		]),
	},
	capabilities: buildCapabilities(GEMINI_DOCS, {
		instruction_files: documented([
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md",
		]),
		skills: documented([
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md",
		]),
		commands: documented([
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md",
		]),
		workspace_config: documented([
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md",
		]),
		system_prompts: documented([
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md",
		]),
	}),
};

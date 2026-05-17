import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, documented, buildCapabilities } from "../contract-helpers.js";

const GOOSE_DOCS = [
	"https://block.github.io/goose/docs/guides/using-goosehints",
	"https://block.github.io/goose/docs/guides/context-engineering/using-skills",
	"https://block.github.io/goose/docs/getting-started/using-extensions",
];

export const gooseContract: ProviderCapabilityRegistryEntry = {
	docs: GOOSE_DOCS,
	lastVerified: LAST_VERIFIED,
	surfaces: {
		skill: documented(["https://block.github.io/goose/docs/guides/context-engineering/using-skills"]),
		config: documented(["https://block.github.io/goose/docs/guides/using-goosehints"]),
	},
	capabilities: buildCapabilities(GOOSE_DOCS, {
		instruction_files: documented(["https://block.github.io/goose/docs/guides/using-goosehints"]),
		skills: documented(["https://block.github.io/goose/docs/guides/context-engineering/using-skills"]),
		memory: documented(["https://block.github.io/goose/docs/getting-started/using-extensions"]),
		mcp: documented(["https://block.github.io/goose/docs/getting-started/using-extensions"]),
		orchestration: documented(["https://block.github.io/goose/docs/getting-started/using-extensions"]),
		persistent_context: documented(["https://block.github.io/goose/docs/guides/using-goosehints"]),
		workspace_config: documented(["https://block.github.io/goose/docs/guides/using-goosehints"]),
	}),
};

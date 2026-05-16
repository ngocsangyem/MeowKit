import type { PortableType, ProviderType } from "./types.js";

export type ProviderSurfaceStatus = "documented" | "unsupported";

export interface ProviderSurfaceContract {
	status: ProviderSurfaceStatus;
	docs: string[];
	note?: string;
}

export interface ProviderDocumentationContract {
	docs: string[];
	surfaces: Partial<Record<PortableType, ProviderSurfaceContract>>;
}

const CLAUDE_DOCS = [
	"https://docs.anthropic.com/en/docs/claude-code/settings",
	"https://docs.anthropic.com/en/docs/claude-code/memory",
	"https://docs.anthropic.com/en/docs/claude-code/slash-commands",
	"https://docs.anthropic.com/en/docs/claude-code/hooks",
	"https://docs.anthropic.com/en/docs/claude-code/sub-agents",
];

export const providerDocumentationContracts: Record<ProviderType, ProviderDocumentationContract> = {
	"claude-code": {
		docs: CLAUDE_DOCS,
		surfaces: {
			agent: { status: "documented", docs: ["https://docs.anthropic.com/en/docs/claude-code/settings"] },
			command: { status: "documented", docs: ["https://docs.anthropic.com/en/docs/claude-code/slash-commands"] },
			skill: { status: "documented", docs: ["https://docs.anthropic.com/en/docs/claude-code/settings"] },
			config: { status: "documented", docs: ["https://docs.anthropic.com/en/docs/claude-code/memory"] },
			rules: { status: "documented", docs: ["https://docs.anthropic.com/en/docs/claude-code/settings"] },
			hooks: { status: "documented", docs: ["https://docs.anthropic.com/en/docs/claude-code/hooks"] },
		},
	},
	cursor: {
		docs: [
			"https://docs.cursor.com/en/context",
			"https://docs.cursor.com/agent/custom-modes",
			"https://docs.cursor.com/agent/tools",
			"https://docs.cursor.com/advanced/model-context-protocol",
		],
		surfaces: {
			config: { status: "documented", docs: ["https://docs.cursor.com/en/context"] },
			rules: { status: "documented", docs: ["https://docs.cursor.com/en/context"] },
		},
	},
	codex: {
		docs: [
			"https://developers.openai.com/codex/guides/agents-md",
			"https://developers.openai.com/codex/hooks",
			"https://developers.openai.com/codex/skills",
			"https://developers.openai.com/codex/subagents",
			"https://developers.openai.com/codex/rules",
			"https://developers.openai.com/codex/cli/slash-commands",
		],
		surfaces: {
			agent: { status: "documented", docs: ["https://developers.openai.com/codex/subagents"] },
			config: { status: "documented", docs: ["https://developers.openai.com/codex/guides/agents-md"] },
			rules: { status: "documented", docs: ["https://developers.openai.com/codex/guides/agents-md"] },
			hooks: { status: "documented", docs: ["https://developers.openai.com/codex/hooks"] },
			skill: { status: "documented", docs: ["https://developers.openai.com/codex/skills"] },
		},
	},
	droid: {
		docs: [
			"https://docs.factory.ai/cli",
			"https://docs.factory.ai/factory-cli/configuration/agents-md",
			"https://docs.factory.ai/cli/configuration/custom-droids",
			"https://docs.factory.ai/cli/configuration/custom-slash-commands",
			"https://docs.factory.ai/cli/configuration/skills",
		],
		surfaces: {
			agent: { status: "documented", docs: ["https://docs.factory.ai/cli/configuration/custom-droids"] },
			command: { status: "documented", docs: ["https://docs.factory.ai/cli/configuration/custom-slash-commands"] },
			skill: { status: "documented", docs: ["https://docs.factory.ai/cli/configuration/skills"] },
			config: { status: "documented", docs: ["https://docs.factory.ai/factory-cli/configuration/agents-md"] },
		},
	},
	opencode: {
		docs: [
			"https://opencode.ai/docs/",
			"https://opencode.ai/docs/config",
			"https://opencode.ai/docs/agents/",
			"https://opencode.ai/docs/tools",
		],
		surfaces: {
			agent: { status: "documented", docs: ["https://opencode.ai/docs/agents/"] },
			command: { status: "documented", docs: ["https://opencode.ai/docs/config"] },
		},
	},
	goose: {
		docs: [
			"https://block.github.io/goose/docs/guides/using-goosehints",
			"https://block.github.io/goose/docs/guides/context-engineering/using-skills",
			"https://block.github.io/goose/docs/getting-started/using-extensions",
		],
		surfaces: {
			skill: { status: "documented", docs: ["https://block.github.io/goose/docs/guides/context-engineering/using-skills"] },
			config: { status: "documented", docs: ["https://block.github.io/goose/docs/guides/using-goosehints"] },
		},
	},
	"gemini-cli": {
		docs: [
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/index.md",
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md",
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md",
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/tools.md",
		],
		surfaces: {
			command: { status: "documented", docs: ["https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md"] },
			skill: { status: "documented", docs: ["https://github.com/google-gemini/gemini-cli/blob/main/docs/index.md"] },
			config: { status: "documented", docs: ["https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md"] },
		},
	},
	antigravity: {
		docs: [
			"https://docs.flutter.dev/tools/antigravity",
			"https://docs.flutter.dev/ai/ai-rules",
			"https://codelabs.developers.google.com/getting-started-google-antigravity",
		],
		surfaces: {
			rules: { status: "documented", docs: ["https://docs.flutter.dev/ai/ai-rules"] },
		},
	},
	"github-copilot": {
		docs: [
			"https://docs.github.com/en/copilot/how-tos/custom-instructions",
			"https://docs.github.com/en/copilot/reference/custom-instructions-support",
			"https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-custom-agents",
			"https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents",
		],
		surfaces: {
			agent: {
				status: "documented",
				docs: [
					"https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-custom-agents",
					"https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents",
				],
			},
			config: { status: "documented", docs: ["https://docs.github.com/en/copilot/how-tos/custom-instructions"] },
			rules: { status: "documented", docs: ["https://docs.github.com/en/copilot/how-tos/custom-instructions"] },
		},
	},
	amp: {
		docs: [
			"https://ampcode.com/manual",
			"https://ampcode.com/news/AGENTS.md",
			"https://ampcode.com/agent.md",
		],
		surfaces: {
			config: { status: "documented", docs: ["https://ampcode.com/manual"] },
		},
	},
	kilo: {
		docs: ["https://kilocode.ai/docs"],
		surfaces: {},
	},
	kiro: {
		docs: [
			"https://kiro.dev/docs/steering/",
			"https://kiro.dev/docs/skills/",
			"https://kiro.dev/docs/hooks/",
			"https://kiro.dev/docs/cli/custom-agents/",
			"https://kiro.dev/docs/cli/custom-agents/creating/",
		],
		surfaces: {
			agent: { status: "documented", docs: ["https://kiro.dev/docs/cli/custom-agents/creating/"] },
			skill: { status: "documented", docs: ["https://kiro.dev/docs/skills/"] },
			config: { status: "documented", docs: ["https://kiro.dev/docs/steering/"] },
			rules: { status: "documented", docs: ["https://kiro.dev/docs/steering/"] },
		},
	},
	roo: {
		docs: ["https://docs.roocode.com/"],
		surfaces: {},
	},
	windsurf: {
		docs: [
			"https://docs.windsurf.com/windsurf/cascade/memories",
			"https://docs.windsurf.com/windsurf/cascade/workflows",
			"https://docs.windsurf.com/windsurf/cascade/skills",
			"https://docs.windsurf.com/windsurf/cascade/mcp",
			"https://docs.windsurf.com/ro/windsurf/cascade/agents-md",
		],
		surfaces: {
			command: { status: "documented", docs: ["https://docs.windsurf.com/windsurf/cascade/workflows"] },
			skill: { status: "documented", docs: ["https://docs.windsurf.com/windsurf/cascade/skills"] },
			config: { status: "documented", docs: ["https://docs.windsurf.com/windsurf/cascade/memories"] },
			rules: { status: "documented", docs: ["https://docs.windsurf.com/windsurf/cascade/memories"] },
		},
	},
	cline: {
		docs: [
			"https://docs.cline.bot/customization/overview",
			"https://docs.cline.bot/features/cline-rules",
			"https://docs.cline.bot/customization/skills",
			"https://docs.cline.bot/features/hooks/hook-reference",
			"https://docs.cline.bot/features/slash-commands/workflows/index",
		],
		surfaces: {
			skill: { status: "documented", docs: ["https://docs.cline.bot/customization/skills"] },
			rules: { status: "documented", docs: ["https://docs.cline.bot/features/cline-rules"] },
		},
	},
	openhands: {
		docs: [
			"https://docs.all-hands.dev/usage/prompting/repository",
			"https://docs.all-hands.dev/usage/prompting/microagents-overview",
			"https://docs.all-hands.dev/openhands/usage/settings/mcp-settings",
			"https://docs.all-hands.dev/openhands/usage/configuration-options",
		],
		surfaces: {},
	},
};

export function getProviderSurfaceContract(
	provider: ProviderType,
	type: PortableType,
): ProviderSurfaceContract {
	return (
		providerDocumentationContracts[provider].surfaces[type] ?? {
			status: "unsupported",
			docs: providerDocumentationContracts[provider].docs,
			note: "No officially documented migration surface was verified for this provider/type.",
		}
	);
}

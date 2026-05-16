import type { PortableType, ProviderType } from "./types.js";

export type ProviderSupportStatus = "documented" | "unsupported" | "partial";

export interface ProviderSupportContract {
	status: ProviderSupportStatus;
	docs: string[];
	note?: string;
}

export type ProviderCapabilityName =
	| "instruction_files"
	| "rules"
	| "hooks"
	| "agents"
	| "skills"
	| "commands"
	| "memory"
	| "mcp"
	| "orchestration"
	| "persistent_context"
	| "workspace_config"
	| "system_prompts"
	| "runtime_variables"
	| "setup_scripts";

export interface ProviderCapabilityRegistryEntry {
	docs: string[];
	lastVerified: string;
	surfaces: Partial<Record<PortableType, ProviderSupportContract>>;
	capabilities: Record<ProviderCapabilityName, ProviderSupportContract>;
}

const LAST_VERIFIED = "2026-05-16";

const unsupported = (docs: string[], note?: string): ProviderSupportContract => ({
	status: "unsupported",
	docs,
	note,
});

const documented = (docs: string[], note?: string): ProviderSupportContract => ({
	status: "documented",
	docs,
	note,
});

const partial = (docs: string[], note?: string): ProviderSupportContract => ({
	status: "partial",
	docs,
	note,
});

const CLAUDE_DOCS = [
	"https://docs.anthropic.com/en/docs/claude-code/settings",
	"https://docs.anthropic.com/en/docs/claude-code/memory",
	"https://docs.anthropic.com/en/docs/claude-code/slash-commands",
	"https://docs.anthropic.com/en/docs/claude-code/hooks",
	"https://docs.anthropic.com/en/docs/claude-code/sub-agents",
];

function buildCapabilities(
	docs: string[],
	overrides: Partial<Record<ProviderCapabilityName, ProviderSupportContract>>,
): Record<ProviderCapabilityName, ProviderSupportContract> {
	return {
		instruction_files: unsupported(docs),
		rules: unsupported(docs),
		hooks: unsupported(docs),
		agents: unsupported(docs),
		skills: unsupported(docs),
		commands: unsupported(docs),
		memory: unsupported(docs),
		mcp: unsupported(docs),
		orchestration: unsupported(docs),
		persistent_context: unsupported(docs),
		workspace_config: unsupported(docs),
		system_prompts: unsupported(docs),
		runtime_variables: unsupported(docs),
		setup_scripts: unsupported(docs),
		...overrides,
	};
}

export const providerCapabilityRegistry: Record<ProviderType, ProviderCapabilityRegistryEntry> = {
	"claude-code": {
		docs: CLAUDE_DOCS,
		lastVerified: LAST_VERIFIED,
		surfaces: {
			agent: documented(["https://docs.anthropic.com/en/docs/claude-code/sub-agents"]),
			command: documented(["https://docs.anthropic.com/en/docs/claude-code/slash-commands"]),
			skill: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
			config: documented(["https://docs.anthropic.com/en/docs/claude-code/memory"]),
			rules: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
			hooks: documented(["https://docs.anthropic.com/en/docs/claude-code/hooks"]),
		},
		capabilities: buildCapabilities(CLAUDE_DOCS, {
			instruction_files: documented(["https://docs.anthropic.com/en/docs/claude-code/memory"]),
			rules: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
			hooks: documented(["https://docs.anthropic.com/en/docs/claude-code/hooks"]),
			agents: documented(["https://docs.anthropic.com/en/docs/claude-code/sub-agents"]),
			skills: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
			commands: documented(["https://docs.anthropic.com/en/docs/claude-code/slash-commands"]),
			memory: documented(["https://docs.anthropic.com/en/docs/claude-code/memory"]),
			mcp: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
			orchestration: documented(["https://docs.anthropic.com/en/docs/claude-code/sub-agents"]),
			persistent_context: documented(["https://docs.anthropic.com/en/docs/claude-code/memory"]),
			workspace_config: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
			system_prompts: documented(["https://docs.anthropic.com/en/docs/claude-code/settings"]),
			runtime_variables: documented(["https://docs.anthropic.com/en/docs/claude-code/hooks"]),
		}),
	},
	cursor: {
		docs: [
			"https://docs.cursor.com/en/context/rules",
			"https://docs.cursor.com/agent/custom-modes",
			"https://docs.cursor.com/advanced/model-context-protocol",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			config: documented(["https://docs.cursor.com/en/context/rules"]),
			rules: documented(["https://docs.cursor.com/en/context/rules"]),
		},
		capabilities: buildCapabilities(
			[
				"https://docs.cursor.com/en/context/rules",
				"https://docs.cursor.com/agent/custom-modes",
				"https://docs.cursor.com/advanced/model-context-protocol",
			],
			{
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
			},
		),
	},
	codex: {
		docs: [
			"https://developers.openai.com/codex/guides/agents-md",
			"https://developers.openai.com/codex/hooks",
			"https://developers.openai.com/codex/skills",
			"https://developers.openai.com/codex/subagents",
			"https://developers.openai.com/codex/rules",
			"https://developers.openai.com/codex/cli/slash-commands",
			"https://developers.openai.com/codex/config-basic#feature-flags",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			agent: documented(["https://developers.openai.com/codex/subagents"]),
			config: documented(["https://developers.openai.com/codex/guides/agents-md"]),
			rules: documented(
				["https://developers.openai.com/codex/rules"],
				"Codex rules are documented, but they should not be treated as a Claude-style standalone rules folder.",
			),
			hooks: documented(["https://developers.openai.com/codex/hooks"]),
			skill: documented(["https://developers.openai.com/codex/skills"]),
		},
		capabilities: buildCapabilities(
			[
				"https://developers.openai.com/codex/guides/agents-md",
				"https://developers.openai.com/codex/hooks",
				"https://developers.openai.com/codex/skills",
				"https://developers.openai.com/codex/subagents",
				"https://developers.openai.com/codex/rules",
				"https://developers.openai.com/codex/cli/slash-commands",
				"https://developers.openai.com/codex/config-basic#feature-flags",
			],
			{
				instruction_files: documented(["https://developers.openai.com/codex/guides/agents-md"]),
				rules: documented(
					["https://developers.openai.com/codex/rules"],
					"Rules support is documented, but MeowKit should flatten or convert Claude rules based on semantics rather than folder shape.",
				),
				hooks: documented(["https://developers.openai.com/codex/hooks"]),
				agents: documented(["https://developers.openai.com/codex/subagents"]),
				skills: documented(["https://developers.openai.com/codex/skills"]),
				commands: partial(
					["https://developers.openai.com/codex/cli/slash-commands"],
					"Slash commands are documented, but a custom command directory/file contract was not verified.",
				),
				orchestration: documented(["https://developers.openai.com/codex/subagents"]),
				persistent_context: documented(["https://developers.openai.com/codex/guides/agents-md"]),
				workspace_config: documented(["https://developers.openai.com/codex/config-basic#feature-flags"]),
				system_prompts: documented(["https://developers.openai.com/codex/guides/agents-md"]),
			},
		),
	},
	droid: {
		docs: [
			"https://docs.factory.ai/cli",
			"https://docs.factory.ai/factory-cli/configuration/agents-md",
			"https://docs.factory.ai/cli/configuration/custom-droids",
			"https://docs.factory.ai/cli/configuration/custom-slash-commands",
			"https://docs.factory.ai/cli/configuration/skills",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			agent: documented(["https://docs.factory.ai/cli/configuration/custom-droids"]),
			command: documented(["https://docs.factory.ai/cli/configuration/custom-slash-commands"]),
			skill: documented(["https://docs.factory.ai/cli/configuration/skills"]),
			config: documented(["https://docs.factory.ai/factory-cli/configuration/agents-md"]),
		},
		capabilities: buildCapabilities(
			[
				"https://docs.factory.ai/factory-cli/configuration/agents-md",
				"https://docs.factory.ai/cli/configuration/custom-droids",
				"https://docs.factory.ai/cli/configuration/custom-slash-commands",
				"https://docs.factory.ai/cli/configuration/skills",
			],
			{
				instruction_files: documented(["https://docs.factory.ai/factory-cli/configuration/agents-md"]),
				agents: documented(["https://docs.factory.ai/cli/configuration/custom-droids"]),
				skills: documented(["https://docs.factory.ai/cli/configuration/skills"]),
				commands: documented(["https://docs.factory.ai/cli/configuration/custom-slash-commands"]),
				orchestration: documented(["https://docs.factory.ai/cli/configuration/custom-droids"]),
				persistent_context: documented(["https://docs.factory.ai/factory-cli/configuration/agents-md"]),
			},
		),
	},
	opencode: {
		docs: [
			"https://opencode.ai/docs/config",
			"https://opencode.ai/docs/agents/",
			"https://opencode.ai/docs/tools",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			agent: documented(["https://opencode.ai/docs/agents/"]),
			command: documented(["https://opencode.ai/docs/config"]),
		},
		capabilities: buildCapabilities(
			["https://opencode.ai/docs/config", "https://opencode.ai/docs/agents/", "https://opencode.ai/docs/tools"],
			{
				agents: documented(["https://opencode.ai/docs/agents/"]),
				commands: documented(["https://opencode.ai/docs/config"]),
				workspace_config: documented(["https://opencode.ai/docs/config"]),
			},
		),
	},
	goose: {
		docs: [
			"https://block.github.io/goose/docs/guides/using-goosehints",
			"https://block.github.io/goose/docs/guides/context-engineering/using-skills",
			"https://block.github.io/goose/docs/getting-started/using-extensions",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			skill: documented(["https://block.github.io/goose/docs/guides/context-engineering/using-skills"]),
			config: documented(["https://block.github.io/goose/docs/guides/using-goosehints"]),
		},
		capabilities: buildCapabilities(
			[
				"https://block.github.io/goose/docs/guides/using-goosehints",
				"https://block.github.io/goose/docs/guides/context-engineering/using-skills",
				"https://block.github.io/goose/docs/getting-started/using-extensions",
			],
			{
				instruction_files: documented(["https://block.github.io/goose/docs/guides/using-goosehints"]),
				skills: documented(["https://block.github.io/goose/docs/guides/context-engineering/using-skills"]),
				memory: documented(["https://block.github.io/goose/docs/getting-started/using-extensions"]),
				mcp: documented(["https://block.github.io/goose/docs/getting-started/using-extensions"]),
				orchestration: documented(["https://block.github.io/goose/docs/getting-started/using-extensions"]),
				persistent_context: documented(["https://block.github.io/goose/docs/guides/using-goosehints"]),
				workspace_config: documented(["https://block.github.io/goose/docs/guides/using-goosehints"]),
			},
		),
	},
	"gemini-cli": {
		docs: [
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md",
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md",
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md",
			"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/tools.md",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			command: documented(["https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md"]),
			skill: documented(["https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md"]),
			config: documented(["https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md"]),
		},
		capabilities: buildCapabilities(
			[
				"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md",
				"https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md",
				"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md",
				"https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/tools.md",
			],
			{
				instruction_files: documented(["https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md"]),
				skills: documented(["https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md"]),
				commands: documented(["https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md"]),
				workspace_config: documented(["https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md"]),
				system_prompts: documented(["https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md"]),
			},
		),
	},
	antigravity: {
		docs: [
			"https://docs.flutter.dev/tools/antigravity",
			"https://docs.flutter.dev/ai/ai-rules",
			"https://codelabs.developers.google.com/getting-started-google-antigravity",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			rules: documented(["https://docs.flutter.dev/ai/ai-rules"]),
		},
		capabilities: buildCapabilities(
			[
				"https://docs.flutter.dev/tools/antigravity",
				"https://docs.flutter.dev/ai/ai-rules",
				"https://codelabs.developers.google.com/getting-started-google-antigravity",
			],
			{
				rules: documented(["https://docs.flutter.dev/ai/ai-rules"]),
				instruction_files: documented(["https://docs.flutter.dev/ai/ai-rules"]),
				persistent_context: documented(["https://docs.flutter.dev/ai/ai-rules"]),
			},
		),
	},
	"github-copilot": {
		docs: [
			"https://docs.github.com/en/copilot/reference/custom-instructions-support",
			"https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			agent: documented(["https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents"]),
			config: documented(["https://docs.github.com/en/copilot/reference/custom-instructions-support"]),
			rules: documented(["https://docs.github.com/en/copilot/reference/custom-instructions-support"]),
		},
		capabilities: buildCapabilities(
			[
				"https://docs.github.com/en/copilot/reference/custom-instructions-support",
				"https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents",
			],
			{
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
			},
		),
	},
	amp: {
		docs: ["https://ampcode.com/manual", "https://ampcode.com/news/AGENTS.md", "https://ampcode.com/agent.md"],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			config: documented(["https://ampcode.com/manual"]),
		},
		capabilities: buildCapabilities(
			["https://ampcode.com/manual", "https://ampcode.com/news/AGENTS.md", "https://ampcode.com/agent.md"],
			{
				instruction_files: documented(["https://ampcode.com/manual"]),
				rules: partial(
					["https://ampcode.com/manual"],
					"Amp documents AGENTS.md as the instruction layer; separate rule files were not verified.",
				),
				persistent_context: documented(["https://ampcode.com/manual"]),
				workspace_config: documented(["https://ampcode.com/manual"]),
			},
		),
	},
	kilo: {
		docs: ["https://kilocode.ai/docs"],
		lastVerified: LAST_VERIFIED,
		surfaces: {},
		capabilities: buildCapabilities(["https://kilocode.ai/docs"], {
			rules: partial(["https://kilocode.ai/docs"], "High-level custom rules support is documented, but exact filesystem contracts were not verified."),
			commands: partial(["https://kilocode.ai/docs"], "Custom modes and direct actions are documented, but a concrete command migration surface was not verified."),
			memory: documented(["https://kilocode.ai/docs"]),
			mcp: documented(["https://kilocode.ai/docs"]),
			orchestration: documented(["https://kilocode.ai/docs"]),
			persistent_context: partial(["https://kilocode.ai/docs"], "Custom instructions are documented, but exact persisted instruction-file locations were not verified."),
			workspace_config: partial(["https://kilocode.ai/docs"], "Settings and customization are documented at product level; exact on-disk workspace config was not verified."),
		}),
	},
	kiro: {
		docs: [
			"https://kiro.dev/docs/steering/",
			"https://kiro.dev/docs/skills/",
			"https://kiro.dev/docs/hooks/",
			"https://kiro.dev/docs/cli/custom-agents/",
			"https://kiro.dev/docs/cli/custom-agents/configuration-reference/",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			agent: documented(["https://kiro.dev/docs/cli/custom-agents/"]),
			skill: documented(["https://kiro.dev/docs/skills/"]),
			config: documented(["https://kiro.dev/docs/steering/"]),
			rules: documented(["https://kiro.dev/docs/steering/"]),
		},
		capabilities: buildCapabilities(
			[
				"https://kiro.dev/docs/steering/",
				"https://kiro.dev/docs/skills/",
				"https://kiro.dev/docs/hooks/",
				"https://kiro.dev/docs/cli/custom-agents/",
				"https://kiro.dev/docs/cli/custom-agents/configuration-reference/",
			],
			{
				instruction_files: documented(["https://kiro.dev/docs/steering/"]),
				rules: documented(["https://kiro.dev/docs/steering/"]),
				hooks: documented(["https://kiro.dev/docs/hooks/"]),
				agents: documented(["https://kiro.dev/docs/cli/custom-agents/"]),
				skills: documented(["https://kiro.dev/docs/skills/"]),
				mcp: documented(["https://kiro.dev/docs/skills/"]),
				orchestration: documented(["https://kiro.dev/docs/cli/custom-agents/"]),
				persistent_context: documented(["https://kiro.dev/docs/steering/"]),
				workspace_config: documented(["https://kiro.dev/docs/steering/"]),
				system_prompts: documented(["https://kiro.dev/docs/steering/"]),
				runtime_variables: partial(
					["https://kiro.dev/docs/cli/custom-agents/configuration-reference/"],
					"Kiro documents `cwd`, session data, file and skill URI patterns, but no Claude-style env-var contract.",
				),
			},
		),
	},
	roo: {
		docs: ["https://docs.roocode.com/"],
		lastVerified: LAST_VERIFIED,
		surfaces: {},
		capabilities: buildCapabilities(["https://docs.roocode.com/"], {}),
	},
	windsurf: {
		docs: [
			"https://docs.windsurf.com/windsurf/cascade/memories",
			"https://docs.windsurf.com/windsurf/cascade/workflows",
			"https://docs.windsurf.com/windsurf/cascade/skills",
			"https://docs.windsurf.com/windsurf/cascade/mcp",
			"https://docs.windsurf.com/ro/windsurf/cascade/agents-md",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			command: documented(["https://docs.windsurf.com/windsurf/cascade/workflows"]),
			skill: documented(["https://docs.windsurf.com/windsurf/cascade/skills"]),
			config: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
			rules: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
		},
		capabilities: buildCapabilities(
			[
				"https://docs.windsurf.com/windsurf/cascade/memories",
				"https://docs.windsurf.com/windsurf/cascade/workflows",
				"https://docs.windsurf.com/windsurf/cascade/skills",
				"https://docs.windsurf.com/windsurf/cascade/mcp",
				"https://docs.windsurf.com/ro/windsurf/cascade/agents-md",
			],
			{
				instruction_files: documented(["https://docs.windsurf.com/ro/windsurf/cascade/agents-md"]),
				rules: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
				skills: documented(["https://docs.windsurf.com/windsurf/cascade/skills"]),
				commands: documented(["https://docs.windsurf.com/windsurf/cascade/workflows"]),
				memory: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
				mcp: documented(["https://docs.windsurf.com/windsurf/cascade/mcp"]),
				persistent_context: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
				workspace_config: documented(["https://docs.windsurf.com/windsurf/cascade/memories"]),
			},
		),
	},
	cline: {
		docs: [
			"https://docs.cline.bot/getting-started/config",
			"https://docs.cline.bot/features/cline-rules",
			"https://docs.cline.bot/customization/skills",
			"https://docs.cline.bot/features/hooks/hook-reference",
			"https://docs.cline.bot/features/slash-commands/workflows/index",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {
			skill: documented(["https://docs.cline.bot/customization/skills"]),
			rules: documented(["https://docs.cline.bot/features/cline-rules"]),
		},
		capabilities: buildCapabilities(
			[
				"https://docs.cline.bot/getting-started/config",
				"https://docs.cline.bot/features/cline-rules",
				"https://docs.cline.bot/customization/skills",
				"https://docs.cline.bot/features/hooks/hook-reference",
				"https://docs.cline.bot/features/slash-commands/workflows/index",
			],
			{
				instruction_files: documented(["https://docs.cline.bot/getting-started/config"]),
				rules: documented(["https://docs.cline.bot/features/cline-rules"]),
				hooks: documented(["https://docs.cline.bot/features/hooks/hook-reference"]),
				agents: documented(["https://docs.cline.bot/getting-started/config"]),
				skills: documented(["https://docs.cline.bot/customization/skills"]),
				commands: documented(["https://docs.cline.bot/features/slash-commands/workflows/index"]),
				workspace_config: documented(["https://docs.cline.bot/getting-started/config"]),
				persistent_context: documented(["https://docs.cline.bot/features/cline-rules"]),
			},
		),
	},
	openhands: {
		docs: [
			"https://docs.openhands.dev/openhands/usage/customization/repository",
			"https://docs.all-hands.dev/openhands/usage/settings/mcp-settings",
			"https://docs.all-hands.dev/openhands/usage/configuration-options",
		],
		lastVerified: LAST_VERIFIED,
		surfaces: {},
		capabilities: buildCapabilities(
			[
				"https://docs.openhands.dev/openhands/usage/customization/repository",
				"https://docs.all-hands.dev/openhands/usage/settings/mcp-settings",
				"https://docs.all-hands.dev/openhands/usage/configuration-options",
			],
			{
				skills: documented(["https://docs.openhands.dev/openhands/usage/customization/repository"]),
				mcp: documented(["https://docs.all-hands.dev/openhands/usage/settings/mcp-settings"]),
				workspace_config: documented(["https://docs.openhands.dev/openhands/usage/customization/repository"]),
				setup_scripts: documented(["https://docs.openhands.dev/openhands/usage/customization/repository"]),
			},
		),
	},
};

export const providerDocumentationContracts = providerCapabilityRegistry;

export function getProviderCapabilityContract(
	provider: ProviderType,
	capability: ProviderCapabilityName,
): ProviderSupportContract {
	return providerCapabilityRegistry[provider].capabilities[capability];
}

export function getProviderSurfaceContract(
	provider: ProviderType,
	type: PortableType,
): ProviderSupportContract {
	return (
		providerCapabilityRegistry[provider].surfaces[type] ?? {
			status: "unsupported",
			docs: providerCapabilityRegistry[provider].docs,
			note: "No officially documented migration surface was verified for this provider/type.",
		}
	);
}

export function hasProviderCapability(provider: ProviderType, capability: ProviderCapabilityName): boolean {
	return getProviderCapabilityContract(provider, capability).status === "documented";
}

export function supportsPortableSurface(provider: ProviderType, type: PortableType): boolean {
	return getProviderSurfaceContract(provider, type).status === "documented";
}

import type { ProviderCapabilityRegistryEntry } from "../contract-types.js";
import { LAST_VERIFIED, buildCapabilities, documented, partial } from "../contract-helpers.js";

// Verified against official Cursor docs on 2026-07-24
// (plans/reports/researcher-260724-2125-cursor-official-docs-verification.md).
const CURSOR_DOCS = [
	"https://cursor.com/docs/context/rules",
	"https://cursor.com/docs/agent/subagents",
	"https://cursor.com/docs/agent/hooks",
	"https://cursor.com/docs/context/skills",
	"https://cursor.com/docs/context/mcp",
];

const RULES_DOC = "https://cursor.com/docs/context/rules";
const AGENTS_DOC = "https://cursor.com/docs/agent/subagents";
const HOOKS_DOC = "https://cursor.com/docs/agent/hooks";
const SKILLS_DOC = "https://cursor.com/docs/context/skills";
const MCP_DOC = "https://cursor.com/docs/context/mcp";

export const cursorContract: ProviderCapabilityRegistryEntry = {
	docs: CURSOR_DOCS,
	lastVerified: LAST_VERIFIED,
	// `surfaces` = what mewkit's legacy .claude→.cursor CONVERTER installs today.
	// The converter writes rules/config as `.mdc` and projects delegation into rules;
	// it does NOT emit native `.cursor/agents/*.md` (so `agent` is `partial`) and emits
	// no hooks at all (so the `hooks` surface stays the default `unsupported`). Native
	// agents/hooks are the authored-bundle target for a later phase. `partial` keeps a
	// converter-unsupported surface out of the reconcile install plan
	// (shouldSkipUnsupportedSurface) without denying Cursor supports it natively — that
	// native support is asserted in `capabilities` below.
	surfaces: {
		config: documented([RULES_DOC]),
		rules: documented(
			[RULES_DOC],
			"Rules install as per-file `.mdc` with 3-field frontmatter (description, globs, alwaysApply).",
		),
		agent: partial(
			[AGENTS_DOC],
			"Legacy converter projects delegation into `.cursor/rules/*.mdc`; native `.cursor/agents/*.md` custom agents ship via the authored bundle, not this converter.",
		),
	},
	// `capabilities` = what Cursor the PLATFORM supports, verified against the docs
	// above — independent of whether the legacy converter targets each surface.
	capabilities: buildCapabilities(CURSOR_DOCS, {
		instruction_files: documented([RULES_DOC]),
		rules: documented(
			[RULES_DOC],
			"Project rules live under `.cursor/rules/*.mdc` with description/globs/alwaysApply frontmatter.",
		),
		hooks: documented(
			[HOOKS_DOC],
			"Native lifecycle hooks via `.cursor/hooks.json` (version 1), with `failClosed` for security gates.",
		),
		agents: documented(
			[AGENTS_DOC],
			"Custom agents via `.cursor/agents/*.md` frontmatter (name, description, model, readonly, is_background).",
		),
		skills: documented(
			[SKILLS_DOC],
			"Portable skills load from `.agents/skills/`; `.cursor/skills/` is documented as the legacy location.",
		),
		mcp: documented([MCP_DOC]),
		orchestration: documented(
			[AGENTS_DOC],
			"Subagents orchestrate up to a bounded nesting depth; a child agent cannot re-spawn.",
		),
		persistent_context: documented([RULES_DOC]),
		workspace_config: documented([RULES_DOC]),
		system_prompts: documented([RULES_DOC]),
	}),
};

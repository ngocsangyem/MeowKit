// Per-provider INVOCATION shapes (Phase 6 slice 2): the constant, provider-native operation each
// LOGICAL invocation id maps to. This is the security seam — provider-native operation strings
// live ONLY here (trusted adapter code), NEVER in the capability manifest, whose `invocation.id`
// stays a logical id (KNOWN_INVOCATION_IDS). Hostile frontmatter therefore cannot smuggle an
// executable command: it can name a logical id at most, and only this table turns that into an
// operation descriptor. Descriptors are DESCRIPTIVE (what the host does), not runnable strings.
import { KNOWN_INVOCATION_IDS } from "./capability.js";

export type InvocationSupport = "supported" | "advisory" | "unsupported" | "unknown";

export interface InvocationShape {
	/** The provider-native operation, described (not a runnable command). */
	operation: string;
	support: InvocationSupport;
	note: string;
}

/** Logical invocation ids ↔ their per-provider shape. Keys are the known logical ids. */
export type InvocationShapeMap = Record<string, InvocationShape>;

// Claude Code exposes typed primitives the current runtime confirms: a Skill tool, an Agent/Task
// tool, slash commands, and settings.json hook registration. A "workflow" is not a distinct host
// primitive — it runs as its entry skill/command — so invoke-workflow is honestly advisory.
const CLAUDE_CODE_INVOCATION: InvocationShapeMap = {
	"invoke-skill": { operation: "Skill tool (by skill name)", support: "supported", note: "host invokes the skill directly" },
	"invoke-agent": { operation: "Agent/Task tool (by agent type)", support: "supported", note: "host spawns the subagent" },
	"invoke-command": { operation: "slash command", support: "supported", note: "user- or model-invoked command" },
	"invoke-workflow": { operation: "entry skill/command composition", support: "advisory", note: "no distinct workflow primitive — runs as its entry skill" },
	"lifecycle-hook": { operation: "hook registered in settings.json", support: "supported", note: "host fires the hook on the mapped event" },
	none: { operation: "(not directly invocable)", support: "unsupported", note: "e.g. a describe-only tool or a hook capability" },
};

const CLAUDE_PLUGIN_INVOCATION: InvocationShapeMap = {
	...CLAUDE_CODE_INVOCATION,
	"invoke-command": { operation: "plugin slash command", support: "supported", note: "command shipped in the plugin payload" },
	"lifecycle-hook": { operation: "hook in the plugin payload (via build-plugin)", support: "supported", note: "propagated hook fires on the mapped event" },
};

// Codex reaches skills/commands/agents through its instruction/prompt projection (the migration
// contract), not typed invoke tools — so these are advisory, matching provider-projection's codex
// invocable=advisory. Hooks are version-gated (see provider-lifecycle).
const CODEX_INVOCATION: InvocationShapeMap = {
	"invoke-skill": { operation: "skill projected into the AGENTS instruction surface", support: "advisory", note: "prompt-projected, not a typed invoke tool" },
	"invoke-agent": { operation: "codex subagent surface", support: "advisory", note: "subagent exists (SubagentStart) but is not a typed invoke" },
	"invoke-command": { operation: "command projected into the instruction surface", support: "advisory", note: "prompt-projected" },
	"invoke-workflow": { operation: "instruction-surface composition", support: "advisory", note: "no workflow primitive" },
	"lifecycle-hook": { operation: "codex hook (config.toml)", support: "advisory", note: "version-gated (CODEX_MIN_SUPPORTED_VERSION 0.142)" },
	none: { operation: "(not directly invocable)", support: "unsupported", note: "describe-only / hook capability" },
};

const INVOCATION_BY_PROVIDER: Record<string, InvocationShapeMap> = {
	"claude-code": CLAUDE_CODE_INVOCATION,
	"claude-plugin": CLAUDE_PLUGIN_INVOCATION,
	codex: CODEX_INVOCATION,
};

/** An all-`unknown` invocation map for a provider with no tested projection (claims nothing). */
function unknownInvocation(): InvocationShapeMap {
	const out: InvocationShapeMap = {};
	for (const id of KNOWN_INVOCATION_IDS) {
		out[id] = { operation: "(unknown)", support: "unknown", note: "no tested invocation projection for this provider" };
	}
	return out;
}

/** The invocation-shape map for a provider, or an all-`unknown` report-only fallback. */
export function getInvocationShapes(provider: string): InvocationShapeMap {
	return INVOCATION_BY_PROVIDER[provider] ?? unknownInvocation();
}

/** The shape for one logical invocation id on a provider (unknown-fallback if unrecognized). */
export function getInvocationShape(provider: string, invocationId: string): InvocationShape {
	return getInvocationShapes(provider)[invocationId] ?? { operation: "(unknown)", support: "unknown", note: "unrecognized invocation id" };
}

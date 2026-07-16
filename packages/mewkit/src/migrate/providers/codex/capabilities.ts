// Codex CLI capability detection — version-keyed feature table for hook compatibility.
// Originally vendored from claudekit-cli (MIT). This is the canonical location;
// `../../codex-capabilities.ts` is a thin re-export shim for legacy import paths.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import semver from "semver";

const execFileAsync = promisify(execFile);

export type CodexHookEvent =
	| "SessionStart"
	| "SubagentStart"
	| "UserPromptSubmit"
	| "PreToolUse"
	| "PostToolUse"
	| "PermissionRequest"
	| "PreCompact"
	| "PostCompact"
	| "SubagentStop"
	| "Stop";

export interface CodexEventCapabilities {
	supported: boolean;
	supportsAdditionalContext: boolean;
	permissionDecisionValues?: string[];
	allowedMatchers?: string[];
}

export interface CodexCapabilities {
	version: string;
	events: Record<string, CodexEventCapabilities>;
	sessionStartMatchersOnly: string[];
	requiresFeatureFlag: boolean;
}

// Minimum Codex version this migration targets. Below this the hook surface is
// the 0.124-alpha feature-flag tier — deny-capable hooks (gate-enforcement,
// privacy-block) may be silently ignored, so the merger emits a hard WARN and
// records the minimum in the run report. No feature-flag path is built below it.
export const CODEX_MIN_SUPPORTED_VERSION = "0.142.0";

// Deny protocol (documented at https://developers.openai.com/codex/hooks):
// a PreToolUse command hook denies a tool call via any of:
//   1. {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}
//   2. {"decision":"block","reason":"..."}
//   3. exit code 2 + reason on stderr (direct parity with Claude's exit-2 convention)
// "Any deny decision overrides allow decisions from other hooks." Therefore the
// safety hooks (gate-enforcement.sh, privacy-block.sh) migrate as REAL blocking
// wrappers — their exit-2 semantics port directly through the generated wrapper.

/** True when the installed Codex version is at/above the supported hook tier. */
export function isCodexVersionSupported(version: string): boolean {
	const coerced = semver.coerce(version);
	const min = semver.coerce(CODEX_MIN_SUPPORTED_VERSION);
	if (!coerced || !min) return false;
	return semver.gte(coerced, min);
}

/** Read the installed Codex version string, or null when the binary is absent. */
export async function detectCodexVersion(): Promise<string | null> {
	if (process.env.MEWKIT_CODEX_COMPAT === "strict" || process.env.MEWKIT_CODEX_COMPAT === "optimistic") {
		return null;
	}
	try {
		const { stdout } = await execFileAsync("codex", ["--version"], { timeout: 5000, encoding: "utf8" });
		return stdout.trim().replace(/^(codex\s+)?v?/i, "").trim();
	} catch {
		return null;
	}
}

export const CODEX_CAPABILITY_TABLE: CodexCapabilities[] = [
	{
		// Hook surface as documented at developers.openai.com/codex/hooks
		// (verified 2026-07): 10 events, command handlers only, hooks enabled by
		// default (no [features] flag required).
		version: "0.142.0",
		events: {
			SessionStart: {
				supported: true,
				supportsAdditionalContext: true,
				allowedMatchers: ["startup", "resume"],
			},
			SubagentStart: {
				supported: true,
				supportsAdditionalContext: false,
			},
			UserPromptSubmit: {
				supported: true,
				supportsAdditionalContext: true,
			},
			PreToolUse: {
				supported: true,
				supportsAdditionalContext: false,
				permissionDecisionValues: ["deny"],
				allowedMatchers: ["Bash"],
			},
			PostToolUse: {
				supported: true,
				supportsAdditionalContext: true,
				allowedMatchers: ["Bash"],
			},
			PermissionRequest: {
				supported: true,
				supportsAdditionalContext: false,
				permissionDecisionValues: ["deny"],
				allowedMatchers: ["Bash"],
			},
			PreCompact: {
				supported: true,
				supportsAdditionalContext: false,
			},
			PostCompact: {
				supported: true,
				supportsAdditionalContext: false,
			},
			SubagentStop: {
				supported: true,
				supportsAdditionalContext: false,
			},
			Stop: {
				supported: true,
				supportsAdditionalContext: false,
			},
		},
		sessionStartMatchersOnly: ["startup", "resume"],
		requiresFeatureFlag: false,
	},
	{
		version: "0.124.0-alpha.3",
		events: {
			SessionStart: {
				supported: true,
				supportsAdditionalContext: true,
				allowedMatchers: ["startup", "resume"],
			},
			UserPromptSubmit: {
				supported: true,
				supportsAdditionalContext: true,
			},
			PreToolUse: {
				supported: true,
				supportsAdditionalContext: false,
				permissionDecisionValues: ["deny"],
				allowedMatchers: ["Bash"],
			},
			PostToolUse: {
				supported: true,
				supportsAdditionalContext: true,
				allowedMatchers: ["Bash"],
			},
			PermissionRequest: {
				supported: true,
				supportsAdditionalContext: false,
				permissionDecisionValues: ["deny"],
				allowedMatchers: ["Bash"],
			},
			Stop: {
				supported: true,
				supportsAdditionalContext: false,
			},
		},
		sessionStartMatchersOnly: ["startup", "resume"],
		requiresFeatureFlag: true,
	},
];

if (CODEX_CAPABILITY_TABLE.length > 1) {
	for (let i = 0; i < CODEX_CAPABILITY_TABLE.length - 1; i++) {
		const newer = semver.coerce(CODEX_CAPABILITY_TABLE[i].version);
		const older = semver.coerce(CODEX_CAPABILITY_TABLE[i + 1].version);
		if (newer && older && !semver.gte(newer, older)) {
			throw new Error(
				`[mewkit] CODEX_CAPABILITY_TABLE ordering violation: entry[${i}] must be >= entry[${i + 1}]`,
			);
		}
	}
}

const FALLBACK_CAPABILITIES: CodexCapabilities =
	CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];

export async function detectCodexCapabilities(): Promise<CodexCapabilities> {
	if (process.env.MEWKIT_CODEX_COMPAT === "strict") {
		return CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];
	}
	if (process.env.MEWKIT_CODEX_COMPAT === "optimistic") {
		return CODEX_CAPABILITY_TABLE[0];
	}

	try {
		const { stdout } = await execFileAsync("codex", ["--version"], {
			timeout: 5000,
			encoding: "utf8",
		});
		const raw = stdout.trim();
		const version = raw.replace(/^(codex\s+)?v?/i, "").trim();
		const match = findCapabilitiesForVersion(version);
		if (match) return match;

		return process.env.MEWKIT_CODEX_COMPAT === "optimistic"
			? CODEX_CAPABILITY_TABLE[0]
			: FALLBACK_CAPABILITIES;
	} catch {
		return process.env.MEWKIT_CODEX_COMPAT === "optimistic"
			? CODEX_CAPABILITY_TABLE[0]
			: FALLBACK_CAPABILITIES;
	}
}

function findCapabilitiesForVersion(version: string): CodexCapabilities | null {
	const exact = CODEX_CAPABILITY_TABLE.find((entry) => entry.version === version);
	if (exact) return exact;

	const coercedDetected = semver.coerce(version);
	if (!coercedDetected) return null;

	for (const entry of CODEX_CAPABILITY_TABLE) {
		const coercedEntry = semver.coerce(entry.version);
		if (!coercedEntry) continue;
		if (
			coercedDetected.major === coercedEntry.major &&
			coercedDetected.minor === coercedEntry.minor
		) {
			return entry;
		}
		if (semver.gte(coercedDetected, coercedEntry)) return entry;
	}

	return null;
}

export const CODEX_SUPPORTED_EVENTS = new Set<string>(
	Object.keys(CODEX_CAPABILITY_TABLE[0].events).filter(
		(e) => CODEX_CAPABILITY_TABLE[0].events[e].supported,
	),
);

// Vendored from claudekit-cli (MIT). Source: src/commands/portable/codex-capabilities.ts
// Codex CLI capability detection — version-keyed feature table for hook compatibility.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import semver from "semver";

const execFileAsync = promisify(execFile);

export type CodexHookEvent =
	| "SessionStart"
	| "UserPromptSubmit"
	| "PreToolUse"
	| "PostToolUse"
	| "PermissionRequest"
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

export const CODEX_CAPABILITY_TABLE: CodexCapabilities[] = [
	{
		version: "0.124.0-alpha.3",
		events: {
			SessionStart: {
				supported: true,
				supportsAdditionalContext: true,
				allowedMatchers: ["startup", "resume"],
			},
			UserPromptSubmit: { supported: true, supportsAdditionalContext: true },
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
			Stop: { supported: true, supportsAdditionalContext: false },
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

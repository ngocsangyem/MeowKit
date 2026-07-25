// Secret-emission + documented-interpolation-only lint for resolved Cursor MCP profiles, plus
// the missing-env-var diagnostic doctor-cursor-environment.ts reports on. Split out of
// cursor-mcp-profiles.ts (merge/apply logic) to keep each file under the project's 200-line
// guideline — this file owns "is this profile safe to write to disk", the sibling file owns
// "how a safe profile gets merged into a project".
import type { McpProfile } from "./cursor-mcp-profile-catalog.js";

/** Cursor's documented `${...}` interpolation vars beyond `${env:NAME}` (verified against
 *  cursor.com/docs/context/mcp — see plans/reports/researcher-260724-2125-*). */
export const DOCUMENTED_STATIC_INTERPOLATION_VARS = [
	"workspaceFolder",
	"workspaceFolderBasename",
	"userHome",
	"pathSeparator",
] as const;

const ENV_TOKEN_RE = /^\$\{env:[A-Z0-9_]+\}$/;
const ANY_TOKEN_RE = /\$\{[^}]*\}/g;
const DOCUMENTED_TOKEN_RE = new RegExp(
	`^\\$\\{(?:env:[A-Z0-9_]+|${DOCUMENTED_STATIC_INTERPOLATION_VARS.join("|")})\\}$`,
);
// Advisory heuristic for an obvious literal secret slipping into a non-`env` field
// (command/args/url/headers). Not exhaustive — a defense-in-depth guard, not a secret scanner.
const SECRET_LIKE_RE =
	/(sk-[a-zA-Z0-9]{10,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{10,}|AKIA[0-9A-Z]{12,}|[A-Za-z0-9+/]{32,}={0,2})/;

/** Every `${...}` interpolation token literally present in a string value. */
function interpolationTokens(value: string): string[] {
	return [...value.matchAll(ANY_TOKEN_RE)].map((m) => m[0]);
}

/**
 * Secret-emission + documented-interpolation-only lint for one resolved profile. Returns an
 * empty array when clean. `env` values are held to the strictest rule (a whole
 * `${env:NAME}` reference, nothing else) since `env` is the field a pasted literal secret is
 * most likely to land in; every other string field is checked for undocumented `${...}` tokens
 * and an obvious secret-shaped literal outside any token.
 */
export function lintMcpProfileForSecrets(name: string, profile: McpProfile): string[] {
	const issues: string[] = [];
	for (const [serverName, server] of Object.entries(profile.mcpServers)) {
		for (const [key, value] of Object.entries(server.env ?? {})) {
			if (!ENV_TOKEN_RE.test(value)) {
				issues.push(`${name}/${serverName}.env.${key}: must be a whole "\${env:NAME}" reference, got "${value}"`);
			}
		}
		const otherFields: Array<[string, string | undefined]> = [
			["command", server.command],
			["url", server.url],
			...(server.args ?? []).map((a, i): [string, string] => [`args[${i}]`, a]),
			...Object.entries(server.headers ?? {}).map(([k, v]): [string, string] => [`headers.${k}`, v]),
		];
		for (const [field, raw] of otherFields) {
			if (typeof raw !== "string") continue;
			for (const token of interpolationTokens(raw)) {
				if (!DOCUMENTED_TOKEN_RE.test(token)) {
					issues.push(`${name}/${serverName}.${field}: undocumented interpolation token "${token}"`);
				}
			}
			if (SECRET_LIKE_RE.test(raw.replace(ANY_TOKEN_RE, ""))) {
				issues.push(`${name}/${serverName}.${field}: value looks like a literal secret`);
			}
		}
	}
	return issues;
}

/** `${env:NAME}` names referenced by a profile that are unset in the current process env —
 *  the missing-env-var diagnostic surface doctor-cursor-environment.ts reports on. */
export function unresolvedEnvRefs(profile: McpProfile): string[] {
	const names = new Set<string>();
	for (const server of Object.values(profile.mcpServers)) {
		for (const value of Object.values(server.env ?? {})) {
			const m = value.match(/^\$\{env:([A-Z0-9_]+)\}$/);
			if (m && !process.env[m[1]]) names.add(m[1]);
		}
	}
	return [...names].sort();
}

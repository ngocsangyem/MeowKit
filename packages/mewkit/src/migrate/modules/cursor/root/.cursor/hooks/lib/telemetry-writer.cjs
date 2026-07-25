#!/usr/bin/env node
// Shared telemetry writer for every OBSERVE-class hook (telemetry-observers,
// subagent-lifecycle, stop-followup, session-context). Strips or hashes the
// documented PII fields (`user_email`, `transcript_path`, `conversation_id`,
// `agent_transcript_path`) AND redacts secret-shaped substrings in every OTHER
// string value (command, tool_input, tool_output, prompt, content, and any
// future field) before ANYTHING is persisted to `.meowkit/telemetry/` — never
// `.cursor/`. Best-effort: a write failure is swallowed because every caller of
// this module is a fail-open hook (telemetry must never block a turn).
"use strict";
const { existsSync, mkdirSync, appendFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join } = require("node:path");

/** Hash a PII string value with a fixed-length, non-reversible digest so
 *  telemetry can still correlate same-value events without persisting the raw
 *  identifier. Returns undefined (dropped) for a non-string/empty value — never
 *  writes an "undefined" placeholder. */
function hashPii(value) {
	if (typeof value !== "string" || !value) return undefined;
	return `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

// Secret-shaped-value patterns, ported verbatim from the repo's canonical
// secret-scrub source (src/state/injection-scanner.ts SECRET_PATTERNS /
// scrubSecrets — that file's own header documents this exact mirroring
// convention for standalone hook `.cjs` scripts, which have no build step and
// so cannot `import` the compiled TS module). Mirror that source when its
// patterns change. Each entry is [matcher, replacement].
const SECRET_PATTERNS = [
	[/sk-ant-[A-Za-z0-9_-]{20,}/g, "[REDACTED-ANTHROPIC-KEY]"],
	[/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED-OPENAI-KEY]"],
	[/sk_(live|test)_[A-Za-z0-9]{16,}/g, "[REDACTED-STRIPE-KEY]"],
	[/rk_(live|test)_[A-Za-z0-9]{16,}/g, "[REDACTED-STRIPE-RESTRICTED-KEY]"],
	[/pk_(live|test)_[A-Za-z0-9]{16,}/g, "[REDACTED-STRIPE-PUB-KEY]"],
	[/AKIA[0-9A-Z]{16}/g, "[REDACTED-AWS-KEY]"],
	[/ghp_[A-Za-z0-9]{30,}/g, "[REDACTED-GH-TOKEN]"],
	[/gho_[A-Za-z0-9]{30,}/g, "[REDACTED-GH-OAUTH]"],
	[/glpat-[A-Za-z0-9_-]{20,}/g, "[REDACTED-GITLAB-PAT]"],
	[/xox[bpars]-[0-9]+-[0-9]+-[0-9]+-[A-Za-z0-9]{24,}/g, "[REDACTED-SLACK-TOKEN]"],
	[/https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]+/g, "[REDACTED-SLACK-WEBHOOK]"],
	[/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[REDACTED-JWT]"],
	[/-----BEGIN [A-Z ]*PRIVATE KEY-----[^-]*-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED-PRIVATE-KEY]"],
	[/(api[_-]?key|apikey|password|passwd|secret|token)(\s*[:=]\s*)["']?[A-Za-z0-9_/+=.-]{16,}["']?/gi, "$1$2[REDACTED]"],
	[/Bearer [A-Za-z0-9_/+=.-]{20,}/g, "Bearer [REDACTED]"],
	[/(mysql|postgres|postgresql|mongodb|redis):\/\/[^\s"']+/gi, "$1://[REDACTED-DB-URL]"],
	[/[A-Za-z0-9._%+-]{3,}@[A-Za-z0-9.-]{3,}\.[A-Za-z]{2,}/g, "[REDACTED-EMAIL]"],
	[/(MEOWKIT_[A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD))(\s*=\s*)\S{8,}/g, "$1$2[REDACTED]"],
];

/** Redact every secret-shaped substring in one string value. */
function scrubSecretString(value) {
	if (typeof value !== "string" || !value) return value;
	let out = value;
	for (const [re, replacement] of SECRET_PATTERNS) out = out.replace(re, replacement);
	return out;
}

// Bounded recursion depth: telemetry payloads are shallow, hook-generated JSON
// (tool_input/tool_output objects), never arbitrarily deep user structures —
// this guard only prevents a pathological/cyclic-looking payload from spinning.
const MAX_SCRUB_DEPTH = 12;

/** Recursively redact every string value (at any nesting depth, inside objects
 *  and arrays alike) so a secret embedded in `command`, `tool_input`,
 *  `tool_output`, `prompt`, `content`, or ANY other field — named or not — is
 *  redacted before persistence, not just a fixed list of top-level keys. */
function scrubSecretsDeep(value, depth = 0) {
	if (depth > MAX_SCRUB_DEPTH) return value;
	if (typeof value === "string") return scrubSecretString(value);
	if (Array.isArray(value)) return value.map((v) => scrubSecretsDeep(v, depth + 1));
	if (value && typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) out[k] = scrubSecretsDeep(v, depth + 1);
		return out;
	}
	return value;
}

/**
 * Strip or hash every documented PII field, then secret-redact every remaining
 * string value (recursively), before an event is persisted. `transcript_path` /
 * `agent_transcript_path` are DROPPED entirely — a hash of a filesystem path
 * still leaks path-shaped, unbounded-length identifying data, so hashing is not
 * sufficient for those two. `user_email` / `conversation_id` are hashed so
 * cross-event correlation stays possible without storing the raw value. Every
 * OTHER field (`command`, `tool_input`, `tool_output`, `prompt`, `content`, …)
 * goes through `scrubSecretsDeep` so a secret embedded in any of them is
 * redacted, not just PII-named fields.
 */
function scrubPii(event) {
	if (!event || typeof event !== "object") return {};
	const out = {};
	for (const [key, value] of Object.entries(event)) {
		if (key === "transcript_path" || key === "agent_transcript_path") continue;
		if (key === "user_email" || key === "conversation_id") {
			const hashed = hashPii(value);
			if (hashed) out[key] = hashed;
			continue;
		}
		out[key] = scrubSecretsDeep(value);
	}
	return out;
}

function telemetryDir(root) {
	return join(root, ".meowkit", "telemetry");
}

/** Append one scrubbed JSONL event to `.meowkit/telemetry/<file>`. Never throws
 *  — telemetry is observational only. */
function appendTelemetry(root, file, event) {
	try {
		const dir = telemetryDir(root);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		const record = { ts: new Date().toISOString(), ...scrubPii(event) };
		appendFileSync(join(dir, file), `${JSON.stringify(record)}\n`, "utf-8");
	} catch {
		/* best-effort; never throw from a fail-open hook */
	}
}

module.exports = { appendTelemetry, scrubPii, hashPii, telemetryDir, scrubSecretsDeep, scrubSecretString, SECRET_PATTERNS };

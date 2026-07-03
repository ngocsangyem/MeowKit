// Vendored from claudekit-cli (MIT). Source: src/commands/portable/codex-hook-wrapper.ts
// Generates per-hook .cjs wrapper that scrubs Claude-only fields from hook stdout
// before re-emitting to Codex stdout. Wrapper is self-contained — no mewkit imports at runtime.
//
// `.sh` handlers additionally get their script COPIED under the wrapper tree
// (`scripts/`) so the migrated hook has no dependency on the source `.claude/`
// tree remaining in place (self-contained migration). See codex-sh-wrapper-script.ts.
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { CodexCapabilities } from "../codex-capabilities.js";
import { buildShWrapperScript } from "./codex-sh-wrapper-script.js";
import { isPathWithinBoundary } from "./codex-path-safety.js";

export interface WrapperGenerateResult {
	wrapperPath: string;
	originalPath: string;
	/** Handler runtime type this wrapper was generated for. */
	handlerType: "js" | "sh";
	/** For sh handlers: the copied script under the wrapper tree (self-contained). */
	copiedScriptPath?: string;
	success: boolean;
	error?: string;
}

/** Per-original wrapper generation input. */
export interface WrapperGenerateInput {
	originalPath: string;
	handlerType: "js" | "sh";
}

function wrapperFilename(originalPath: string): string {
	const abs = resolve(originalPath);
	const hash = createHash("sha256").update(abs).digest("hex").slice(0, 8);
	const base = abs.split(/[\\/]/).pop() ?? "hook.cjs";
	// Shell handlers get a .cjs wrapper filename (the node wrapper), not .sh.
	if (extname(base).toLowerCase() === ".sh") {
		return `${hash}-${base.slice(0, -3)}.cjs`;
	}
	return `${hash}-${base}`;
}

function copiedScriptFilename(originalPath: string): string {
	const abs = resolve(originalPath);
	const hash = createHash("sha256").update(abs).digest("hex").slice(0, 8);
	return `${hash}-${basename(abs)}`;
}

/** Build the delete/permission scrub rules table shared by js + sh wrappers. */
function buildScrubRules(capabilities: CodexCapabilities): Record<string, EventScrubRules> {
	const scrubRules: Record<string, EventScrubRules> = {};
	for (const [event, caps] of Object.entries(capabilities.events)) {
		const deleteFields: string[] = [];
		if (!caps.supportsAdditionalContext) deleteFields.push("additionalContext");
		const allowedPermissionValues = caps.permissionDecisionValues ?? null;
		if (deleteFields.length > 0 || allowedPermissionValues !== null) {
			scrubRules[event] = { deleteFields, allowedPermissionValues };
		}
	}
	return scrubRules;
}

/**
 * Generate one wrapper per handler. Accepts either the legacy string[] form
 * (all treated as `js`) or the richer WrapperGenerateInput[] form that carries
 * each handler's runtime type so `.sh` handlers get the copy-script + sh wrapper.
 */
export function generateCodexHookWrappers(
	originals: string[] | WrapperGenerateInput[],
	wrapperDir: string,
	capabilities: CodexCapabilities,
	timeoutsByPath?: Record<string, number>,
): WrapperGenerateResult[] {
	const results: WrapperGenerateResult[] = [];
	const resolvedWrapperDir = resolve(wrapperDir);
	const inputs: WrapperGenerateInput[] = normalizeInputs(originals);

	for (const { originalPath, handlerType } of inputs) {
		const filename = wrapperFilename(originalPath);
		const wrapperPath = join(resolvedWrapperDir, filename);

		if (!isPathWithinBoundary(wrapperPath, resolvedWrapperDir)) {
			results.push({
				wrapperPath,
				originalPath,
				handlerType,
				success: false,
				error: `Unsafe wrapper path: ${wrapperPath} escapes ${resolvedWrapperDir}`,
			});
			continue;
		}

		try {
			mkdirSync(dirname(wrapperPath), { recursive: true });
			const resolvedPath = resolve(originalPath);
			const hookTimeoutMs = timeoutsByPath?.[resolvedPath] ?? timeoutsByPath?.[originalPath];

			if (handlerType === "sh") {
				const scriptsDir = join(resolvedWrapperDir, "scripts");
				const copiedScriptPath = join(scriptsDir, copiedScriptFilename(originalPath));
				if (!isPathWithinBoundary(copiedScriptPath, resolvedWrapperDir)) {
					throw new Error(`Unsafe copied-script path: ${copiedScriptPath} escapes ${resolvedWrapperDir}`);
				}
				mkdirSync(scriptsDir, { recursive: true });
				copyFileSync(resolvedPath, copiedScriptPath);
				try {
					// Preserve the original script's executable bits where present.
					const mode = statSync(resolvedPath).mode & 0o777;
					if (mode & 0o100) chmodSync(copiedScriptPath, mode);
				} catch {
					/* best-effort mode copy */
				}
				const content = buildShWrapperScript(originalPath, {
					copiedScriptPath,
					scrubRulesJson: JSON.stringify(buildScrubRules(capabilities)),
					timeoutMs: hookTimeoutMs ?? 30000,
				});
				writeFileSync(wrapperPath, content, { mode: 0o755 });
				results.push({ wrapperPath, originalPath, handlerType, copiedScriptPath, success: true });
			} else {
				const content = buildWrapperScript(originalPath, capabilities, hookTimeoutMs);
				writeFileSync(wrapperPath, content, { mode: 0o755 });
				results.push({ wrapperPath, originalPath, handlerType, success: true });
			}
		} catch (err) {
			results.push({
				wrapperPath,
				originalPath,
				handlerType,
				success: false,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return results;
}

function normalizeInputs(originals: string[] | WrapperGenerateInput[]): WrapperGenerateInput[] {
	return (originals as unknown[]).map((entry) => {
		if (typeof entry === "string") {
			return { originalPath: entry, handlerType: extname(entry).toLowerCase() === ".sh" ? "sh" : "js" };
		}
		return entry as WrapperGenerateInput;
	});
}

interface EventScrubRules {
	deleteFields: string[];
	allowedPermissionValues: string[] | null;
}

export function buildWrapperScript(
	originalPath: string,
	capabilities: CodexCapabilities,
	hookTimeoutMs?: number,
): string {
	const scrubRules: Record<string, EventScrubRules> = {};
	for (const [event, caps] of Object.entries(capabilities.events)) {
		const deleteFields: string[] = [];
		if (!caps.supportsAdditionalContext) deleteFields.push("additionalContext");
		const allowedPermissionValues = caps.permissionDecisionValues ?? null;
		if (deleteFields.length > 0 || allowedPermissionValues !== null) {
			scrubRules[event] = { deleteFields, allowedPermissionValues };
		}
	}

	const escapedOriginalPath = JSON.stringify(originalPath);
	const scrubRulesJson = JSON.stringify(scrubRules);
	const effectiveTimeout = hookTimeoutMs ?? 30000;

	return `#!/usr/bin/env node
// AUTO-GENERATED by the migration tooling — DO NOT EDIT
// Codex hook compatibility wrapper for:
//   ${originalPath}
"use strict";

const { spawnSync } = require("node:child_process");

const ORIGINAL_HOOK = ${escapedOriginalPath};
const SCRUB_RULES = ${scrubRulesJson};
const HOOK_TIMEOUT_MS = ${effectiveTimeout};

function getEventFromStdin(stdinData) {
  try {
    const parsed = JSON.parse(stdinData);
    return parsed.hook_event_name || parsed.event || null;
  } catch {
    return null;
  }
}

function sanitizeOutput(obj, rules) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const result = Object.assign({}, obj);
  for (const field of rules.deleteFields) delete result[field];
  if (rules.allowedPermissionValues !== null) {
    const allowed = new Set(rules.allowedPermissionValues);
    if (result.permissionDecision !== undefined && !allowed.has(result.permissionDecision)) {
      delete result.permissionDecision;
    }
    if (result.decision !== undefined && !allowed.has(result.decision)) delete result.decision;
  }
  return result;
}

function eventSupportsDeny(rules) {
  if (!rules || rules.allowedPermissionValues === null) return false;
  return rules.allowedPermissionValues.indexOf("deny") !== -1;
}

function emitDeny(reason) {
  process.stdout.write(JSON.stringify({
    permissionDecision: "deny",
    reason: reason && reason.length > 0 ? reason : "Hook blocked this operation",
  }));
  process.exit(0);
}

function main() {
  const stdinChunks = [];
  process.stdin.on("data", (chunk) => stdinChunks.push(chunk));
  process.stdin.on("end", () => {
    const stdinData = Buffer.concat(stdinChunks).toString("utf8");
    const event = getEventFromStdin(stdinData);
    const rules = event && SCRUB_RULES[event];

    const result = spawnSync(process.execPath, [ORIGINAL_HOOK], {
      input: stdinData,
      env: process.env,
      encoding: "utf8",
      timeout: HOOK_TIMEOUT_MS,
    });

    if (result.error) {
      if (result.stderr) process.stderr.write(result.stderr);
      process.exit(1);
    }

    const stderrText = (result.stderr || "").toString();
    const rawOutput = (result.stdout || "").toString();
    const exitCode = result.status ?? 1;
    const isBlockSignal = exitCode === 2 && eventSupportsDeny(rules);

    if (!rawOutput.trim()) {
      if (isBlockSignal) return emitDeny(stderrText.trim());
      if (stderrText) process.stderr.write(stderrText);
      process.exit(exitCode);
    }

    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      if (isBlockSignal) {
        const reason = rawOutput.trim() || stderrText.trim();
        return emitDeny(reason);
      }
      if (stderrText) process.stderr.write(stderrText);
      process.stdout.write(rawOutput);
      process.exit(exitCode);
    }

    if (stderrText) process.stderr.write(stderrText);

    const sanitized = rules ? sanitizeOutput(parsed, rules) : parsed;

    if (isBlockSignal && (!sanitized || sanitized.permissionDecision !== "deny")) {
      return emitDeny(stderrText.trim());
    }

    process.stdout.write(JSON.stringify(sanitized));
    process.exit(isBlockSignal ? 0 : exitCode);
  });
}

main();
`;
}

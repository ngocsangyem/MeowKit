// Merges the generated [shell_environment_policy] scaffold into .codex/config.toml
// inside a sentinel-managed block, so re-runs replace the block instead of
// duplicating it and user-authored config stays untouched. Mirrors the
// codex-mcp-installer sentinel pattern.
//
// SECURITY (injection-rules Rule 4/5): the scaffold text passed in contains ONLY
// inert placeholder values and non-secret key NAMES (secret-like names are already
// excluded upstream by emitShellEnvPolicyScaffold). No `.env` value ever reaches
// this module.

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { getCodexGlobalBoundary, isCanonicalPathWithinBoundary, withCodexTargetLock } from "./codex-path-safety.js";

const SENTINEL_START = "# --- managed-shell-env-policy-start ---";
const SENTINEL_END = "# --- managed-shell-env-policy-end ---";

export interface CodexShellEnvInstallResult {
	success: boolean;
	configPath: string;
	error?: string;
}

async function atomicWrite(target: string, content: string): Promise<void> {
	const dir = dirname(target);
	if (!existsSync(dir)) await mkdir(dir, { recursive: true });
	const tmp = `${target}.tmp-${process.pid}`;
	try {
		await writeFile(tmp, content, "utf-8");
		await rename(tmp, target);
	} catch (err) {
		try {
			await unlink(tmp);
		} catch {
			/* best-effort */
		}
		throw err;
	}
}

function stripManagedBlock(content: string): string {
	const startIdx = content.indexOf(SENTINEL_START);
	if (startIdx === -1) return content;
	const endIdx = content.indexOf(SENTINEL_END, startIdx);
	if (endIdx === -1) return content;
	const blockEnd = endIdx + SENTINEL_END.length;
	const after = content[blockEnd] === "\n" ? blockEnd + 1 : blockEnd;
	let before = startIdx;
	if (before > 0 && content[before - 1] === "\n") before -= 1;
	return content.slice(0, before) + content.slice(after);
}

/**
 * Install (or, when scaffold is empty, remove) the managed shell-env-policy block.
 * An empty scaffold means there is nothing safe to write, so the block is stripped
 * — keeping re-runs idempotent whether or not a `.claude/.env` exists.
 */
export async function installCodexShellEnvPolicy(
	scaffoldToml: string,
	options: { global: boolean },
): Promise<CodexShellEnvInstallResult> {
	const codexRoot = options.global ? getCodexGlobalBoundary() : join(process.cwd(), ".codex");
	const configPath = join(codexRoot, "config.toml");

	if (!(await isCanonicalPathWithinBoundary(configPath, resolve(codexRoot)))) {
		return { success: false, configPath, error: "Unsafe path: config.toml escapes the .codex boundary" };
	}

	return withCodexTargetLock(configPath, async () => {
		try {
			let existing = "";
			if (existsSync(configPath)) existing = await readFile(configPath, "utf-8");

			const stripped = stripManagedBlock(existing);
			if (scaffoldToml.trim().length === 0) {
				// Nothing to scaffold: only rewrite if we actually removed a stale block.
				if (stripped !== existing) await atomicWrite(configPath, stripped);
				return { success: true, configPath };
			}

			const block = `${SENTINEL_START}\n${scaffoldToml.trimEnd()}\n${SENTINEL_END}\n`;
			const separator = stripped.length === 0 ? "" : stripped.endsWith("\n") ? "\n" : "\n\n";
			await atomicWrite(configPath, `${stripped}${separator}${block}`);
			return { success: true, configPath };
		} catch (err) {
			return { success: false, configPath, error: err instanceof Error ? err.message : String(err) };
		}
	});
}

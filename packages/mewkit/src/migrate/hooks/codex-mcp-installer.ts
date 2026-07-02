// Merges converted [mcp_servers] TOML into .codex/config.toml inside a
// sentinel-managed block, so re-runs replace the block instead of duplicating
// entries and user-authored config stays untouched.

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { getCodexGlobalBoundary, isCanonicalPathWithinBoundary, withCodexTargetLock } from "./codex-path-safety.js";

const SENTINEL_START = "# --- managed-mcp-servers-start ---";
const SENTINEL_END = "# --- managed-mcp-servers-end ---";

export interface CodexMcpInstallResult {
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

export async function installCodexMcpServers(
	mcpServersToml: string,
	options: { global: boolean },
): Promise<CodexMcpInstallResult> {
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
			const block = `${SENTINEL_START}\n${mcpServersToml.trimEnd()}\n${SENTINEL_END}\n`;
			const separator = stripped.length === 0 ? "" : stripped.endsWith("\n") ? "\n" : "\n\n";
			await atomicWrite(configPath, `${stripped}${separator}${block}`);
			return { success: true, configPath };
		} catch (err) {
			return { success: false, configPath, error: err instanceof Error ? err.message : String(err) };
		}
	});
}

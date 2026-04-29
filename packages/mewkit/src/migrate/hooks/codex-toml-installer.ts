// Adapted from claudekit-cli (MIT). Source: src/commands/portable/codex-toml-installer.ts
// Lean version: writes per-agent .toml files + merges sentinel-bracketed [agents.X] block
// into config.toml. Drops dashboard-UI integration and the broader claudekit feature set.
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { computeContentChecksum } from "../reconcile/checksum-utils.js";
import { buildCodexConfigEntry } from "../converters/fm-to-codex-toml.js";
import { convertItem } from "../converters/index.js";
import { addPortableInstallation, removePortableInstallation } from "../reconcile/portable-registry.js";
import { providers } from "../provider-registry.js";
import type { PortableItem, ProviderType } from "../types.js";
import {
	getCodexGlobalBoundary,
	isCanonicalPathWithinBoundary,
	withCodexTargetLock,
} from "./codex-path-safety.js";

const SENTINEL_START = "# --- mewkit-managed-agents-start ---";
const SENTINEL_END = "# --- mewkit-managed-agents-end ---";

export interface CodexInstallResult {
	provider: ProviderType;
	success: boolean;
	written: number;
	error?: string;
}

async function ensureDir(filePath: string): Promise<void> {
	const dir = dirname(filePath);
	if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function atomicWrite(target: string, content: string): Promise<void> {
	await ensureDir(target);
	const tmp = `${target}.mewkit-tmp-${process.pid}`;
	try {
		await writeFile(tmp, content, "utf-8");
		await rename(tmp, target);
	} catch (err) {
		try { await unlink(tmp); } catch { /* best-effort */ }
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

function buildManagedBlock(entries: string[]): string {
	if (entries.length === 0) return "";
	return `${SENTINEL_START}\n${entries.join("\n\n")}\n${SENTINEL_END}\n`;
}

/**
 * Install Codex agents: write per-agent .toml + merge managed block in config.toml.
 * Atomic per-file; transactional rollback if config.toml merge fails.
 */
export async function installCodexAgents(
	agents: PortableItem[],
	options: { global: boolean },
): Promise<CodexInstallResult> {
	const config = providers.codex.agents;
	if (!config) {
		return { provider: "codex", success: false, written: 0, error: "Codex agents not configured" };
	}

	const agentsDir = options.global ? config.globalPath : config.projectPath;
	if (!agentsDir) {
		return { provider: "codex", success: false, written: 0, error: "No Codex agents path" };
	}

	const codexRoot = options.global ? getCodexGlobalBoundary() : resolve(dirname(agentsDir));
	const configTomlPath = options.global
		? join(getCodexGlobalBoundary(), "config.toml")
		: join(resolve(dirname(agentsDir)), "config.toml");

	if (!(await isCanonicalPathWithinBoundary(agentsDir, codexRoot))) {
		return { provider: "codex", success: false, written: 0, error: "Unsafe Codex path" };
	}

	return withCodexTargetLock(configTomlPath, async () => {
		const writtenFiles: string[] = [];
		const entries: string[] = [];

		try {
			for (const agent of agents) {
				const result = convertItem(agent, "fm-to-codex-toml", "codex");
				if (result.error) continue;
				const targetPath = join(agentsDir, result.filename);
				await atomicWrite(targetPath, result.content);
				writtenFiles.push(targetPath);

				const sourceChecksum = computeContentChecksum(agent.body);
				const targetChecksum = computeContentChecksum(result.content);
				await addPortableInstallation(
					agent.name, "agent", "codex", options.global, targetPath, agent.sourcePath,
					{ sourceChecksum, targetChecksum, installSource: "kit" },
				);

				entries.push(buildCodexConfigEntry(agent.name, agent.description));
			}

			let configContent = "";
			if (existsSync(configTomlPath)) {
				configContent = await readFile(configTomlPath, "utf-8");
			}

			const stripped = stripManagedBlock(configContent);
			const block = buildManagedBlock(entries);
			const separator = stripped.length === 0 ? "" : stripped.endsWith("\n") ? "\n" : "\n\n";
			const merged = block ? `${stripped}${separator}${block}` : stripped;

			await atomicWrite(configTomlPath, merged);

			return { provider: "codex" as ProviderType, success: true, written: writtenFiles.length };
		} catch (err) {
			// Best-effort rollback: delete files we wrote and registry entries we added
			for (const path of writtenFiles) {
				try { await unlink(path); } catch { /* ignore */ }
			}
			for (const agent of agents) {
				try {
					await removePortableInstallation(agent.name, "agent", "codex", options.global);
				} catch { /* ignore */ }
			}
			return {
				provider: "codex",
				success: false,
				written: writtenFiles.length,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	});
}

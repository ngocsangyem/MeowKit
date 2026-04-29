// Vendored from claudekit-cli (MIT). Source: src/commands/portable/codex-features-flag.ts
// Idempotently ensures `[features] codex_hooks = true` in ~/.codex/config.toml.
// Sentinel renamed: ck-managed → mewkit-managed.
import { existsSync } from "node:fs";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
	getCodexGlobalBoundary,
	isCanonicalPathWithinBoundary,
	withCodexTargetLock,
} from "./codex-path-safety.js";

const SENTINEL_START = "# --- mewkit-managed-features-start ---";
const SENTINEL_END = "# --- mewkit-managed-features-end ---";

const MANAGED_BLOCK = `${SENTINEL_START}
[features]
codex_hooks = true
${SENTINEL_END}`;

export type FeatureFlagWriteStatus = "written" | "updated" | "already-set" | "failed";

export interface FeatureFlagWriteResult {
	status: FeatureFlagWriteStatus;
	configPath: string;
	error?: string;
}

export async function ensureCodexHooksFeatureFlag(
	configTomlPath: string,
	isGlobal = false,
): Promise<FeatureFlagWriteResult> {
	const boundary = isGlobal ? getCodexGlobalBoundary() : dirname(resolve(configTomlPath));
	if (!(await isCanonicalPathWithinBoundary(dirname(resolve(configTomlPath)), boundary))) {
		return {
			status: "failed",
			configPath: configTomlPath,
			error: `Unsafe path: config.toml target escapes Codex boundary (${boundary})`,
		};
	}

	return withCodexTargetLock(configTomlPath, () => ensureFlagLocked(configTomlPath));
}

async function ensureFlagLocked(configTomlPath: string): Promise<FeatureFlagWriteResult> {
	let existing = "";
	if (existsSync(configTomlPath)) {
		try {
			existing = await readFile(configTomlPath, "utf8");
		} catch (err) {
			return {
				status: "failed", configPath: configTomlPath,
				error: `Failed to read ${configTomlPath}: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}

	const { content: stripped, removed: hadManagedBlock } = stripAllManagedBlocks(existing);
	let content = stripped;
	let mutated = hadManagedBlock;

	const featuresHeaderIdx = findFeaturesSectionStart(content);

	if (featuresHeaderIdx !== -1) {
		const { updated, changed } = ensureFlagInFeaturesSection(content, featuresHeaderIdx);
		content = updated;
		mutated = mutated || changed;

		if (!mutated) return { status: "already-set", configPath: configTomlPath };

		try {
			await atomicWrite(configTomlPath, content);
		} catch (err) {
			return {
				status: "failed", configPath: configTomlPath,
				error: `Failed to write ${configTomlPath}: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
		return { status: "updated", configPath: configTomlPath };
	}

	const separator = content.length === 0 ? "" : content.endsWith("\n") ? "\n" : "\n\n";
	const withBlock = `${content}${separator}${MANAGED_BLOCK}\n`;

	try {
		await atomicWrite(configTomlPath, withBlock);
	} catch (err) {
		return {
			status: "failed", configPath: configTomlPath,
			error: `Failed to write ${configTomlPath}: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	return { status: hadManagedBlock ? "updated" : "written", configPath: configTomlPath };
}

function findFeaturesSectionStart(content: string): number {
	const match = /^[ \t]*\[features\][ \t]*(?:#[^\r\n]*)?$/m.exec(content);
	return match ? match.index : -1;
}

function ensureFlagInFeaturesSection(
	content: string,
	headerStartIdx: number,
): { updated: string; changed: boolean } {
	const headerLineEnd = content.indexOf("\n", headerStartIdx);
	const bodyStart = headerLineEnd === -1 ? content.length : headerLineEnd + 1;

	const rest = content.slice(bodyStart);
	const nextHeaderMatch = /\n\[[^\]]+\]/.exec(rest);
	const bodyEnd = nextHeaderMatch ? bodyStart + nextHeaderMatch.index + 1 : content.length;

	const body = content.slice(bodyStart, bodyEnd);
	const flagRegex = /^([ \t]*codex_hooks[ \t]*=[ \t]*)(true|false)([ \t]*#[^\r\n]*)?[ \t]*$/m;
	const flagMatch = flagRegex.exec(body);

	if (flagMatch) {
		if (flagMatch[2] === "true") return { updated: content, changed: false };
		const newBody = body.replace(
			flagRegex,
			(_m, prefix, _v, trailing) => `${prefix}true${trailing ?? ""}`,
		);
		return {
			updated: content.slice(0, bodyStart) + newBody + content.slice(bodyEnd),
			changed: true,
		};
	}

	if (headerLineEnd === -1) {
		return { updated: `${content}\ncodex_hooks = true\n`, changed: true };
	}

	let insertAt = bodyEnd;
	while (insertAt > bodyStart && content[insertAt - 1] === "\n" && content[insertAt - 2] === "\n") {
		insertAt -= 1;
	}
	const needsLeadingNewline = insertAt > bodyStart && content[insertAt - 1] !== "\n";
	const insertion = `${needsLeadingNewline ? "\n" : ""}codex_hooks = true\n`;

	return {
		updated: content.slice(0, insertAt) + insertion + content.slice(insertAt),
		changed: true,
	};
}

function stripAllManagedBlocks(content: string): { content: string; removed: boolean } {
	let result = content;
	let removed = false;

	while (true) {
		const startIdx = result.indexOf(SENTINEL_START);
		if (startIdx === -1) break;
		const endIdx = result.indexOf(SENTINEL_END, startIdx);
		if (endIdx === -1) break;

		const endOfBlock = endIdx + SENTINEL_END.length;
		const afterBlockStart = result[endOfBlock] === "\n" ? endOfBlock + 1 : endOfBlock;

		let beforeBlockEnd = startIdx;
		if (beforeBlockEnd >= 1 && result[beforeBlockEnd - 1] === "\n") {
			beforeBlockEnd -= 1;
			if (beforeBlockEnd >= 1 && result[beforeBlockEnd - 1] === "\n") beforeBlockEnd -= 1;
			beforeBlockEnd += 1;
		}

		result = result.slice(0, beforeBlockEnd) + result.slice(afterBlockStart);
		removed = true;
	}

	return { content: result, removed };
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
	const tempPath = `${filePath}.mewkit-tmp`;
	try {
		await writeFile(tempPath, content, "utf8");
		await rename(tempPath, filePath);
	} catch (err) {
		try { await unlink(tempPath); } catch { /* ignore */ }
		throw err;
	}
}

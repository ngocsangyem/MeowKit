// Provider-native projection of the small capability bootstrap. This is deliberately separate
// from the generic portable-item merger: it is trusted CLI-owned instruction text, not a source
// artifact supplied by a project. The marker makes replacement idempotent and preserves all
// user-authored AGENTS.md content outside this bounded region.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderBootstrap, BOOTSTRAP_END, BOOTSTRAP_START } from "../core/bootstrap.js";
import { capabilityManifestFromClaude, CODEX_CAPABILITY_SNAPSHOT_FILENAME } from "../core/capability-snapshot.js";
import { getCodexRoot } from "./hooks/codex-path-safety.js";
import { atomicWrite, validateWritableTargetPath } from "./portable-installer-path-safety.js";

export interface CapabilityProjectionResult {
	success: boolean;
	agentsPath: string;
	snapshotPath: string;
	error?: string;
}

function region(): string {
	return `${BOOTSTRAP_START}\n${renderBootstrap("codex")}\n${BOOTSTRAP_END}`;
}

export function mergeCodexCapabilityBootstrap(existing: string): string {
	const escapedStart = BOOTSTRAP_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const escapedEnd = BOOTSTRAP_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const withoutPrior = existing.replace(new RegExp(`\\s*${escapedStart}[\\s\\S]*?${escapedEnd}\\s*`, "g"), "").trim();
	const block = region();
	const heading = withoutPrior.match(/^(#\s+AGENTS(?:\.md)?\s*\n?)/i);
	if (heading?.[0]) {
		return `${heading[0].trimEnd()}\n\n${block}${withoutPrior.slice(heading[0].length) ? `\n\n${withoutPrior.slice(heading[0].length).trimStart()}` : ""}\n`;
	}
	return `${block}${withoutPrior ? `\n\n${withoutPrior}` : ""}\n`;
}

export async function installCodexCapabilityProjection(
	sourceClaudeDir: string,
	options: { global: boolean },
): Promise<CapabilityProjectionResult> {
	const codexRoot = getCodexRoot(options);
	const agentsPath = options.global ? join(codexRoot, "AGENTS.md") : join(process.cwd(), "AGENTS.md");
	const snapshotPath = join(codexRoot, CODEX_CAPABILITY_SNAPSHOT_FILENAME);
	try {
		// Build before mutating AGENTS.md: if source enumeration is malformed, do not leave an
		// instruction that points at a snapshot which was never written.
		const snapshotContent = `${JSON.stringify(capabilityManifestFromClaude(sourceClaudeDir), null, 2)}\n`;
		for (const target of [agentsPath, snapshotPath]) {
			const pathError = await validateWritableTargetPath(target, options);
			if (pathError) return { success: false, agentsPath, snapshotPath, error: pathError };
		}
		const existing = existsSync(agentsPath) ? await readFile(agentsPath, "utf-8") : "";
		await atomicWrite(agentsPath, mergeCodexCapabilityBootstrap(existing));
		await atomicWrite(snapshotPath, snapshotContent);
		return { success: true, agentsPath, snapshotPath };
	} catch (error) {
		return { success: false, agentsPath, snapshotPath, error: error instanceof Error ? error.message : String(error) };
	}
}

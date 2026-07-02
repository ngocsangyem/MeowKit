// Per-action installer. Handles the 5 main write strategies (per-file, single-file,
// merge-single, yaml-merge, json-merge). codex-toml + codex-hooks delegated to Phase 8 mergers.
// Path-safety helpers extracted to portable-installer-path-safety.ts.

import { existsSync } from "node:fs";
import { copyFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { providers } from "./provider-registry.js";
import { addPortableInstallation, removePortableInstallation } from "./reconcile/portable-registry.js";
import { resolveInstalledBackRef, type InstalledBackRef } from "../core/install-metadata-backref.js";
import { computeContentChecksum } from "./reconcile/checksum-utils.js";
import { auditRuntimeCompatibility } from "./runtime-compat-audit.js";
import { atomicWrite, validateWritableTargetPath } from "./portable-installer-path-safety.js";
import type { ReconcileAction } from "./reconcile/reconcile-types.js";
import type { PortableType, ProviderType, PortableItem } from "./types.js";
import { convertItem } from "./converters/index.js";
import {
	buildMergeSectionContent,
	getMergeSectionKey,
	parseMergedSections,
} from "./config-merger/merge-single-sections.js";
import { buildMergedAgentsMd, buildClineModesJson, buildYamlModesFile } from "./converters/index.js";

export interface InstallResult {
	action: ReconcileAction;
	success: boolean;
	error?: string;
	overwritten?: boolean;
	warnings?: string[];
}

function findItem(items: PortableItem[], name: string, type: PortableType): PortableItem | null {
	return items.find((i) => i.name === name && i.type === type) ?? null;
}

export interface InstallContext {
	allItems: Record<PortableType, PortableItem[]>;
	/** Optional link to the installed metadata the source was exported from. */
	installedBackRef?: InstalledBackRef | null;
	/** Migration-set membership for the fenced-reference integrity check */
	migratedRefs?: import("./references/fence-aware-reference-rewriter.js").ReferenceIntegrityIndex | null;
}

export async function executeInstallAction(action: ReconcileAction, ctx: InstallContext): Promise<InstallResult> {
	const provider = action.provider as ProviderType;
	const providerConfig = providers[provider];
	const pathConfig = providerConfig?.[providerTypeToKey(action.type)];

	if (!pathConfig) {
		return { action, success: false, error: `Provider ${provider} does not support ${action.type}` };
	}

	const items = ctx.allItems[action.type] ?? [];
	const sourceItem = findItem(items, action.item, action.type);

	if (!sourceItem) {
		return { action, success: false, error: `Source item not found: ${action.item}` };
	}

	const ws = pathConfig.writeStrategy;

	// Codex special paths (delegated to Phase 8 hook/toml installers)
	if (ws === "codex-hooks" || ws === "codex-toml") {
		return {
			action,
			success: true,
			error: `[deferred] ${ws} install pipeline lives in Phase 8 hook/toml installer`,
		};
	}

	const conversion = convertItem(sourceItem, pathConfig.format, provider, { migratedRefs: ctx.migratedRefs });
	if (conversion.error) return { action, success: false, error: conversion.error };

	const audit = auditRuntimeCompatibility(conversion.content, sourceItem, provider, conversion.occurrences ?? []);
	if (audit.errors.length > 0) {
		return {
			action,
			success: false,
			error: `Runtime compatibility audit failed: ${audit.errors.join("; ")}`,
		};
	}

	const overwritten = existsSync(action.targetPath);

	// Overwrites are backed up OUTSIDE the target project (tmp) so a failed
	// write can restore the previous content; backups are removed on success.
	let backupPath: string | null = null;
	if (overwritten) {
		backupPath = join(tmpdir(), `migrate-backup-${process.pid}-${Date.now()}-${basename(action.targetPath)}`);
		try {
			await copyFile(action.targetPath, backupPath);
		} catch {
			backupPath = null;
		}
	}

	try {
		const pathError = await validateWritableTargetPath(action.targetPath, { global: action.global });
		if (pathError) {
			await discardBackup(backupPath);
			return { action, success: false, error: pathError };
		}

		const installWarnings: string[] = [...(conversion.warnings ?? [])];
		if (ws === "per-file" || ws === "single-file") {
			await atomicWrite(action.targetPath, conversion.content);
		} else if (ws === "merge-single") {
			installWarnings.push(...(await mergeSingleWrite(action, items, sourceItem, provider, conversion.content)));
		} else if (ws === "yaml-merge") {
			await yamlMergeWrite(action, items, provider);
		} else if (ws === "json-merge") {
			await jsonMergeWrite(action, items, provider);
		}

		const targetChecksum = computeContentChecksum(conversion.content);
		const backRef = resolveInstalledBackRef(ctx.installedBackRef ?? null, sourceItem.sourcePath);
		await addPortableInstallation(
			action.item,
			action.type,
			provider,
			action.global,
			action.targetPath,
			sourceItem.sourcePath,
			{
				sourceChecksum: action.sourceChecksum,
				targetChecksum,
				ownedSections: action.ownedSections,
				installSource: "kit",
				...backRef,
			},
		);

		await discardBackup(backupPath);
		return { action, success: true, overwritten, warnings: installWarnings.length > 0 ? installWarnings : undefined };
	} catch (err) {
		if (backupPath) {
			try {
				await copyFile(backupPath, action.targetPath);
			} catch {
				// Restore is best-effort; the original error is what matters.
			}
			await discardBackup(backupPath);
		}
		const msg = err instanceof Error ? err.message : String(err);
		return { action, success: false, error: msg, overwritten };
	}
}

async function discardBackup(backupPath: string | null): Promise<void> {
	if (!backupPath) return;
	try {
		await unlink(backupPath);
	} catch {
		// Best-effort cleanup.
	}
}

async function mergeSingleWrite(
	action: ReconcileAction,
	items: PortableItem[],
	sourceItem: PortableItem,
	provider: ProviderType,
	convertedContent: string,
): Promise<string[]> {
	const sectionKind =
		action.type === "config" ? "config" : action.type === "rules" ? "rule" : action.type === "agent" ? "agent" : null;

	if (!sectionKind) {
		await atomicWrite(action.targetPath, convertedContent);
		return [];
	}

	const sectionKey = getMergeSectionKey(sectionKind, sourceItem);
	const sectionContent = buildMergeSectionContent(sectionKind, sectionKey, convertedContent);

	let existing = "";
	if (existsSync(action.targetPath)) {
		existing = (await import("node:fs").then((m) => m.promises.readFile(action.targetPath, "utf-8"))).toString();
	}

	const parsed = parseMergedSections(existing);
	const compositeKey = `${sectionKind}:${sectionKey}`;
	const filteredSections = parsed.sections.filter((s) => `${s.kind}:${s.key}` !== compositeKey);

	const allTypeItems = items.filter((i) => i.type === action.type);
	const merged = [parsed.preamble, sectionContent, ...filteredSections.map((s) => s.content)]
		.filter(Boolean)
		.join("\n\n");

	void allTypeItems;
	void buildMergedAgentsMd;
	await atomicWrite(action.targetPath, `${merged}\n`);
	action.ownedSections = [sectionKey];
	return buildMergeBudgetWarnings(action, provider, merged, [
		{ key: sectionKey, content: sectionContent },
		...filteredSections.map((s) => ({ key: s.key, content: s.content })),
	]);
}

/**
 * Warn (never truncate) when a merged instruction file exceeds the provider's
 * documented budget — e.g. Codex stops loading project docs once the combined
 * size reaches project_doc_max_bytes (32 KiB by default).
 */
function buildMergeBudgetWarnings(
	action: ReconcileAction,
	provider: ProviderType,
	merged: string,
	sections: Array<{ key: string; content: string }>,
): string[] {
	const pathConfig = providers[provider]?.[providerTypeToKey(action.type)];
	const budget = pathConfig?.totalCharLimit;
	if (!budget) return [];

	const size = Buffer.byteLength(merged, "utf-8");
	if (size <= budget) return [];

	const sectionSizes = sections
		.map(({ key, content }) => `${key}: ${Buffer.byteLength(content, "utf-8")} B`)
		.join(", ");
	return [
		`${action.targetPath} is ${size} B — over the ${budget} B instruction budget; the runtime truncates project docs at the cap. ` +
			`Not truncating. Consider splitting into nested instruction files or migrating fewer rules. Section sizes: ${sectionSizes}`,
	];
}

async function yamlMergeWrite(action: ReconcileAction, items: PortableItem[], provider: ProviderType): Promise<void> {
	const allItems = items.filter((i) => i.type === action.type);
	const entries: string[] = [];
	for (const item of allItems) {
		const result = convertItem(item, "fm-to-yaml", provider);
		if (!result.error) entries.push(result.content);
	}
	await atomicWrite(action.targetPath, buildYamlModesFile(entries));
}

async function jsonMergeWrite(action: ReconcileAction, items: PortableItem[], provider: ProviderType): Promise<void> {
	const allItems = items.filter((i) => i.type === action.type);
	const modes: import("./converters/index.js").ClineCustomMode[] = [];
	for (const item of allItems) {
		const result = convertItem(item, "fm-to-json", provider);
		if (!result.error) {
			try {
				modes.push(JSON.parse(result.content));
			} catch {
				// Skip malformed entries
			}
		}
	}
	await atomicWrite(action.targetPath, buildClineModesJson(modes));
}

export async function executeDeleteAction(action: ReconcileAction): Promise<InstallResult> {
	try {
		if (existsSync(action.targetPath)) {
			if (action.isDirectoryItem || action.type === "skill") {
				await rm(action.targetPath, { recursive: true, force: true });
			} else {
				await unlink(action.targetPath);
			}
		}
		await removePortableInstallation(action.item, action.type, action.provider as ProviderType, action.global);
		return { action, success: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { action, success: false, error: msg };
	}
}

function providerTypeToKey(type: PortableType): "agents" | "commands" | "skills" | "config" | "rules" | "hooks" {
	switch (type) {
		case "agent":
			return "agents";
		case "command":
			return "commands";
		case "skill":
			return "skills";
		case "config":
			return "config";
		case "rules":
			return "rules";
		case "hooks":
			return "hooks";
	}
}

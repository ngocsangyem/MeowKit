// Per-action installer. Handles the 5 main write strategies (per-file, single-file,
// merge-single, yaml-merge, json-merge). codex-toml + codex-hooks delegated to Phase 8 mergers.

import { existsSync } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { providers } from "./provider-registry.js";
import {
	addPortableInstallation,
	removePortableInstallation,
} from "./reconcile/portable-registry.js";
import { computeContentChecksum } from "./reconcile/checksum-utils.js";
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
}

async function atomicWrite(target: string, content: string): Promise<void> {
	const dir = dirname(target);
	if (!existsSync(dir)) await mkdir(dir, { recursive: true });
	const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
	try {
		await writeFile(tmp, content, "utf-8");
		await rename(tmp, target);
	} catch (err) {
		try { await unlink(tmp); } catch { /* best-effort */ }
		throw err;
	}
}

function findItem(items: PortableItem[], name: string, type: PortableType): PortableItem | null {
	return items.find((i) => i.name === name && i.type === type) ?? null;
}

export interface InstallContext {
	allItems: Record<PortableType, PortableItem[]>;
}

export async function executeInstallAction(
	action: ReconcileAction,
	ctx: InstallContext,
): Promise<InstallResult> {
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
			action, success: true,
			error: `[deferred] ${ws} install pipeline lives in Phase 8 hook/toml installer`,
		};
	}

	const conversion = convertItem(sourceItem, pathConfig.format, provider);
	if (conversion.error) return { action, success: false, error: conversion.error };

	const overwritten = existsSync(action.targetPath);

	try {
		if (ws === "per-file" || ws === "single-file") {
			await atomicWrite(action.targetPath, conversion.content);
		} else if (ws === "merge-single") {
			await mergeSingleWrite(action, items, sourceItem, provider, conversion.content);
		} else if (ws === "yaml-merge") {
			await yamlMergeWrite(action, items, provider);
		} else if (ws === "json-merge") {
			await jsonMergeWrite(action, items, provider);
		}

		const targetChecksum = computeContentChecksum(conversion.content);
		await addPortableInstallation(
			action.item, action.type, provider, action.global, action.targetPath, sourceItem.sourcePath,
			{
				sourceChecksum: action.sourceChecksum,
				targetChecksum,
				ownedSections: action.ownedSections,
				installSource: "kit",
			},
		);

		return { action, success: true, overwritten };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { action, success: false, error: msg, overwritten };
	}
}

async function mergeSingleWrite(
	action: ReconcileAction,
	items: PortableItem[],
	sourceItem: PortableItem,
	provider: ProviderType,
	convertedContent: string,
): Promise<void> {
	const sectionKind =
		action.type === "config" ? "config"
		: action.type === "rules" ? "rule"
		: action.type === "agent" ? "agent"
		: null;

	if (!sectionKind) {
		await atomicWrite(action.targetPath, convertedContent);
		return;
	}

	const sectionKey = getMergeSectionKey(sectionKind, sourceItem);
	const sectionContent = buildMergeSectionContent(sectionKind, sectionKey, convertedContent);

	let existing = "";
	if (existsSync(action.targetPath)) {
		existing = (await import("node:fs").then((m) => m.promises.readFile(action.targetPath, "utf-8"))).toString();
	}

	const parsed = parseMergedSections(existing);
	const compositeKey = `${sectionKind}:${sectionKey}`;
	const filteredSections = parsed.sections.filter(
		(s) => `${s.kind}:${s.key}` !== compositeKey,
	);

	const allTypeItems = items.filter((i) => i.type === action.type);
	const merged = [parsed.preamble, sectionContent, ...filteredSections.map((s) => s.content)]
		.filter(Boolean)
		.join("\n\n");

	void allTypeItems;
	void buildMergedAgentsMd;
	await atomicWrite(action.targetPath, `${merged}\n`);
	action.ownedSections = [sectionKey];
}

async function yamlMergeWrite(
	action: ReconcileAction,
	items: PortableItem[],
	provider: ProviderType,
): Promise<void> {
	const allItems = items.filter((i) => i.type === action.type);
	const entries: string[] = [];
	for (const item of allItems) {
		const result = convertItem(item, "fm-to-yaml", provider);
		if (!result.error) entries.push(result.content);
	}
	await atomicWrite(action.targetPath, buildYamlModesFile(entries));
}

async function jsonMergeWrite(
	action: ReconcileAction,
	items: PortableItem[],
	provider: ProviderType,
): Promise<void> {
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
			await unlink(action.targetPath);
		}
		await removePortableInstallation(
			action.item, action.type, action.provider as ProviderType, action.global,
		);
		return { action, success: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { action, success: false, error: msg };
	}
}

function providerTypeToKey(type: PortableType): "agents" | "commands" | "skills" | "config" | "rules" | "hooks" {
	switch (type) {
		case "agent": return "agents";
		case "command": return "commands";
		case "skill": return "skills";
		case "config": return "config";
		case "rules": return "rules";
		case "hooks": return "hooks";
	}
}

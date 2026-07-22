// Per-action installer. Handles the 3 main write strategies (per-file, single-file,
// merge-single). codex-toml + codex-hooks delegated to Phase 8 mergers.
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
import { buildMergedAgentsMd } from "./converters/index.js";

export interface InstallResult {
	action: ReconcileAction;
	success: boolean;
	error?: string;
	overwritten?: boolean;
	warnings?: string[];
	/** Structured migration decision records (skill env-var/waiver/audit-failure), for the run report. */
	records?: import("./validation/migration-record-types.js").MigrationDecisionRecord[];
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

		const installWarnings: string[] = [...(conversion.warnings ?? []), ...audit.warnings];
		if (ws === "per-file" || ws === "single-file") {
			await atomicWrite(action.targetPath, conversion.content);
		} else if (ws === "merge-single") {
			installWarnings.push(...(await mergeSingleWrite(action, items, sourceItem, provider, conversion.content)));
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

	// Rank the current section against the ones already merged so the highest-priority
	// guidance survives first (see rankMergedSections). Codex applies its byte cap to the
	// COMBINED instruction chain and stops adding files once the cap is reached
	// (https://developers.openai.com/codex/guides/agents-md), so any truncation is a tail
	// cut — safety/injection/core rules must sit at the front. For non-codex providers this
	// is an identity ordering (rank is a no-op), so merge-single semantics stay unchanged.
	const orderedSections = rankMergedSections(provider, [
		{ kind: sectionKind, key: sectionKey, content: sectionContent },
		...filteredSections.map((s) => ({ kind: s.kind, key: s.key, content: s.content })),
	]);

	// Prepend the provider's instruction-file title so the merged doc opens with an H1
	// heading (fixes the previously dangling leading "## Config" section that had no title
	// above it). Codex-scoped via mergeTitleFor(); other providers get no title, preserving
	// their existing merge-single output byte-for-byte.
	const preamble = withMergeTitle(provider, parsed.preamble);

	const merged = [preamble, ...orderedSections.map((s) => s.content)].filter(Boolean).join("\n\n");

	void allTypeItems;
	void buildMergedAgentsMd;
	await atomicWrite(action.targetPath, `${merged}\n`);
	action.ownedSections = [sectionKey];
	return buildMergeBudgetWarnings(
		action,
		provider,
		merged,
		orderedSections.map((s) => ({ key: s.key, content: s.content })),
	);
}

/**
 * Instruction-file title prepended to the merged doc, per provider. Codex-scoped: only
 * Codex's AGENTS.md gets an H1 title so it never opens with a dangling "## Config" section
 * heading. Returning undefined for other providers keeps their merged output unchanged.
 */
function mergeTitleFor(provider: ProviderType): string | undefined {
	return provider === "codex" ? "# AGENTS.md" : undefined;
}

function withMergeTitle(provider: ProviderType, preamble: string): string {
	const title = mergeTitleFor(provider);
	if (!title) return preamble;
	const trimmed = preamble.trimStart();
	// Idempotent: never stack the title on rerun, and never demote a user's own H1 preamble.
	if (trimmed.startsWith(title) || /^#\s+\S/.test(trimmed)) return preamble;
	return preamble ? `${title}\n\n${preamble}` : title;
}

/**
 * Priority ranking for merged instruction sections. The rank list mirrors the kit's own
 * always-on safety/baseline rule set (security-rules, injection-rules, gate-rules,
 * core-behaviors, development-rules — the same set the compaction policy preserves verbatim),
 * with the config constitution pinned first. Sections not on the list keep their existing
 * relative order after the ranked ones (stable sort).
 *
 * Codex-scoped: only Codex reorders, because Codex truncates the COMBINED instruction chain
 * at project_doc_max_bytes (https://developers.openai.com/codex/guides/agents-md) so section
 * ORDER determines what survives at runtime. Other merge-single providers get an identity
 * ordering, so their merge-single semantics stay unchanged.
 */
const CODEX_SECTION_PRIORITY: readonly string[] = [
	"config",
	"security-rules",
	"injection-rules",
	"gate-rules",
	"core-behaviors",
	"development-rules",
];

interface RankableSection {
	kind: import("./config-merger/merge-single-sections.js").ParsedSectionKind;
	key: string;
	content: string;
}

function rankMergedSections<T extends RankableSection>(provider: ProviderType, sections: T[]): T[] {
	if (provider !== "codex") return sections;
	const rankOf = (s: T): number => {
		const key = s.kind === "config" ? "config" : s.key;
		const idx = CODEX_SECTION_PRIORITY.indexOf(key);
		return idx === -1 ? CODEX_SECTION_PRIORITY.length : idx;
	};
	// Stable sort: decorate with original index so equal ranks preserve input order.
	return sections
		.map((section, index) => ({ section, index, rank: rankOf(section) }))
		.sort((a, b) => a.rank - b.rank || a.index - b.index)
		.map((entry) => entry.section);
}

/**
 * Warn (never truncate) when a merged instruction file exceeds the provider's
 * documented budget — e.g. Codex stops loading project docs once the combined
 * size reaches project_doc_max_bytes (32 KiB by default).
 *
 * For Codex, the doc-grounded remedy is raising project_doc_max_bytes, NOT splitting
 * into nested AGENTS.md files: Codex applies the cap to the COMBINED instruction chain and
 * subdirectory AGENTS.md load only when cwd is inside that subtree
 * (https://developers.openai.com/codex/guides/agents-md). Splitting therefore neither raises
 * the effective budget nor keeps content visible from the repo root. So we emit the exact
 * config line the user can add to ~/.codex/config.toml — as GUIDANCE only. We never write to
 * the user's home directory or any ~/.codex file.
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

	const guidance = codexBudgetRaiseGuidance(provider, size, budget);
	if (guidance) {
		return [
			`${action.targetPath} is ${size} B — over the ${budget} B instruction budget; the runtime truncates project docs at the cap. ` +
				`Not truncating. ${guidance} ` +
				`Sections are ordered safety-first so any runtime truncation drops the least critical guidance last. Section sizes: ${sectionSizes}`,
		];
	}

	return [
		`${action.targetPath} is ${size} B — over the ${budget} B instruction budget; the runtime truncates project docs at the cap. ` +
			`Not truncating. Consider migrating fewer rules. Section sizes: ${sectionSizes}`,
	];
}

/**
 * Round a byte size up to the next power-of-two multiple of the 32 KiB Codex default, so the
 * suggested project_doc_max_bytes comfortably covers the merged file (e.g. 41,914 B → 65536).
 * Codex's default is 32768 (32 KiB); we never suggest a value below it.
 */
export function suggestedProjectDocMaxBytes(size: number, budget: number): number {
	const base = Math.max(budget, 32768);
	let suggested = base;
	while (suggested < size) suggested *= 2;
	return suggested;
}

/**
 * Codex-scoped project_doc_max_bytes raise guidance. Returns undefined for other providers so
 * the generic warning path is used. GUIDANCE ONLY — the caller never writes ~/.codex/config.toml.
 */
export function codexBudgetRaiseGuidance(provider: ProviderType, size: number, budget: number): string | undefined {
	if (provider !== "codex") return undefined;
	const suggested = suggestedProjectDocMaxBytes(size, budget);
	return (
		`Codex applies this cap to the combined instruction chain, so splitting into nested AGENTS.md files would not help. ` +
		`To load the full file, add \`project_doc_max_bytes = ${suggested}\` to your ~/.codex/config.toml (guidance only — not written for you).`
	);
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

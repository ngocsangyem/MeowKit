// Builds the pre-install conversion report: converts every planned item
// in-memory (plus portable skill markdown), aggregates classifier decisions,
// and runs the unresolved-reference scanner. Console/in-memory only — nothing
// here writes into the target project.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { convertItem } from "../converters/index.js";
import { providers } from "../provider-registry.js";
import {
	combineIntegrityIndexes,
	createReferenceIntegrityIndex,
	rewriteSourceReferences,
	type ReferenceIntegrityIndex,
} from "../references/fence-aware-reference-rewriter.js";
import type { ReferenceOccurrence } from "../references/reference-types.js";
import type { ReconcileAction } from "../reconcile/reconcile-types.js";
import type { PortableItem, PortableType, ProviderType, SkillInfo } from "../types.js";
import { scanUnresolvedReferences, type ScannedOutput, type ValidationFinding } from "./unresolved-reference-scanner.js";

export interface ConversionReport {
	/** Preserved-with-warning references: "file:line — ref (reason)" */
	warnedReferences: string[];
	/** Unique converter warnings (unsupported concepts, manual adaptations, ...) */
	conversionWarnings: string[];
	/** Projected merged-instruction-file budget status lines */
	budgetLines: string[];
	/** Internal invariant violations from the unresolved-reference scanner */
	validationErrors: string[];
}

const TYPE_KEY: Record<PortableType, "agents" | "commands" | "skills" | "config" | "rules" | "hooks"> = {
	agent: "agents",
	command: "commands",
	skill: "skills",
	config: "config",
	rules: "rules",
	hooks: "hooks",
};

function collectMarkdownFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) files.push(...collectMarkdownFiles(full));
		else if (entry.toLowerCase().endsWith(".md")) files.push(full);
	}
	return files;
}

export function buildConversionReport(input: {
	actions: ReconcileAction[];
	itemsByType: Record<PortableType, PortableItem[]>;
	skillsByProvider: Map<ProviderType, SkillInfo[]>;
	migratedRefs: ReferenceIntegrityIndex;
}): ConversionReport {
	const outputs: ScannedOutput[] = [];
	const occurrences: ReferenceOccurrence[] = [];
	const conversionWarnings = new Set<string>();
	const budgetByTarget = new Map<string, { bytes: number; budget: number }>();

	for (const action of input.actions) {
		if (action.action !== "install" && action.action !== "update" && action.action !== "conflict") continue;
		const provider = action.provider as ProviderType;
		const pathConfig = providers[provider]?.[TYPE_KEY[action.type]];
		if (!pathConfig) continue;
		const item = input.itemsByType[action.type]?.find((i) => i.name === action.item);
		if (!item) continue;

		const conversion = convertItem(item, pathConfig.format, provider, { migratedRefs: input.migratedRefs });
		if (conversion.error) continue;

		const file = `${provider}/${action.type}/${action.item}`;
		outputs.push({ file, content: conversion.content, occurrences: conversion.occurrences ?? [] });
		occurrences.push(...(conversion.occurrences ?? []).map((o) => ({ ...o, file: o.file || file })));
		for (const warning of conversion.warnings) conversionWarnings.add(warning);

		if (pathConfig.writeStrategy === "merge-single" && pathConfig.totalCharLimit) {
			const key = `${provider}:${pathConfig.projectPath ?? pathConfig.globalPath ?? ""}`;
			const entry = budgetByTarget.get(key) ?? { bytes: 0, budget: pathConfig.totalCharLimit };
			entry.bytes += Buffer.byteLength(conversion.content, "utf-8");
			budgetByTarget.set(key, entry);
		}
	}

	for (const [provider, skills] of input.skillsByProvider) {
		if (!providers[provider]?.skills) continue;
		for (const skill of skills) {
			const selfIndex = createReferenceIntegrityIndex([`.claude/skills/${skill.dirName}/`]);
			const index = combineIntegrityIndexes(selfIndex, input.migratedRefs);
			let files: string[];
			try {
				files = collectMarkdownFiles(skill.sourcePath);
			} catch {
				continue;
			}
			for (const filePath of files) {
				const relName = relative(skill.sourcePath, filePath);
				const file = `${provider}/skill/${skill.name}/${relName}`;
				let content: string;
				try {
					content = readFileSync(filePath, "utf-8");
				} catch {
					continue;
				}
				const rewritten = rewriteSourceReferences(content, { provider, file, migratedRefs: index });
				outputs.push({ file, content: rewritten.content, occurrences: rewritten.occurrences });
				occurrences.push(...rewritten.occurrences);
			}
		}
	}

	const warnedReferences = occurrences
		.filter((o) => o.decision === "preserve-warn")
		.map((o) => `${o.file}:${o.line} — ${o.original}${o.reason ? ` (${o.reason})` : ""}`);

	const budgetLines = Array.from(budgetByTarget.entries()).map(([key, { bytes, budget }]) => {
		const status = bytes > budget ? "OVER budget — the runtime truncates at the cap" : "within budget";
		return `${key}: projected ~${bytes} B of ${budget} B (${status})`;
	});

	const findings: ValidationFinding[] = scanUnresolvedReferences(outputs);
	const validationErrors = findings.map((f) => `${f.file}:${f.line} — ${f.message}`);

	return {
		warnedReferences,
		conversionWarnings: Array.from(conversionWarnings),
		budgetLines,
		validationErrors,
	};
}

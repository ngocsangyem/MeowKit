import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { providers } from "./provider-registry.js";
import type { PortableItem, PortableType, ProviderType, SkillInfo } from "./types.js";
import type { ReconcileAction, ReconcilePlan } from "./reconcile/reconcile-types.js";

interface RuntimeBoundSignal {
	label: string;
	pattern: RegExp;
}

export interface PortabilitySkip {
	provider: ProviderType;
	type: PortableType | "skill";
	item: string;
	reason: string;
}

const RUNTIME_BOUND_SIGNALS: RuntimeBoundSignal[] = [
	{ label: ".claude path", pattern: /\.claude\//i },
	{ label: "CLAUDE.md reference", pattern: /\bCLAUDE\.md\b/ },
	{ label: "mk/meow slash command", pattern: /\/(?:mk|meow):/i },
	{ label: "Claude env var", pattern: /\$CLAUDE_[A-Z0-9_]+\b/ },
	{ label: "Anthropic env var", pattern: /\$ANTHROPIC_[A-Z0-9_]+\b/ },
	{ label: "gate semantics", pattern: /\bGate\s+[12]\b/i },
	{ label: "phase pipeline semantics", pattern: /\bPhase\s+[0-9]+\b/i },
	{ label: "orchestrator semantics", pattern: /\borchestrator\b/i },
];

const RUNTIME_BOUND_ITEM_TYPES = new Set<PortableType>(["agent", "command", "rules"]);

function summarizeSignals(content: string): string[] {
	return RUNTIME_BOUND_SIGNALS.filter((signal) => signal.pattern.test(content)).map((signal) => signal.label);
}

export function getRuntimeBoundSignals(content: string): string[] {
	return summarizeSignals(content);
}

function buildRuntimeBoundReason(signals: string[]): string {
	const summary = signals.slice(0, 3).join(", ");
	const suffix = signals.length > 3 ? ` (+${signals.length - 3} more)` : "";
	return `runtime-bound Claude harness content: ${summary}${suffix}`;
}

function findPortableItem(
	itemsByType: Record<PortableType, PortableItem[]>,
	type: PortableType,
	name: string,
): PortableItem | null {
	return itemsByType[type]?.find((item) => item.name === name) ?? null;
}

function shouldSkipPortableItem(item: PortableItem, provider: ProviderType): PortabilitySkip | null {
	if (provider === "claude-code") return null;
	if (!RUNTIME_BOUND_ITEM_TYPES.has(item.type)) return null;

	const signals = summarizeSignals(item.body);
	if (signals.length === 0) return null;

	return {
		provider,
		type: item.type,
		item: item.name,
		reason: buildRuntimeBoundReason(signals),
	};
}

function summarizeSkipCounts(skips: PortabilitySkip[]): string[] {
	const counts = new Map<string, { count: number; provider: ProviderType; type: PortableType | "skill"; reason: string }>();
	for (const skip of skips) {
		const key = JSON.stringify([skip.provider, skip.type, skip.reason]);
		const entry = counts.get(key);
		if (entry) {
			entry.count += 1;
		} else {
			counts.set(key, { count: 1, provider: skip.provider, type: skip.type, reason: skip.reason });
		}
	}

	return Array.from(counts.entries())
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([, entry]) => {
			return `Skipped ${entry.count} ${entry.type}${entry.count === 1 ? "" : "s"} for ${providers[entry.provider].displayName}: ${entry.reason}`;
		});
}

function recomputePlanSummary(actions: ReconcileAction[]): ReconcilePlan["summary"] {
	return {
		install: actions.filter((action) => action.action === "install").length,
		update: actions.filter((action) => action.action === "update").length,
		skip: actions.filter((action) => action.action === "skip").length,
		conflict: actions.filter((action) => action.action === "conflict").length,
		delete: actions.filter((action) => action.action === "delete").length,
	};
}

export function filterPlanForPortability(
	plan: ReconcilePlan,
	itemsByType: Record<PortableType, PortableItem[]>,
): { plan: ReconcilePlan; skipMessages: string[]; skips: PortabilitySkip[] } {
	const skips: PortabilitySkip[] = [];
	const keptActions = plan.actions.filter((action) => {
		if (action.action === "delete") return true;
		const item = findPortableItem(itemsByType, action.type, action.item);
		if (!item) return true;
		const skip = shouldSkipPortableItem(item, action.provider as ProviderType);
		if (!skip) return true;
		skips.push(skip);
		return false;
	});

	return {
		plan: {
			...plan,
			actions: keptActions,
			summary: recomputePlanSummary(keptActions),
			hasConflicts: keptActions.some((action) => action.action === "conflict"),
		},
		skipMessages: summarizeSkipCounts(skips),
		skips,
	};
}

export async function buildPortableSkillsByProvider(
	skills: SkillInfo[],
	targets: ProviderType[],
): Promise<{ skillsByProvider: Map<ProviderType, SkillInfo[]>; skipMessages: string[]; skips: PortabilitySkip[] }> {
	const skillsByProvider = new Map<ProviderType, SkillInfo[]>();
	const skips: PortabilitySkip[] = [];
	const contentCache = new Map<string, string>();

	async function readSkillContent(skill: SkillInfo): Promise<string> {
		const cached = contentCache.get(skill.sourcePath);
		if (cached !== undefined) return cached;
		const content = await readFile(join(skill.sourcePath, "SKILL.md"), "utf-8");
		contentCache.set(skill.sourcePath, content);
		return content;
	}

	for (const target of targets) {
		if (!providers[target].skills) continue;
		const portable: SkillInfo[] = [];

		for (const skill of skills) {
			const content = await readSkillContent(skill);
			const signals = summarizeSignals(content);
			if (signals.length > 0) {
				skips.push({
					provider: target,
					type: "skill",
					item: skill.name,
					reason: buildRuntimeBoundReason(signals),
				});
				continue;
			}
			portable.push(skill);
		}

		skillsByProvider.set(target, portable);
	}

	return {
		skillsByProvider,
		skipMessages: summarizeSkipCounts(skips),
		skips,
	};
}

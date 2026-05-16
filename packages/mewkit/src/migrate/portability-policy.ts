import { getProviderSurfaceContract } from "./provider-documentation-contracts.js";
import { analyzeCodexRuleSource } from "./converters/index.js";
import { classifyRuleSemantic } from "./ir/rule-classifier.js";
import { providers } from "./provider-registry.js";
import type { PortableItem, PortableType, ProviderType, SkillInfo } from "./types.js";
import type { ReconcileAction, ReconcilePlan } from "./reconcile/reconcile-types.js";

interface RuntimeBoundSignal {
	label: string;
	pattern: RegExp;
	hardSkip?: boolean;
}

export interface PortabilitySkip {
	provider: ProviderType;
	type: PortableType | "skill";
	item: string;
	reason: string;
}

export interface RuleMigrationSummary {
	provider: ProviderType;
	native: number;
	documentationOnly: number;
	skipped: number;
	messages: string[];
}

const RUNTIME_BOUND_SIGNALS: RuntimeBoundSignal[] = [
	{ label: ".claude path", pattern: /\.claude\//i },
	{ label: "CLAUDE.md reference", pattern: /\bCLAUDE\.md\b/ },
	{ label: "mk/meow slash command", pattern: /\/(?:mk|meow):/i },
	{ label: "Claude env var", pattern: /\$CLAUDE_[A-Z0-9_]+\b/ },
	{ label: "Anthropic env var", pattern: /\$ANTHROPIC_[A-Z0-9_]+\b/ },
	{ label: "gate semantics", pattern: /\bGate\s+[12]\b/i, hardSkip: true },
	{ label: "phase pipeline semantics", pattern: /\bPhase\s+[0-9]+\b/i, hardSkip: true },
	{ label: "orchestrator semantics", pattern: /\borchestrator\b/i, hardSkip: true },
];

const RUNTIME_BOUND_ITEM_TYPES = new Set<PortableType>(["agent", "command", "rules"]);
function summarizeSignals(content: string): string[] {
	return RUNTIME_BOUND_SIGNALS.filter((signal) => signal.pattern.test(content)).map((signal) => signal.label);
}

function summarizeHardSkipSignals(content: string): string[] {
	return RUNTIME_BOUND_SIGNALS.filter((signal) => signal.hardSkip && signal.pattern.test(content)).map((signal) => signal.label);
}

function summarizeSkillSkipSignals(content: string): string[] {
	return RUNTIME_BOUND_SIGNALS.filter((signal) => signal.label === "orchestrator semantics" && signal.pattern.test(content)).map(
		(signal) => signal.label,
	);
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

	if (item.type === "rules") {
		const classified = classifyRuleSemantic(item);
		if (classified.kind === "orchestration") {
			return {
				provider,
				type: item.type,
				item: item.name,
				reason: `orchestration-only Claude workflow rule: ${classified.signals.join(", ")}`,
			};
		}
		if (classified.kind === "runtime-automation") {
			return {
				provider,
				type: item.type,
				item: item.name,
				reason: `Claude runtime automation rule with no rule-layer portability: ${classified.signals.join(", ")}`,
			};
		}

		if (provider === "codex") {
			const analyzed = analyzeCodexRuleSource(item);
			if (analyzed.kind === "unsupported") {
				return {
					provider,
					type: item.type,
					item: item.name,
					reason: analyzed.reason ?? "Unsupported Codex rule content",
				};
			}
		}
	}

	const signals = summarizeHardSkipSignals(item.body);
	if (signals.length === 0) return null;

	return {
		provider,
		type: item.type,
		item: item.name,
		reason: buildRuntimeBoundReason(signals),
	};
}

export function summarizeRuleMigrationByProvider(
	rules: PortableItem[],
	targets: ProviderType[],
): RuleMigrationSummary[] {
	return targets.map((provider) => {
		const messages: string[] = [];
		let native = 0;
		let documentationOnly = 0;
		let skipped = 0;
		const ruleSurface = getProviderSurfaceContract(provider, "rules");
		const configSurface = getProviderSurfaceContract(provider, "config");

		for (const rule of rules) {
			const classified = classifyRuleSemantic(rule);

			if (provider === "claude-code") {
				native += 1;
				continue;
			}

			if (classified.kind === "orchestration" || classified.kind === "runtime-automation") {
				skipped += 1;
				continue;
			}

			if (provider === "codex") {
				const analyzed = analyzeCodexRuleSource(rule);
				if (analyzed.kind === "unsupported") {
					skipped += 1;
					continue;
				}
			}

			if (ruleSurface.status === "documented") {
				native += 1;
				continue;
			}

			if (configSurface.status === "documented") {
				documentationOnly += 1;
				continue;
			}

			skipped += 1;
		}

		if (native > 0) messages.push(`${providers[provider].displayName}: ${native} rule(s) migrate to documented rule surfaces`);
		if (documentationOnly > 0) {
			messages.push(
				`${providers[provider].displayName}: ${documentationOnly} rule(s) require instruction-file flattening; no native rule surface is documented`,
			);
		}
		if (skipped > 0) messages.push(`${providers[provider].displayName}: ${skipped} rule(s) skipped as orchestration/runtime-only content`);

		return { provider, native, documentationOnly, skipped, messages };
	});
}

export function buildSkillDryRunMessages(
	skillsByProvider: Map<ProviderType, SkillInfo[]>,
	targets: ProviderType[],
): string[] {
	return targets
		.filter((provider) => providers[provider].skills)
		.map((provider) => {
			const count = skillsByProvider.get(provider)?.length ?? 0;
			return `${providers[provider].displayName}: ${count} skill folder${count === 1 ? "" : "s"} scheduled for install`;
		});
}

function shouldSkipUnsupportedSurface(action: ReconcileAction): PortabilitySkip | null {
	const provider = action.provider as ProviderType;
	const contract = getProviderSurfaceContract(provider, action.type);
	if (contract.status === "documented") return null;

	return {
		provider,
		type: action.type,
		item: action.item,
		reason: `unsupported by ${providers[provider].displayName} official docs for ${action.type} migration`,
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
		const unsupportedSurface = shouldSkipUnsupportedSurface(action);
		if (unsupportedSurface) {
			skips.push(unsupportedSurface);
			return false;
		}
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

	for (const target of targets) {
		if (!providers[target].skills) continue;
		skillsByProvider.set(target, [...skills]);
	}

	return {
		skillsByProvider,
		skipMessages: [],
		skips,
	};
}

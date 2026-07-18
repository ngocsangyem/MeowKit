import { getProviderSurfaceContract } from "./provider-documentation-contracts.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyRuleSemantic } from "./ir/rule-classifier.js";
import { providers } from "./provider-registry.js";
import { auditSkillDirectory } from "./skill-directory-audit.js";
import { lookupCodexSkillAdapter } from "./providers/codex/adapter-map.js";
import type { PortableItem, PortableType, ProviderType, SkillInfo } from "./types.js";
import type { ReconcileAction, ReconcilePlan } from "./reconcile/reconcile-types.js";

// ── Runtime-based portability classification (Phase 5, Codex default-deny) ────────────────────
// The primary portability signal is the skill's `runtime:` frontmatter, NOT the older weak
// heuristics (portability metadata + "orchestrator" keyword + directory audit) that let 96
// runtime: claude-code skills silently install for Codex. A claude-code skill is host-bound; it
// installs for a non-Claude provider ONLY through an authored+tested adapter, else it is skipped
// with a report reason (default-deny). `--include-unportable` overrides with an EXPERIMENTAL banner.

export type SkillPortabilityClass =
	| "portable" // runtime: portable — installs directly
	| "adapted" // claude-code with a full authored adapter — installs transformed
	| "adapted-degraded" // adapter uses a degraded (prose fallback) mapping — installs, counts apart
	| "unportable-included" // claude-code, no adapter, forced in via --include-unportable
	| "skipped"; // claude-code, no adapter — default-denied

export interface SkillClassification {
	skill: string;
	cls: SkillPortabilityClass;
	reason: string;
}

export interface RuntimeGateOptions {
	includeUnportable?: boolean;
}

/** Read a skill's top-level `runtime:` frontmatter (portable | claude-code), or undefined. */
export function readSkillRuntime(skill: SkillInfo): "portable" | "claude-code" | undefined {
	try {
		const content = readFileSync(join(skill.sourcePath, "SKILL.md"), "utf-8");
		// Read `runtime:` from the YAML frontmatter ONLY, so a body line (prose / code block) can
		// never masquerade as the declared runtime.
		const fm = /^---\n([\s\S]*?)\n---/.exec(content);
		const scope = fm ? fm[1] : "";
		const m = /^runtime:[ \t]*([a-z-]+)[ \t]*$/im.exec(scope);
		const value = m?.[1];
		return value === "portable" || value === "claude-code" ? value : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Classify a skill for a NON-Claude provider by its runtime. Codex is the only provider with an
 * adapter table today; other non-Claude providers have none, so a claude-code skill there is
 * skipped (or forced) exactly the same way. Both the install/skip decision and the parity score
 * classify through THIS function; the install path additionally applies safety guards (explicit
 * provider exclude + the destructive-script directory audit), so a `portable` skill that fails the
 * script audit is not installed even though it counts toward the parity classification. Parity is
 * therefore a portability-intent measure, a slight ceiling over actually-installed.
 */
export function classifySkillForProvider(
	skill: SkillInfo,
	provider: ProviderType,
	opts: RuntimeGateOptions = {},
): SkillClassification {
	const runtime = readSkillRuntime(skill);
	if (runtime === "portable") {
		return { skill: skill.name, cls: "portable", reason: "runtime: portable" };
	}
	const adapter = provider === "codex" ? lookupCodexSkillAdapter(skill.name) : null;
	if (adapter) {
		return {
			skill: skill.name,
			cls: adapter.degraded ? "adapted-degraded" : "adapted",
			reason: `runtime: ${runtime ?? "unspecified"} — installed via ${provider} adapter${adapter.degraded ? " (degraded)" : ""}`,
		};
	}
	if (opts.includeUnportable) {
		return {
			skill: skill.name,
			cls: "unportable-included",
			reason: `runtime: ${runtime ?? "unspecified"} — forced in via --include-unportable (EXPERIMENTAL; unadapted host-bound content)`,
		};
	}
	return {
		skill: skill.name,
		cls: "skipped",
		reason: `runtime: ${runtime ?? "unspecified"} — no ${providers[provider].displayName} adapter (default-deny; use --include-unportable to override)`,
	};
}

/** True when a classification means the skill is installed (directly, adapted, or forced). */
export function isInstalledClass(cls: SkillPortabilityClass): boolean {
	return cls !== "skipped";
}

/** Honor a skill's explicit `meowkit:` provider include/exclude policy (orthogonal to runtime). */
function shouldExcludeByExplicitPolicy(skill: SkillInfo, provider: ProviderType): PortabilitySkip | null {
	const policy = skill.portability;
	if (!policy) return null;
	if (policy.providers?.exclude?.includes(provider)) {
		return { provider, type: "skill", item: skill.name, reason: "provider excluded by skill portability policy" };
	}
	if (policy.providers?.include && !policy.providers.include.includes(provider)) {
		return { provider, type: "skill", item: skill.name, reason: "provider not included by skill portability policy" };
	}
	return null;
}

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
const FIRST_PASS_SKILL_PROVIDERS = new Set<ProviderType>(["codex", "gemini-cli", "antigravity", "opencode"]);
function summarizeSignals(content: string): string[] {
	return RUNTIME_BOUND_SIGNALS.filter((signal) => signal.pattern.test(content)).map((signal) => signal.label);
}

function summarizeHardSkipSignals(content: string): string[] {
	return RUNTIME_BOUND_SIGNALS.filter((signal) => signal.hardSkip && signal.pattern.test(content)).map((signal) => signal.label);
}

function summarizeSkillSkipSignals(content: string): string[] {
	return RUNTIME_BOUND_SIGNALS.filter(
		(signal) =>
			["orchestrator semantics"].includes(signal.label) && signal.pattern.test(content),
	).map((signal) => signal.label);
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

function shouldSkipPortableItem(
	item: PortableItem,
	provider: ProviderType,
	options?: { allRules?: boolean },
): PortabilitySkip | null {
	if (provider === "claude-code") return null;
	if (!RUNTIME_BOUND_ITEM_TYPES.has(item.type)) return null;

	if (item.type === "rules") {
		if (options?.allRules) return null;

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
			if (provider === "claude-code") {
				native += 1;
				continue;
			}

			const classified = classifyRuleSemantic(rule);

			if (classified.kind === "orchestration" || classified.kind === "runtime-automation") {
				skipped += 1;
				continue;
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

async function shouldInstallSkillForProvider(
	skill: SkillInfo,
	provider: ProviderType,
	opts: RuntimeGateOptions = {},
): Promise<PortabilitySkip | null> {
	if (provider === "claude-code") return null;
	if (!FIRST_PASS_SKILL_PROVIDERS.has(provider)) {
		return {
			provider,
			type: "skill",
			item: skill.name,
			reason: "skill portability metadata first pass is limited to Codex, Gemini CLI, Antigravity, and OpenCode",
		};
	}

	// Codex default-deny (Phase 5): the runtime classification is authoritative for the DENY
	// decision — it supersedes the weaker runtime-coupling heuristic below that let host-bound
	// claude-code skills through. A claude-code skill with no adapter is skipped unless forced.
	// A portable/adapted skill still passes through the SAFETY checks (explicit provider policy +
	// the state-changing-script directory audit) — the runtime field authorizes portability, it
	// does not waive those guards. A forced (--include-unportable) install is an explicit override
	// and bypasses them by design.
	if (provider === "codex") {
		const classification = classifySkillForProvider(skill, provider, opts);
		if (classification.cls === "skipped") {
			return { provider, type: "skill", item: skill.name, reason: classification.reason };
		}
		// portable / adapted / unportable-included all pass the SAFETY guards. --include-unportable
		// overrides ONLY the runtime default-deny — never an authored provider exclude, and never the
		// destructive-script audit (a `rm -rf`-class state-changing script stays fail-closed even when
		// forced). Those two axes are orthogonal to portability.
		const policyExcludes = shouldExcludeByExplicitPolicy(skill, provider);
		if (policyExcludes) return policyExcludes;
		return await skipIfSkillDirectoryAuditFails(skill, provider);
	}

	const policy = skill.portability;
	if (!policy) {
		const signals = readSkillRuntimeSignals(skill);
		if (signals.length > 0) {
			return { provider, type: "skill", item: skill.name, reason: buildRuntimeBoundReason(signals) };
		}
		return await skipIfSkillDirectoryAuditFails(skill, provider);
	}

	if (policy.providers?.exclude?.includes(provider)) {
		return { provider, type: "skill", item: skill.name, reason: "provider excluded by skill portability policy" };
	}
	if (policy.providers?.include && !policy.providers.include.includes(provider)) {
		return { provider, type: "skill", item: skill.name, reason: "provider not included by skill portability policy" };
	}

	if (policy.requires?.surfaces?.includes("skill") && !providers[provider].skills) {
		return { provider, type: "skill", item: skill.name, reason: "provider has no documented skill surface" };
	}

	if (policy.portability === "provider-only") {
		return policy.providers?.include?.includes(provider)
			? null
			: { provider, type: "skill", item: skill.name, reason: "provider-only skill is not declared for this provider" };
	}

	if (policy.portability === "provider-adapted") {
		return {
			provider,
			type: "skill",
			item: skill.name,
			reason: "provider-adapted skill requires an explicit adapter before install",
		};
	}

	const signals = readSkillRuntimeSignals(skill);
	if (signals.length > 0) {
		return { provider, type: "skill", item: skill.name, reason: buildRuntimeBoundReason(signals) };
	}

	return await skipIfSkillDirectoryAuditFails(skill, provider);
}

async function skipIfSkillDirectoryAuditFails(skill: SkillInfo, provider: ProviderType): Promise<PortabilitySkip | null> {
	const audit = await auditSkillDirectory(skill.sourcePath, provider, skill.name, { ignoreRewriteableMarkdown: true });
	if (audit.errors.length === 0) return null;
	const first = audit.errors[0]?.message ?? "runtime-bound Claude references";
	return {
		provider,
		type: "skill",
		item: skill.name,
		reason: `skill directory needs provider review before install: ${first}`,
	};
}

function readSkillRuntimeSignals(skill: SkillInfo): string[] {
	try {
		const content = readFileSync(join(skill.sourcePath, "SKILL.md"), "utf-8");
		return summarizeSkillSkipSignals(content);
	} catch {
		return [];
	}
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
	const typeLabels: Record<PortableType | "skill", { singular: string; plural: string }> = {
		agent: { singular: "agent", plural: "agents" },
		command: { singular: "command", plural: "commands" },
		skill: { singular: "skill", plural: "skills" },
		config: { singular: "config", plural: "configs" },
		rules: { singular: "rule", plural: "rules" },
		hooks: { singular: "hook", plural: "hooks" },
	};
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
			const label = typeLabels[entry.type];
			const typeLabel = entry.count === 1 ? label.singular : label.plural;
			return `Skipped ${entry.count} ${typeLabel} for ${providers[entry.provider].displayName}: ${entry.reason}`;
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
	options?: { allRules?: boolean },
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
		const skip = shouldSkipPortableItem(item, action.provider as ProviderType, options);
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
	opts: RuntimeGateOptions = {},
): Promise<{ skillsByProvider: Map<ProviderType, SkillInfo[]>; skipMessages: string[]; skips: PortabilitySkip[] }> {
	const skillsByProvider = new Map<ProviderType, SkillInfo[]>();
	const skips: PortabilitySkip[] = [];

	for (const target of targets) {
		if (!providers[target].skills) continue;
		const providerSkills: SkillInfo[] = [];
		for (const skill of skills) {
			const skip = await shouldInstallSkillForProvider(skill, target, opts);
			if (skip) {
				skips.push(skip);
			} else {
				providerSkills.push(skill);
			}
		}
		skillsByProvider.set(target, providerSkills);
	}

	return {
		skillsByProvider,
		skipMessages: summarizeSkipCounts(skips),
		skips,
	};
}

export interface SkillParity {
	total: number;
	portable: number;
	adapted: number;
	adaptedDegraded: number;
	includedUnportable: number;
	skipped: number;
	/** Full-parity count = portable + adapted (degraded and forced installs excluded). */
	parityCount: number;
	/** parityCount / total, rounded to a whole percent. `parity: adapted+portable/total`. */
	parityPct: number;
}

/**
 * The Codex skill parity score: how much of the skill surface is portable-or-adapted (full
 * parity), reported honestly against the total. Degraded adapters and `--include-unportable`
 * installs are counted separately and do NOT lift the parity percent — that is the measured
 * metric of the staged full-semantic-parity track. Provider-neutral: pass any non-Claude provider.
 */
export function computeSkillParity(skills: SkillInfo[], provider: ProviderType, opts: RuntimeGateOptions = {}): SkillParity {
	const counts = { portable: 0, adapted: 0, adaptedDegraded: 0, includedUnportable: 0, skipped: 0 };
	for (const skill of skills) {
		const { cls } = classifySkillForProvider(skill, provider, opts);
		if (cls === "portable") counts.portable += 1;
		else if (cls === "adapted") counts.adapted += 1;
		else if (cls === "adapted-degraded") counts.adaptedDegraded += 1;
		else if (cls === "unportable-included") counts.includedUnportable += 1;
		else counts.skipped += 1;
	}
	const total = skills.length;
	const parityCount = counts.portable + counts.adapted;
	return {
		total,
		...counts,
		parityCount,
		parityPct: total === 0 ? 0 : Math.round((parityCount / total) * 100),
	};
}

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTaxonomyOverrides, type ModelTier, type ResolvedModel } from "./model-taxonomy.js";
import { ProviderType } from "./types.js";

type ProviderModelMap = Record<string, Record<string, ResolvedModel>>;

export interface ModelRoutingConfigLoadResult {
	path: string | null;
	overrides: ProviderModelMap | undefined;
	warnings: string[];
}

const TIER_ALIASES: Record<string, ModelTier> = {
	heavy: "heavy",
	complex: "heavy",
	best: "heavy",
	opus: "heavy",
	balanced: "balanced",
	standard: "balanced",
	default: "balanced",
	sonnet: "balanced",
	light: "light",
	trivial: "light",
	cheapest: "light",
	haiku: "light",
};

const EFFORT_KEYS = ["effort", "reasoningEffort", "model_reasoning_effort"] as const;

// Codex documented `model_reasoning_effort` values, mapped per source tier.
// Codex accepts `minimal | low | medium | high | xhigh`; config keys are `model`
// + `model_reasoning_effort` (source: https://developers.openai.com/codex/config-sample).
// We do NOT invent a codex `model` id — that is account/deployment-specific and
// stays user-supplied (or inherits Codex's default). What IS doc-grounded is the
// reasoning-effort ladder, so when a user configures a codex tier model but omits
// the effort, we fill it from this table. Source tier "haiku" therefore no longer
// silently produces "No configured codex model" with no guidance: either the user
// supplies a model (and gets the documented effort) or the resolver returns the
// documented-inherit note (see CODEX_TIER_INHERIT_NOTE).
export const CODEX_TIER_REASONING_EFFORT: Record<ModelTier, string> = {
	heavy: "xhigh",
	balanced: "high",
	light: "medium",
};

// Documented-inherit guidance for a tier with no user-configured codex model.
// Replaces the bare "No configured codex model" gap for source tier haiku (and
// any other tier) with an explicit, actionable note.
export const CODEX_TIER_INHERIT_NOTE =
	"Codex has no built-in model id per source tier; the target inherits Codex's configured default model. " +
	"To pin a model + reasoning effort per tier, set modelRouting.providers.codex.tiers in .meowkit.config.json " +
	"(documented reasoning-effort values: minimal|low|medium|high|xhigh). See https://developers.openai.com/codex/config-sample";

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseModelSpec(value: unknown): ResolvedModel | null {
	if (typeof value === "string") {
		const model = value.trim();
		return model ? { model } : null;
	}
	if (!isRecord(value)) return null;
	const modelValue = value.model;
	if (typeof modelValue !== "string" || modelValue.trim().length === 0) return null;
	const result: ResolvedModel = { model: modelValue.trim() };
	for (const key of EFFORT_KEYS) {
		const effort = value[key];
		if (typeof effort === "string" && effort.trim().length > 0) {
			result.effort = effort.trim();
			break;
		}
	}
	return result;
}

function normalizeTierName(key: string): ModelTier | null {
	return TIER_ALIASES[key.trim().toLowerCase()] ?? null;
}

function addProviderEntry(
	overrides: ProviderModelMap,
	provider: string,
	key: string,
	value: unknown,
	warnings: string[],
): void {
	const providerResult = ProviderType.safeParse(provider);
	if (!providerResult.success) {
		warnings.push(`Ignoring model routing for unknown provider "${provider}"`);
		return;
	}

	const spec = parseModelSpec(value);
	if (!spec) {
		warnings.push(`Ignoring empty model routing value for ${provider}.${key}`);
		return;
	}

	const normalizedKey = key === "default" ? "default" : normalizeTierName(key);
	if (!normalizedKey) {
		warnings.push(`Ignoring unknown model routing tier "${key}" for ${provider}`);
		return;
	}

	// Codex: when the user pins a tier model but omits the reasoning effort, fill
	// it from the documented per-tier ladder (never overriding an explicit value).
	if (provider === "codex" && normalizedKey !== "default" && spec.effort === undefined) {
		const documentedEffort = CODEX_TIER_REASONING_EFFORT[normalizedKey];
		if (documentedEffort) spec.effort = documentedEffort;
	}

	const providerMap = overrides[provider] ?? {};
	providerMap[normalizedKey] = spec;
	overrides[provider] = providerMap;
}

function collectProviderOverrides(config: Record<string, unknown>, warnings: string[]): ProviderModelMap | undefined {
	const routing = config.modelRouting;
	if (!isRecord(routing)) return undefined;

	const overrides: ProviderModelMap = {};
	const providersValue = routing.providers;

	if (isRecord(providersValue)) {
		for (const [provider, rawProviderConfig] of Object.entries(providersValue)) {
			if (!isRecord(rawProviderConfig)) {
				addProviderEntry(overrides, provider, "default", rawProviderConfig, warnings);
				continue;
			}

			if ("default" in rawProviderConfig) {
				addProviderEntry(overrides, provider, "default", rawProviderConfig.default, warnings);
			}

			const tiers = rawProviderConfig.tiers;
			if (isRecord(tiers)) {
				for (const [tier, value] of Object.entries(tiers)) {
					addProviderEntry(overrides, provider, tier, value, warnings);
				}
			}

			for (const [key, value] of Object.entries(rawProviderConfig)) {
				if (key === "default" || key === "tiers") continue;
				addProviderEntry(overrides, provider, key, value, warnings);
			}
		}
	}

	return Object.keys(overrides).length > 0 ? overrides : undefined;
}

export async function loadModelRoutingConfig(cwd = process.cwd()): Promise<ModelRoutingConfigLoadResult> {
	const candidates = [join(cwd, ".meowkit.config.json"), join(cwd, ".claude", "meowkit.config.json")];
	const path = candidates.find((candidate) => existsSync(candidate)) ?? null;
	const warnings: string[] = [];

	if (!path) {
		setTaxonomyOverrides(undefined);
		return { path: null, overrides: undefined, warnings };
	}

	try {
		const parsed = JSON.parse(await readFile(path, "utf-8")) as unknown;
		if (!isRecord(parsed)) {
			warnings.push(`${path} is valid JSON but not an object; model routing ignored`);
			setTaxonomyOverrides(undefined);
			return { path, overrides: undefined, warnings };
		}

		const overrides = collectProviderOverrides(parsed, warnings);
		setTaxonomyOverrides(overrides);
		return { path, overrides, warnings };
	} catch (err) {
		warnings.push(
			`${path} could not be read as JSON; model routing ignored (${err instanceof Error ? err.message : String(err)})`,
		);
		setTaxonomyOverrides(undefined);
		return { path, overrides: undefined, warnings };
	}
}

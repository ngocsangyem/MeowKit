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
		warnings.push(`${path} could not be read as JSON; model routing ignored (${err instanceof Error ? err.message : String(err)})`);
		setTaxonomyOverrides(undefined);
		return { path, overrides: undefined, warnings };
	}
}

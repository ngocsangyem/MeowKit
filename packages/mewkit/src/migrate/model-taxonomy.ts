// Vendored from claudekit-cli (MIT). Source: src/commands/portable/model-taxonomy.ts
// Provider-agnostic model tier mapping (opus/sonnet/haiku → target equivalents).

export type ModelTier = "heavy" | "balanced" | "light";

export interface ResolvedModel {
	model: string;
	effort?: string;
}

export interface ModelResolveResult {
	resolved: ResolvedModel | null;
	warning?: string;
}

export const OPENCODE_DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

const SOURCE_TIER_MAP: Record<string, ModelTier> = {
	opus: "heavy",
	sonnet: "balanced",
	haiku: "light",
};

export const DEFAULT_PROVIDER_MODEL_MAP: Record<string, Record<ModelTier, ResolvedModel>> = {
	codex: {
		heavy: { model: "gpt-5.4", effort: "xhigh" },
		balanced: { model: "gpt-5.4", effort: "high" },
		light: { model: "gpt-5.4-mini", effort: "medium" },
	},
	"gemini-cli": {
		heavy: { model: "gemini-3.1-pro-preview" },
		balanced: { model: "gemini-3.1-pro-preview" },
		light: { model: "gemini-3-flash-preview" },
	},
};

let userOverrides: Record<string, Record<string, ResolvedModel>> | undefined;

export function setTaxonomyOverrides(
	overrides: Record<string, Record<string, ResolvedModel>> | undefined,
): void {
	userOverrides = overrides;
}

export function resolveOpenCodeDefaultModel(): string {
	return userOverrides?.opencode?.default?.model ?? OPENCODE_DEFAULT_MODEL;
}

export function getOpenCodeDefaultModelOverride(): string | undefined {
	return userOverrides?.opencode?.default?.model;
}

export function resolveModel(
	sourceModel: string | undefined,
	targetProvider: string,
): ModelResolveResult {
	if (sourceModel === undefined || sourceModel === null) return { resolved: null };
	if (typeof sourceModel !== "string") {
		return {
			resolved: null,
			warning: `Ignored non-string model frontmatter (${typeof sourceModel})`,
		};
	}

	const trimmed = sourceModel.trim();
	if (!trimmed || trimmed === "inherit") return { resolved: null };

	const tier = SOURCE_TIER_MAP[trimmed];
	if (!tier) {
		return { resolved: null, warning: `Unknown model "${trimmed}" — not in taxonomy, commented out` };
	}

	const overrideMap = userOverrides?.[targetProvider];
	if (overrideMap) {
		const override = overrideMap[tier];
		if (override) return { resolved: override };
	}

	const providerMap = DEFAULT_PROVIDER_MODEL_MAP[targetProvider];
	if (!providerMap) return { resolved: null };

	return { resolved: providerMap[tier] };
}

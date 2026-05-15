// Vendored from claudekit-cli (MIT). Source: src/commands/portable/model-taxonomy.ts
// Provider-agnostic model tier mapping (opus/sonnet/haiku → configured target equivalents).

export type ModelTier = "heavy" | "balanced" | "light";

export interface ResolvedModel {
	model: string;
	effort?: string;
}

export interface ModelResolveResult {
	resolved: ResolvedModel | null;
	warning?: string;
}

const SOURCE_TIER_MAP: Record<string, ModelTier> = {
	opus: "heavy",
	sonnet: "balanced",
	haiku: "light",
};

let userOverrides: Record<string, Record<string, ResolvedModel>> | undefined;

export function setTaxonomyOverrides(overrides: Record<string, Record<string, ResolvedModel>> | undefined): void {
	userOverrides = overrides;
}

export function resolveOpenCodeDefaultModel(): string | undefined {
	return userOverrides?.opencode?.default?.model;
}

export function getOpenCodeDefaultModelOverride(): string | undefined {
	return userOverrides?.opencode?.default?.model;
}

export function resolveModel(sourceModel: string | undefined, targetProvider: string): ModelResolveResult {
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

	return {
		resolved: null,
		warning: `No configured ${targetProvider} model for source tier "${trimmed}" — target will inherit its default`,
	};
}

export function resolveProviderDefaultModel(targetProvider: string): ResolvedModel | null {
	return userOverrides?.[targetProvider]?.default ?? null;
}

export function rewriteConfiguredModelReferences(content: string, targetProvider: string): string {
	return content.replace(/(--model\s+)(opus|sonnet|haiku)\b/gi, (matched, prefix: string, tierName: string) => {
		const resolved = resolveModel(tierName.toLowerCase(), targetProvider).resolved;
		return resolved?.model ? `${prefix}${resolved.model}` : matched;
	});
}

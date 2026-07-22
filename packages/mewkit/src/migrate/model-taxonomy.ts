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

/**
 * A NAMED model profile — resolved before tier mapping and deliberately
 * ORTHOGONAL to `ModelTier`.
 *
 * Why not a tier: a tier answers "how much capability does this task need",
 * and every consumer maps the closed `ModelTier` union exhaustively
 * (`Record<ModelTier, …>` in model-routing-config.ts). Growing that union to
 * express "this specific model" would compile-break every such map and conflate
 * two different questions. A profile answers "this named model specifically" —
 * so it resolves first and leaves the tier ladder untouched.
 *
 * Why not `if (model === "fable")` next to resolveModel: a one-off branch is a
 * parallel schema that the next named profile has to copy. A table means the
 * second profile is a row, not a rewrite.
 */
export interface ModelProfile {
	/** The verified runtime identifier on providers that support it. */
	identifier: string;
	/** Providers that resolve this profile natively. Everything else falls back. */
	supportedProviders: readonly string[];
	/** Tier used for the DISCLOSED fallback on unsupported providers. */
	fallbackTier: ModelTier;
	/** How `identifier` was verified — so a rename is traceable, not archaeology. */
	evidence: string;
}

/**
 * Named profiles, keyed by the string that appears in frontmatter (`model: fable`).
 *
 * The identifier lives in exactly one place: a model rename is a one-line edit
 * here, not a grep across converters.
 */
const NAMED_PROFILES: Record<string, ModelProfile> = {
	fable: {
		identifier: "claude-fable-5",
		// Claude Code resolves Claude model ids natively. Every other target in
		// ProviderType is a different vendor's host: asserting they can run a
		// Claude model would be an over-claim, so they take the disclosed fallback.
		supportedProviders: ["claude-code"],
		fallbackTier: "heavy",
		evidence: "claude-api skill model table (cached 2026-06-24) + its shared/models.md — exact id, no date suffix",
	},
};

/**
 * Resolve a named profile for a target provider.
 *
 * Two honest outcomes, never a third: the provider supports the profile and gets
 * the verified identifier, or it does not and gets a fallback that SAYS SO.
 * Silently substituting a different model would mean a skill that asked for a
 * specific model quietly ran on another one.
 */
function resolveNamedProfile(name: string, profile: ModelProfile, targetProvider: string): ModelResolveResult {
	if (profile.supportedProviders.includes(targetProvider)) {
		return { resolved: { model: profile.identifier } };
	}

	const fallback = userOverrides?.[targetProvider]?.[profile.fallbackTier];
	if (fallback) {
		return {
			resolved: fallback,
			warning:
				`Model profile "${name}" (${profile.identifier}) is not available on ${targetProvider} — ` +
				`falling back to the configured "${profile.fallbackTier}" model "${fallback.model}". ` +
				`This is a substitution, not an equivalent.`,
		};
	}

	return {
		resolved: null,
		warning:
			`Model profile "${name}" (${profile.identifier}) is not available on ${targetProvider}, ` +
			`and no "${profile.fallbackTier}" model is configured for it — the target will inherit its default. ` +
			`To pin one, set modelRouting.providers.${targetProvider}.tiers.${profile.fallbackTier} in .meowkit.config.json.`,
	};
}

let userOverrides: Record<string, Record<string, ResolvedModel>> | undefined;

export function setTaxonomyOverrides(overrides: Record<string, Record<string, ResolvedModel>> | undefined): void {
	userOverrides = overrides;
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

	// Named profiles resolve BEFORE tier mapping: they name a specific model, which
	// the tier ladder cannot express. Keeping this ahead of SOURCE_TIER_MAP is what
	// makes the profile tier-orthogonal rather than a fourth tier.
	const profile = NAMED_PROFILES[trimmed];
	if (profile) return resolveNamedProfile(trimmed, profile, targetProvider);

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

/** Every named profile, for diagnostics and tests. Read-only view of the table. */
export function listModelProfiles(): ReadonlyArray<{ name: string; profile: ModelProfile }> {
	return Object.entries(NAMED_PROFILES).map(([name, profile]) => ({ name, profile }));
}

/** True when `targetProvider` resolves `name` natively (vs. taking a disclosed fallback). */
export function providerSupportsProfile(name: string, targetProvider: string): boolean {
	return NAMED_PROFILES[name]?.supportedProviders.includes(targetProvider) ?? false;
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

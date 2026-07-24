// Composer that assembles the `providers` singleton from per-provider manifests.
//
// Pipeline per manifest:
//   1. structural clone of `config` (so the source manifest is never mutated)
//   2. `overrides?.(clone)`        — provider-specific patches run FIRST
//   3. disable undocumented surfaces using `contract.surfaces[type].status`
//
// Order rationale: running overrides BEFORE the disable loop guarantees that a
// patch targeting an undocumented surface is nulled by the filter rather than
// escaping it. The trade-off is intentional — see manifest-types.ts.

import type { PortableType, ProviderConfig, ProviderType } from "../types.js";
import type { ProviderCapabilityRegistryEntry } from "./contract-types.js";
import type { ProviderManifest } from "./manifest-types.js";

export type { ProviderManifest } from "./manifest-types.js";

import { claudeCodeManifest } from "./claude-code/index.js";
import { codexManifest } from "./codex/index.js";
import { cursorManifest } from "./cursor/index.js";

const PORTABLE_SURFACES: readonly PortableType[] = ["agent", "command", "skill", "config", "rules", "hooks"];

const SURFACE_FIELDS = {
	agent: "agents",
	command: "commands",
	skill: "skills",
	config: "config",
	rules: "rules",
	hooks: "hooks",
} as const satisfies Record<PortableType, keyof ProviderConfig>;

/**
 * Holds the per-provider manifests in declaration order.
 * Order matches the `providers` object in provider-registry.ts so that
 * getAllProviderTypes() iteration order is preserved.
 */
export const manifestRegistry: ProviderManifest[] = [claudeCodeManifest, codexManifest, cursorManifest];

function cloneConfig(config: ProviderConfig): ProviderConfig {
	const { detect, ...rest } = config;
	const clone = structuredClone(rest) as Omit<ProviderConfig, "detect">;
	return { ...clone, detect } as ProviderConfig;
}

/** Apply the per-provider override callback, if any. */
export function applyOverrides(config: ProviderConfig, overrides: ProviderManifest["overrides"]): void {
	if (overrides) overrides(config);
}

/**
 * Null any portable-surface field whose contract status is not "documented".
 * Mirrors the legacy `applyMewkitOverrides()` disable loop.
 */
export function disableUndocumentedSurfaces(config: ProviderConfig, contract: ProviderCapabilityRegistryEntry): void {
	for (const surface of PORTABLE_SURFACES) {
		const documented = contract.surfaces[surface]?.status === "documented";
		if (documented) continue;
		const field = SURFACE_FIELDS[surface];
		(config as unknown as Record<string, unknown>)[field] = null;
	}
}

function assertUniqueIds(manifests: ProviderManifest[]): void {
	const seen = new Set<string>();
	for (const m of manifests) {
		if (seen.has(m.id)) {
			throw new Error(`[mewkit] duplicate provider manifest id: "${m.id}"`);
		}
		seen.add(m.id);
	}
}

/**
 * Build the runtime `providers` record from a manifest list.
 * Applies overrides and disables undocumented surfaces.
 * Order is preserved — first manifest wins position in the resulting record.
 */
export function buildProviders(manifests: ProviderManifest[] = manifestRegistry): Record<ProviderType, ProviderConfig> {
	assertUniqueIds(manifests);
	const out = {} as Record<ProviderType, ProviderConfig>;
	for (const manifest of manifests) {
		const config = cloneConfig(manifest.config);
		applyOverrides(config, manifest.overrides);
		disableUndocumentedSurfaces(config, manifest.contract);
		out[manifest.id as ProviderType] = config;
	}
	return out;
}

/**
 * Build provider configs from manifests WITHOUT disabling undocumented surfaces.
 * Used by `provider-registry.ts` so the `providers` export preserves the
 * pre-override state that `applyMewkitOverrides()` expects to mutate in-place.
 * The disable loop runs later when `applyMewkitOverrides()` is called.
 */
export function buildProvidersRaw(
	manifests: ProviderManifest[] = manifestRegistry,
): Record<ProviderType, ProviderConfig> {
	assertUniqueIds(manifests);
	const out = {} as Record<ProviderType, ProviderConfig>;
	for (const manifest of manifests) {
		const config = cloneConfig(manifest.config);
		applyOverrides(config, manifest.overrides);
		// Deliberately skips disableUndocumentedSurfaces — applyMewkitOverrides()
		// handles that step for all providers uniformly after construction.
		out[manifest.id as ProviderType] = config;
	}
	return out;
}

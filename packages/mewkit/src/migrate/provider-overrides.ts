// Disable-undocumented-surfaces pass kept here for compatibility with callers
// that invoke applyMewkitOverrides() at boot. Per-provider override patches
// now live next to their provider in `./providers/{id}/overrides.ts` and the
// composer in `./providers/index.ts` runs them at module load.
//
// This file remains because `migrate/index.ts:6` exports it via `export *`,
// making applyMewkitOverrides + OverrideOptions + _resetOverridesForTest part
// of the public API. The body is intentionally narrow.

import { providerDocumentationContracts } from "./provider-documentation-contracts.js";
import { providers } from "./provider-registry.js";
import type { PortableType, ProviderConfig, ProviderType } from "./types.js";

let overridesApplied = false;

const portableTypes: PortableType[] = ["agent", "command", "skill", "config", "rules", "hooks"];

function disablePortableSurface(provider: ProviderConfig, portableType: PortableType): void {
	switch (portableType) {
		case "agent":
			provider.agents = null;
			return;
		case "command":
			provider.commands = null;
			return;
		case "skill":
			provider.skills = null;
			return;
		case "config":
			provider.config = null;
			return;
		case "rules":
			provider.rules = null;
			return;
		case "hooks":
			provider.hooks = null;
			return;
	}
}

/** Retained for backward compatibility; all fields are currently unused. */
export type OverrideOptions = Record<string, never>;

export function applyMewkitOverrides(_options: OverrideOptions = {}): void {
	if (overridesApplied) return;

	// Disable undocumented or approximation-only surfaces. Migration should only emit
	// files that are backed by official tool documentation.
	for (const [provider, contract] of Object.entries(providerDocumentationContracts) as [
		ProviderType,
		(typeof providerDocumentationContracts)[ProviderType],
	][]) {
		for (const portableType of portableTypes) {
			const surface = contract.surfaces[portableType];
			if (surface?.status === "documented") continue;
			disablePortableSurface(providers[provider], portableType);
		}
	}

	overridesApplied = true;
}

/** Reset for tests. */
export function _resetOverridesForTest(): void {
	overridesApplied = false;
}

// Per-provider manifest shape consumed by the composer in `./index.ts`.
//
// `id` is typed `string` (not `ProviderType`) on purpose: the zod ProviderType enum
// is derived from the registry's own IDs once `ProviderConfig` lives outside
// `types.ts`. Using `string` here breaks the circular import path
// `types.ts → providers/index.ts → manifest-types.ts → types.ts` so the enum can
// safely be constructed against PROVIDER_IDS without hitting `undefined` at
// module init. Uniqueness is asserted at runtime by the composer.

import type { ProviderConfig } from "./provider-config-types.js";
import type { ProviderCapabilityRegistryEntry } from "./contract-types.js";

export interface ProviderManifest {
	/** Stable identifier; must match `config.name`. */
	id: string;
	/** Static `ProviderConfig` literal — paths, formats, detect closure. */
	config: ProviderConfig;
	/** Documentation contract — surfaces + capabilities + doc URLs. */
	contract: ProviderCapabilityRegistryEntry;
	/**
	 * Optional in-place mutator applied BEFORE the undocumented-surface disable
	 * loop. Patches that target an undocumented surface will be silently nulled
	 * by the disable loop — this is the intended safety semantics.
	 */
	overrides?: (config: ProviderConfig) => void;
	/** Optional provider-specific data blob (e.g., codex capability table). */
	capabilities?: unknown;
}

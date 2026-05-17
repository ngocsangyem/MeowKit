// Vendored from claudekit-cli (MIT). Source: src/commands/portable/provider-registry.ts
// Provider data has been split into per-provider modules under `./providers/`.
// This file is now a thin shim: it composes the singleton `providers` map from
// the manifest registry and re-exports the binary detection cache so callers
// importing from this path keep the same singleton instance.

import { buildProvidersRaw, manifestRegistry } from "./providers/index.js";
import type { ProviderConfig, ProviderType } from "./types.js";

export { binaryCache, hasBinaryInPath } from "./providers/detection-helpers.js";

// Compose configs WITHOUT the surface-disable step so that the providers
// singleton matches the pre-refactor module-load state. applyMewkitOverrides()
// runs the disable loop uniformly when first invoked — preserving callers that
// observe the pre-disable map at import time.
export const providers: Record<ProviderType, ProviderConfig> = buildProvidersRaw(manifestRegistry);

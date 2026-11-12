// Vendored from claudekit-cli (MIT). Source: src/commands/portable/provider-registry.ts
// Provider data has been split into per-provider modules under `./providers/`.
// This file is now a thin shim: it composes the singleton `providers` map from
// the manifest registry and re-exports the binary detection cache so callers
// importing from this path keep the same singleton instance.

import { buildProvidersRaw, manifestRegistry } from "./providers/index.js";
import type { ProviderConfig, ProviderType } from "./types.js";

export { binaryCache, hasBinaryInPath } from "./providers/detection-helpers.js";

// Compose configs WITHOUT the surface-disable step. Callers read surfaces from
// this raw view too (portability-policy reads `skills`, the reference-target
// registry reads per-type paths), so switching it to buildProviders() changes
// what they see; do that only deliberately.
export const providers: Record<ProviderType, ProviderConfig> = buildProvidersRaw(manifestRegistry);

// Per-provider contract data has moved next to each provider under
// `./providers/{id}/contract.ts`. This module aggregates them so legacy
// helpers (`getProviderCapabilityContract`, `getProviderSurfaceContract`,
// `hasProviderCapability`, `supportsPortableSurface`) and the legacy
// `applyMewkitOverrides()` disable loop keep working unchanged.
//
// New code SHOULD prefer importing the per-provider contract directly or via
// `providers/contract-types.ts`. The types here remain the public type surface
// re-exported through `migrate/index.ts`.

import type { PortableType, ProviderType } from "./types.js";
import { claudeCodeContract } from "./providers/claude-code/contract.js";
import { codexContract } from "./providers/codex/contract.js";
import { cursorContract } from "./providers/cursor/contract.js";

export type {
	ProviderSupportStatus,
	ProviderSupportContract,
	ProviderCapabilityName,
	ProviderCapabilityRegistryEntry,
} from "./providers/contract-types.js";

import type {
	ProviderCapabilityName,
	ProviderCapabilityRegistryEntry,
	ProviderSupportContract,
} from "./providers/contract-types.js";

export const providerCapabilityRegistry: Record<ProviderType, ProviderCapabilityRegistryEntry> = {
	"claude-code": claudeCodeContract,
	codex: codexContract,
	cursor: cursorContract,
};

export const providerDocumentationContracts = providerCapabilityRegistry;

export function getProviderCapabilityContract(
	provider: ProviderType,
	capability: ProviderCapabilityName,
): ProviderSupportContract {
	return providerCapabilityRegistry[provider].capabilities[capability];
}

export function getProviderSurfaceContract(provider: ProviderType, type: PortableType): ProviderSupportContract {
	return (
		providerCapabilityRegistry[provider].surfaces[type] ?? {
			status: "unsupported",
			docs: providerCapabilityRegistry[provider].docs,
			note: "No officially documented migration surface was verified for this provider/type.",
		}
	);
}

export function hasProviderCapability(provider: ProviderType, capability: ProviderCapabilityName): boolean {
	return getProviderCapabilityContract(provider, capability).status === "documented";
}

export function supportsPortableSurface(provider: ProviderType, type: PortableType): boolean {
	return getProviderSurfaceContract(provider, type).status === "documented";
}

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
import { opencodeContract } from "./providers/opencode/contract.js";
import { githubCopilotContract } from "./providers/github-copilot/contract.js";
import { codexContract } from "./providers/codex/contract.js";
import { droidContract } from "./providers/droid/contract.js";
import { cursorContract } from "./providers/cursor/contract.js";
import { rooContract } from "./providers/roo/contract.js";
import { kiloContract } from "./providers/kilo/contract.js";
import { kiroContract } from "./providers/kiro/contract.js";
import { windsurfContract } from "./providers/windsurf/contract.js";
import { gooseContract } from "./providers/goose/contract.js";
import { geminiCliContract } from "./providers/gemini-cli/contract.js";
import { ampContract } from "./providers/amp/contract.js";
import { antigravityContract } from "./providers/antigravity/contract.js";
import { clineContract } from "./providers/cline/contract.js";
import { openhandsContract } from "./providers/openhands/contract.js";

export type {
	ProviderSupportStatus,
	ProviderSupportContract,
	ProviderCapabilityName,
	ProviderCapabilityRegistryEntry,
} from "./providers/contract-types.js";

import type { ProviderCapabilityName, ProviderCapabilityRegistryEntry, ProviderSupportContract } from "./providers/contract-types.js";

export const providerCapabilityRegistry: Record<ProviderType, ProviderCapabilityRegistryEntry> = {
	"claude-code": claudeCodeContract,
	opencode: opencodeContract,
	"github-copilot": githubCopilotContract,
	codex: codexContract,
	droid: droidContract,
	cursor: cursorContract,
	roo: rooContract,
	kilo: kiloContract,
	kiro: kiroContract,
	windsurf: windsurfContract,
	goose: gooseContract,
	"gemini-cli": geminiCliContract,
	amp: ampContract,
	antigravity: antigravityContract,
	cline: clineContract,
	openhands: openhandsContract,
};

export const providerDocumentationContracts = providerCapabilityRegistry;

export function getProviderCapabilityContract(
	provider: ProviderType,
	capability: ProviderCapabilityName,
): ProviderSupportContract {
	return providerCapabilityRegistry[provider].capabilities[capability];
}

export function getProviderSurfaceContract(
	provider: ProviderType,
	type: PortableType,
): ProviderSupportContract {
	return (
		providerCapabilityRegistry[provider].surfaces[type] ?? {
			status: "unsupported",
			docs: providerCapabilityRegistry[provider].docs,
			note: "No officially documented migration surface was verified for this provider/type.",
		}
	);
}

export function hasProviderCapability(
	provider: ProviderType,
	capability: ProviderCapabilityName,
): boolean {
	return getProviderCapabilityContract(provider, capability).status === "documented";
}

export function supportsPortableSurface(provider: ProviderType, type: PortableType): boolean {
	return getProviderSurfaceContract(provider, type).status === "documented";
}

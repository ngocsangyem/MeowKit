// Canonical types for the per-provider documentation/capability contract.
// `../provider-documentation-contracts.ts` re-exports these names for backward
// compat with consumers that import via the legacy module path.

import type { PortableType } from "../types.js";

export type ProviderSupportStatus = "documented" | "unsupported" | "partial";

export interface ProviderSupportContract {
	status: ProviderSupportStatus;
	docs: string[];
	note?: string;
}

export type ProviderCapabilityName =
	| "instruction_files"
	| "rules"
	| "hooks"
	| "agents"
	| "skills"
	| "commands"
	| "memory"
	| "mcp"
	| "orchestration"
	| "persistent_context"
	| "workspace_config"
	| "system_prompts"
	| "runtime_variables"
	| "setup_scripts";

export interface ProviderCapabilityRegistryEntry {
	docs: string[];
	lastVerified: string;
	surfaces: Partial<Record<PortableType, ProviderSupportContract>>;
	capabilities: Record<ProviderCapabilityName, ProviderSupportContract>;
}

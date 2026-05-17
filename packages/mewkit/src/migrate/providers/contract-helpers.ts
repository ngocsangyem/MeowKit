// Shared helpers for per-provider contract.ts files.
// Extracted once to avoid repeating LAST_VERIFIED + helper functions across all 11 contract files.
import type { ProviderCapabilityName, ProviderSupportContract } from "./contract-types.js";

export const LAST_VERIFIED = "2026-05-16";

export const unsupported = (docs: string[], note?: string): ProviderSupportContract => ({
	status: "unsupported",
	docs,
	note,
});

export const documented = (docs: string[], note?: string): ProviderSupportContract => ({
	status: "documented",
	docs,
	note,
});

export const partial = (docs: string[], note?: string): ProviderSupportContract => ({
	status: "partial",
	docs,
	note,
});

export function buildCapabilities(
	docs: string[],
	overrides: Partial<Record<ProviderCapabilityName, ProviderSupportContract>>,
): Record<ProviderCapabilityName, ProviderSupportContract> {
	return {
		instruction_files: unsupported(docs),
		rules: unsupported(docs),
		hooks: unsupported(docs),
		agents: unsupported(docs),
		skills: unsupported(docs),
		commands: unsupported(docs),
		memory: unsupported(docs),
		mcp: unsupported(docs),
		orchestration: unsupported(docs),
		persistent_context: unsupported(docs),
		workspace_config: unsupported(docs),
		system_prompts: unsupported(docs),
		runtime_variables: unsupported(docs),
		setup_scripts: unsupported(docs),
		...overrides,
	};
}

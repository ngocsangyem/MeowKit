import type { CheckResult } from "../../commands/validate.js";

// Target-aware validation (Phase 6). A generated PROVIDER project (e.g. a migrated Codex
// tree) has no `.claude/` — the normal `validate` bails with "no .claude/ found". A
// `TargetProfile` knows how to validate ONE provider's generated layout instead.
//
// The set is provider-KEYED so a future provider adds a profile here, not a new CLI command
// (generic-toolkit constraint). `mewkit validate --target <provider> <dir>` looks the profile
// up by name and runs its read-only checks against <dir>.

export interface TargetProfile {
	/** Provider key, e.g. "codex". Matches the `--target <provider>` argument. */
	name: string;
	/** True when <dir> looks like this provider's generated project (cheap layout sniff). */
	detect(dir: string): boolean;
	/** Read-only checks over the generated <dir>. Returns per-check CheckResults. */
	check(dir: string): Promise<CheckResult[]>;
}

import { codexTargetProfile } from "./codex-target.js";

/** All registered target profiles, keyed by provider. Add a provider ⇒ add a row here. */
export const TARGET_PROFILES: Readonly<Record<string, TargetProfile>> = {
	codex: codexTargetProfile,
};

export function getTargetProfile(provider: string): TargetProfile | null {
	return TARGET_PROFILES[provider] ?? null;
}

export function targetProfileNames(): string[] {
	return Object.keys(TARGET_PROFILES);
}

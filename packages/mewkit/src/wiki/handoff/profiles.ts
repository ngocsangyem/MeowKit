// Per-skill handoff profile registry. Assembled from the profile-family files;
// lookup is a name-keyed map read with a fail-quiet `none` default. The registry
// NEVER reads .claude/skills or plugin/skills at runtime — a downstream project
// whose installed skill set differs from the source repo still resolves cleanly
// (unknown skill → class "none", no suggestion).

import { makeSkillProfile } from "./profile-factory.js";
import type { ArtifactSignal, SkillHandoffProfile } from "./domain.js";
import { lifecycleProfiles } from "./profiles/lifecycle.js";
import { researchProfiles } from "./profiles/research.js";
import { reviewProfiles } from "./profiles/review.js";
import { securityProfiles } from "./profiles/security.js";
import { externalProfiles } from "./profiles/external.js";
import { frameworkProfiles } from "./profiles/framework.js";

const ALL_PROFILES: SkillHandoffProfile[] = [
	...lifecycleProfiles,
	...researchProfiles,
	...reviewProfiles,
	...securityProfiles,
	...externalProfiles,
	...frameworkProfiles,
];

const REGISTRY = new Map<string, SkillHandoffProfile>();
for (const entry of ALL_PROFILES) {
	if (REGISTRY.has(entry.skillName)) {
		throw new Error(`duplicate handoff profile for skill: ${entry.skillName}`);
	}
	REGISTRY.set(entry.skillName, entry);
}

/** The fail-quiet default for any unregistered skill: class "none", never suggests. */
export const NONE_PROFILE: SkillHandoffProfile = makeSkillProfile({
	skillName: "*",
	handoffClass: "none",
	profile: "none",
	defaultReuseScope: "",
	artifactPatterns: [],
	salienceBase: {},
});

/** Resolve a skill's profile by name. Unknown/unregistered skills get the `none`
 * default (carrying the queried name) — never throws, never touches the filesystem. */
export function lookupProfile(skillName: string): SkillHandoffProfile {
	const found = REGISTRY.get(skillName);
	if (found) return found;
	return { ...NONE_PROFILE, skillName };
}

/** All registered (class A/B) profiles, sorted by skill name. Unregistered skills
 * are class "none" by default and are not listed individually. */
export function listProfiles(): SkillHandoffProfile[] {
	return [...REGISTRY.values()].sort((a, b) => a.skillName.localeCompare(b.skillName));
}

/** Convenience: does this skill carry a non-`none` registered profile? */
export function isRegistered(skillName: string): boolean {
	return REGISTRY.has(skillName);
}

export type { ArtifactSignal };

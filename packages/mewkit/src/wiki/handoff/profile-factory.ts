// Construction helpers for the handoff profile registry. Separated from domain.ts so the
// domain file stays pure type vocabulary; this file holds the (still pure, no-IO) logic that
// turns declarative specs into registry rows and derives salience/suggestion from a signal.

import type { SalienceComponents } from "../domain/index.js";
import type { ArtifactSignal, SkillHandoffProfile, WikiHandoffClass, WikiHandoffProfileTag } from "./domain.js";

/** Build a full SalienceComponents from a partial, zero-filling the rest. */
export function salienceComponents(overrides: Partial<SalienceComponents> = {}): SalienceComponents {
	return {
		explicit_user_intent: 0,
		verified_outcome: 0,
		recurrence_or_friction: 0,
		novelty_vs_existing_wiki: 0,
		future_reuse_likelihood: 0,
		source_quality: 0,
		blast_radius: 0,
		security_risk_penalty: 0,
		staleness_penalty: 0,
		...overrides,
	};
}

/** Declarative spec for a registry row. Family files supply data; `makeSkillProfile`
 * derives the `defaultSalience`/`shouldSuggest` behavior from the class + base. */
export interface ProfileSpec {
	skillName: string;
	handoffClass: WikiHandoffClass;
	profile: WikiHandoffProfileTag;
	defaultReuseScope: string;
	artifactPatterns: string[];
	/** Profile-typical salience emphasis before signal nudges. */
	salienceBase: Partial<SalienceComponents>;
}

/** Class-driven suggestion policy. `none` never suggests; `required` suggests for any
 * substantive artifact; `conditional` suggests only on a project-specific signal. */
export function defaultShouldSuggest(handoffClass: WikiHandoffClass, signal: ArtifactSignal): boolean {
	if (handoffClass === "none") return false;
	if (signal.contentBytes <= 0) return false;
	if (handoffClass === "required") return true;
	return Boolean(
		signal.verifiedOutcome || signal.explicitUserIntent || signal.recurringFriction || (signal.noveltyDelta ?? 0) > 0,
	);
}

/** Turn a declarative spec into a registry row. The salience function starts from the
 * profile base and lets concrete signals raise intent/verified/recurrence and override
 * novelty + the two penalties. */
export function makeSkillProfile(spec: ProfileSpec): SkillHandoffProfile {
	return {
		skillName: spec.skillName,
		handoffClass: spec.handoffClass,
		profile: spec.profile,
		defaultReuseScope: spec.defaultReuseScope,
		artifactPatterns: spec.artifactPatterns,
		defaultSalience(signal: ArtifactSignal): SalienceComponents {
			const base = salienceComponents(spec.salienceBase);
			return salienceComponents({
				...spec.salienceBase,
				explicit_user_intent: signal.explicitUserIntent ? 3 : base.explicit_user_intent,
				verified_outcome: signal.verifiedOutcome ? 3 : base.verified_outcome,
				recurrence_or_friction: signal.recurringFriction ? 2 : base.recurrence_or_friction,
				novelty_vs_existing_wiki: signal.noveltyDelta ?? base.novelty_vs_existing_wiki,
				security_risk_penalty: signal.securityRiskPenalty ?? base.security_risk_penalty,
				staleness_penalty: signal.stalenessPenalty ?? base.staleness_penalty,
			});
		},
		shouldSuggest(signal: ArtifactSignal): boolean {
			return defaultShouldSuggest(spec.handoffClass, signal);
		},
	};
}

/** Expand a shared profile spec across many skill names — one registry row each.
 * Keeps family files declarative: a profile group is a `common` spec plus a name list. */
export function defineGroup(common: Omit<ProfileSpec, "skillName">, skillNames: string[]): SkillHandoffProfile[] {
	return skillNames.map((skillName) => makeSkillProfile({ ...common, skillName }));
}

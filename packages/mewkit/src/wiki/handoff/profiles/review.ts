// Review-verdict profile family. Skills that produce a graded verdict or
// re-examined finding — WARN/FAIL patterns and accepted policy are worth recall;
// routine clean PASS is not (gated by salience, not by class).
import { defineGroup } from "../profile-factory.js";
import type { SkillHandoffProfile } from "../domain.js";

export const reviewProfiles: SkillHandoffProfile[] = [
	...defineGroup(
		{
			handoffClass: "required",
			profile: "review-verdict",
			defaultReuseScope: "review",
			artifactPatterns: ["tasks/reviews/*.md", "tasks/reports/*.md"],
			salienceBase: {
				verified_outcome: 2,
				source_quality: 2,
				future_reuse_likelihood: 2,
				blast_radius: 1,
			},
		},
		["mk:elicit", "mk:evaluate", "mk:respond-pr", "mk:review", "mk:review-pr", "mk:validate-plan"],
	),
];

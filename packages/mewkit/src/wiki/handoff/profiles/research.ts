// Planning + decision profile family. Skills that set scope or record a chosen
// direction — the kind of context whose absence makes a later agent repeat a debate.
import { defineGroup } from "../profile-factory.js";
import type { SkillHandoffProfile } from "../domain.js";

export const researchProfiles: SkillHandoffProfile[] = [
	...defineGroup(
		{
			handoffClass: "required",
			profile: "planning-report",
			defaultReuseScope: "planning",
			artifactPatterns: ["tasks/plans/*/plan.md", "tasks/reports/*.md"],
			salienceBase: {
				explicit_user_intent: 1,
				verified_outcome: 1,
				future_reuse_likelihood: 2,
				source_quality: 2,
				blast_radius: 1,
			},
		},
		[
			"mk:brainstorming",
			"mk:plan-ceo-review",
			"mk:plan-creator",
			"mk:planning-engine",
			"mk:sprint-contract",
			"mk:story-sizer",
		],
	),
	...defineGroup(
		{
			handoffClass: "required",
			profile: "decision-record",
			defaultReuseScope: "decisions",
			artifactPatterns: ["docs/architecture/adr/*.md", "tasks/reports/*.md"],
			salienceBase: {
				explicit_user_intent: 2,
				future_reuse_likelihood: 2,
				source_quality: 2,
				blast_radius: 1,
			},
		},
		["mk:office-hours", "mk:party", "mk:retro"],
	),
];

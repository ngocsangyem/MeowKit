// Lifecycle + root-cause profile family. Skills that orchestrate a full run or
// diagnose a defect — their terminal report is high-value recall for later agents.
import { defineGroup } from "../profile-factory.js";
import type { SkillHandoffProfile } from "../domain.js";

export const lifecycleProfiles: SkillHandoffProfile[] = [
	...defineGroup(
		{
			handoffClass: "required",
			profile: "lifecycle-run",
			defaultReuseScope: "lifecycle",
			artifactPatterns: ["tasks/reports/*.md", "tasks/reviews/*.md", "tasks/autobuild-runs/*"],
			salienceBase: {
				verified_outcome: 2,
				source_quality: 2,
				future_reuse_likelihood: 2,
				blast_radius: 1,
			},
		},
		["mk:autobuild", "mk:benchmark", "mk:cook", "mk:loop", "mk:trace-analyze", "mk:workflow-orchestrator"],
	),
	...defineGroup(
		{
			handoffClass: "required",
			profile: "root-cause",
			defaultReuseScope: "debugging",
			artifactPatterns: ["docs/journal/*.md", "tasks/reports/*.md"],
			salienceBase: {
				verified_outcome: 2,
				recurrence_or_friction: 1,
				future_reuse_likelihood: 2,
				source_quality: 2,
			},
		},
		["mk:build-fix", "mk:fix", "mk:investigate", "mk:problem-solving"],
	),
];

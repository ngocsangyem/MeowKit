// Security-posture profile family. Findings and remediation roadmaps with high
// blast radius — stronger redaction and a review-after window are warranted.
import { defineGroup } from "../profile-factory.js";
import type { SkillHandoffProfile } from "../domain.js";

export const securityProfiles: SkillHandoffProfile[] = [
	...defineGroup(
		{
			handoffClass: "required",
			profile: "security-posture",
			defaultReuseScope: "security",
			artifactPatterns: ["tasks/reports/*.md", "tasks/reviews/*.md"],
			salienceBase: {
				verified_outcome: 2,
				source_quality: 2,
				future_reuse_likelihood: 2,
				blast_radius: 2,
				security_risk_penalty: -1,
			},
		},
		["mk:cso", "mk:vulnerability-scanner"],
	),
];

// External-spec profile family. Knowledge sourced from outside the repo (specs,
// tickets, fetched docs). Conditional: only worth saving with source provenance
// and a clean scan — never a single-use lookup.
import { defineGroup } from "../profile-factory.js";
import type { SkillHandoffProfile } from "../domain.js";

export const externalProfiles: SkillHandoffProfile[] = [
	...defineGroup(
		{
			handoffClass: "conditional",
			profile: "external-spec",
			defaultReuseScope: "external-spec",
			artifactPatterns: ["tasks/reports/*.md", "tasks/wikis/*/sources.jsonl"],
			salienceBase: {
				source_quality: 2,
				future_reuse_likelihood: 2,
				novelty_vs_existing_wiki: 1,
			},
		},
		[
			"mk:confluence-spec-analyst",
			"mk:docs-finder",
			"mk:jira-analyst",
			"mk:jira-estimator",
			"mk:jira-evaluator",
			"mk:pack",
			"mk:web-to-markdown",
			"mk:wiki-research",
		],
	),
];

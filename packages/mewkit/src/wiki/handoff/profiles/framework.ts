// Framework family: architecture analysis, project conventions, and operational
// workflow recipes. Mostly conditional — generic framework knowledge is NOT worth
// saving; only repo-specific decisions, conventions, and reusable recipes are.
import { defineGroup } from "../profile-factory.js";
import type { SkillHandoffProfile } from "../domain.js";

export const frameworkProfiles: SkillHandoffProfile[] = [
	// Structured architecture candidates / ADR linkage — always advisory.
	...defineGroup(
		{
			handoffClass: "required",
			profile: "architecture-analysis",
			defaultReuseScope: "architecture",
			artifactPatterns: ["docs/architecture/*.md", "docs/architecture/adr/*.md", "tasks/reports/*.md"],
			salienceBase: {
				verified_outcome: 1,
				future_reuse_likelihood: 2,
				source_quality: 2,
				blast_radius: 2,
			},
		},
		["mk:improve-codebase-architecture"],
	),
	// Design / data decisions — saved only when a project standard is chosen.
	...defineGroup(
		{
			handoffClass: "conditional",
			profile: "architecture-analysis",
			defaultReuseScope: "architecture",
			artifactPatterns: ["docs/architecture/*.md", "docs/design-guidelines.md"],
			salienceBase: {
				future_reuse_likelihood: 2,
				source_quality: 1,
				blast_radius: 1,
				novelty_vs_existing_wiki: 1,
			},
		},
		["mk:api-design", "mk:database", "mk:frontend-design", "mk:stitch", "mk:tech-graph", "mk:ui-design-system"],
	),
	// Repo-specific conventions and reusable strategies.
	...defineGroup(
		{
			handoffClass: "conditional",
			profile: "project-convention",
			defaultReuseScope: "convention",
			artifactPatterns: ["docs/code-standards.md", "docs/project-context.md", "tasks/reports/*.md"],
			salienceBase: {
				future_reuse_likelihood: 2,
				source_quality: 1,
				novelty_vs_existing_wiki: 1,
			},
		},
		[
			"mk:angular",
			"mk:ask-me",
			"mk:clean-code",
			"mk:context-audit",
			"mk:decision-framework",
			"mk:docs-init",
			"mk:document-release",
			"mk:grill",
			"mk:intake",
			"mk:nyquist",
			"mk:preview",
			"mk:project-context",
			"mk:prompt-enhancer",
			"mk:qa",
			"mk:qa-manual",
			"mk:react-patterns",
			"mk:resolving-merge-conflicts",
			"mk:scout",
			"mk:ship",
			"mk:skill-creator",
			"mk:typescript",
			"mk:visual-plan",
			"mk:vue",
			"mk:vue-best-practices",
			"mk:vue-testing-best-practices",
		],
	),
	// Operational recipes — saved only when they cut future operational friction.
	...defineGroup(
		{
			handoffClass: "conditional",
			profile: "workflow-recipe",
			defaultReuseScope: "workflow-recipe",
			artifactPatterns: ["tasks/reports/*.md"],
			salienceBase: {
				recurrence_or_friction: 1,
				future_reuse_likelihood: 2,
				source_quality: 1,
			},
		},
		["mk:agent-browser", "mk:ghpm", "mk:jira-agile", "mk:jira-bulk", "mk:jira-lifecycle"],
	),
];

"use strict";
/**
 * node-only-runtime-data.cjs — the two lists the runtime property is asserted against.
 *
 * Kept beside the check rather than inside it so the check reads as one page of
 * reasoning and the data it stands on is reviewable on its own.
 */

/**
 * Kit trees whose every file must be executable by node alone.
 *
 * Two of the three are directories the kit no longer has. They stay named
 * because the property is "nothing interpreter-dependent lives here", and a
 * check that silently stopped looking at a path would pass the moment that path
 * came back — which is how a directory gets quietly re-created.
 */
const NODE_ONLY_TREES = [".claude/scripts", ".claude/hooks"];

/**
 * Skill-owned interpreter scripts that were shipped before the kit's shared
 * script directory was redistributed, each at the path it shipped from.
 *
 * This is a RETENTION list, checked one way only: every path here must still
 * ship from exactly here. A skill adding a script later does not belong in it —
 * the claim is that redistributing the shared directory neither removed nor
 * relocated one of these, not that the set is frozen. Lazy Python is a decision
 * about where an interpreter script lives and who provisions its environment;
 * a redistribution that quietly deleted the scripts that decision exists for
 * would read as a tidy-up in the diff.
 */
const RETAINED_SKILL_SCRIPTS = [
	".claude/skills/agent-browser/templates/authenticated-session.sh",
	".claude/skills/agent-browser/templates/capture-workflow.sh",
	".claude/skills/agent-browser/templates/form-automation.sh",
	".claude/skills/autobuild/scripts/budget-tracker.sh",
	".claude/skills/autobuild/scripts/density-select.sh",
	".claude/skills/bootstrap/scripts/detect-stack.sh",
	".claude/skills/bootstrap/scripts/validate-bootstrap.sh",
	".claude/skills/confluence/scripts/adf-to-md.sh",
	".claude/skills/confluence/scripts/adf_to_md.py",
	".claude/skills/confluence/scripts/confluence-as.sh",
	".claude/skills/confluence/scripts/cql-sanitize.sh",
	".claude/skills/confluence/scripts/smoke-live.sh",
	".claude/skills/context-audit/scripts/estimate-tokens.sh",
	".claude/skills/context-audit/scripts/format-audit-report.sh",
	".claude/skills/context-audit/scripts/inventory-context.sh",
	".claude/skills/cook/scripts/test-scripts.sh",
	".claude/skills/cook/scripts/validate-gate-1.sh",
	".claude/skills/evaluate/scripts/recompute-score.py",
	".claude/skills/evaluate/scripts/run-evaluator.sh",
	".claude/skills/evaluate/scripts/validate-verdict.sh",
	".claude/skills/figma/evals/validate-evidence-packets.py",
	".claude/skills/html-video/scripts/render-html-to-mp4.sh",
	".claude/skills/investigate/scripts/find-polluter.sh",
	".claude/skills/jira/scripts/fetch-workflow.sh",
	".claude/skills/jira/scripts/jira-as.sh",
	".claude/skills/jira/scripts/jql-sanitize.sh",
	".claude/skills/llms/scripts/generate-llms-txt.py",
	".claude/skills/multimodal/scripts/analyze_constants.py",
	".claude/skills/multimodal/scripts/analyze_core.py",
	".claude/skills/multimodal/scripts/api_key_rotator.py",
	".claude/skills/multimodal/scripts/check_setup.py",
	".claude/skills/multimodal/scripts/document_converter.py",
	".claude/skills/multimodal/scripts/env_utils.py",
	".claude/skills/multimodal/scripts/gemini_analyze.py",
	".claude/skills/multimodal/scripts/gemini_generate.py",
	".claude/skills/multimodal/scripts/media_optimizer.py",
	".claude/skills/multimodal/scripts/minimax_api_client.py",
	".claude/skills/multimodal/scripts/minimax_generate.py",
	".claude/skills/multimodal/scripts/openrouter_fallback.py",
	".claude/skills/multimodal/scripts/provider_router.py",
	".claude/skills/multimodal/scripts/video_generator.py",
	".claude/skills/pack/scripts/self-pack-guard.sh",
	".claude/skills/plan-creator/scripts/check-product-spec.sh",
	".claude/skills/planning-engine/scripts/capacity-bin.py",
	".claude/skills/planning-engine/scripts/dep-graph.py",
	".claude/skills/prompt-enhancer/scripts/scout-context.py",
	".claude/skills/qa-manual/scripts/run-playwright.sh",
	".claude/skills/rubric/scripts/load-rubric.sh",
	".claude/skills/rubric/scripts/validate-rubric.sh",
	".claude/skills/sequential-thinking/scripts/test-scripts.sh",
	".claude/skills/skill-creator/scripts/init-skill.py",
	".claude/skills/skill-creator/scripts/validate-skill.py",
	".claude/skills/story-sizer/scripts/check-auto-create-gating.py",
	".claude/skills/story-sizer/scripts/execute-auto-create.py",
	".claude/skills/story-sizer/scripts/parse-paste-stories.py",
	".claude/skills/story-sizer/scripts/score-story.py",
	".claude/skills/story-sizer/scripts/write-sizing-report.py",
	".claude/skills/tech-graph/scripts/generate-diagram.sh",
	".claude/skills/tech-graph/scripts/generate-from-template.py",
	".claude/skills/tech-graph/scripts/generate-svg-from-lines.py",
	".claude/skills/tech-graph/scripts/test-all-styles.sh",
	".claude/skills/tech-graph/scripts/validate-svg.sh",
	".claude/skills/web-to-markdown/scripts/fetch_as_markdown.py",
	".claude/skills/web-to-markdown/scripts/html_to_markdown.py",
	".claude/skills/web-to-markdown/scripts/http_fetch.py",
	".claude/skills/web-to-markdown/scripts/injection_detect.py",
	".claude/skills/web-to-markdown/scripts/injection_patterns.py",
	".claude/skills/web-to-markdown/scripts/persist_fetch.py",
	".claude/skills/web-to-markdown/scripts/rate_limit.py",
	".claude/skills/web-to-markdown/scripts/robots_cache.py",
	".claude/skills/web-to-markdown/scripts/secret_scrub.py",
];

/**
 * Interpreter scripts owned by a skill the published kit withholds.
 *
 * They are held to the same one-way claim as the shipped ones, against the
 * REPOSITORY instead of the ship set: each must still exist at exactly this
 * path. Splitting them out keeps both halves honest. Dropping them from the
 * retention list entirely would let a later change delete a benchmark script
 * with nothing noticing, and leaving them in it would make the check demand
 * that a withheld skill ship — one of the two lists has to say which claim
 * applies, and silence in either direction reads as a tidy-up in the diff.
 */
const RETAINED_UNSHIPPED_SKILL_SCRIPTS = [
	".claude/skills/benchmark/scripts/compare-runs.sh",
	".claude/skills/benchmark/scripts/git-index-audit.sh",
	".claude/skills/benchmark/scripts/run-canary.sh",
];

module.exports = { NODE_ONLY_TREES, RETAINED_SKILL_SCRIPTS, RETAINED_UNSHIPPED_SKILL_SCRIPTS };

# Skill Domain Routing

> Loaded once per session by `mk:agent-detector` at Step 0b (sentinel-cached — read
> on turn 1, suppressed on turns 2..N of the same session). This table is skill
> dispatch only; it is NOT needed for agent/model-tier assignment, so it lives here
> rather than in always-loaded `.claude/rules/agent-routing.md`.

The orchestrator routes by skill names:

| Intent | Use |
| --- | --- |
| Quick codebase search or architecture fingerprint | `mk:scout` |
| Implementation pipeline | `mk:plan-creator` → `mk:cook` |
| Bug investigation / root cause | `mk:investigate` → `mk:fix` |
| Current library/API documentation | `mk:docs-finder` |
| Project documentation updates | `mk:document-release` or `mk:docs-init` |
| Verification build/lint/test/typecheck | `mk:verify` or `mk:lint-and-validate` |
| Code review / pre-landing audit | `mk:review` |
| Review a GitHub PR (shallow verdict) / respond to received PR comments | `mk:review-pr` / `mk:respond-pr` |
| Browser or UI QA | `mk:qa`, `mk:qa-manual`, `mk:playwright-cli`, or `mk:agent-browser` |
| Visual explanation / diagrams / slides | `mk:preview` |
| Media or document analysis/generation | `mk:multimodal` |
| Security audit | `mk:cso` or `mk:vulnerability-scanner` |
| Skill creation | `mk:skill-creator` |
| AI-friendly docs index | `mk:llms` |

Pick one primary skill per distinct intent.

If a task spans domains, run the workflow skill first (`mk:plan-creator`, `mk:cook`, `mk:fix`, or `mk:autobuild`) and load the domain skill at the phase where it is needed.

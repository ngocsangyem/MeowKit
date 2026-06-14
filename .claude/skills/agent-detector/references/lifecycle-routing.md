# Lifecycle Routing Table

Maps task signals to workflow phases and recommended skills.
Advisory only — does not change agent-detector scoring or output format.

## Discovery Tree

| Signal | Phase | Recommended Skill(s) |
|--------|-------|---------------------|
| Vague idea, needs refinement | Define | mk:plan-creator |
| New feature, need spec/plan | Plan | mk:plan-creator |
| Green-field product build ("build me a kanban app", "make a SaaS dashboard", autonomous multi-hour build) | Plan + Build | mk:autobuild (preferred over mk:cook for autonomous green-field work; runs planner → contract → generator ⇄ evaluator loop) |
| Have plan, ready to implement | Build | mk:cook, mk:development |
| Rough-size from spec / pre-ticket sizing / estimate stories before tickets exist | Plan | mk:story-sizer |
| Stress-test / interrogate my OWN plan or design ("grill me", "get grilled on my design") until every branch is resolved | Plan | mk:grill (one question at a time; checkpoints to `docs/knowledge/<slug>.md`; NOT proposing options — see mk:brainstorming; NOT "should we build this" — see mk:office-hours; NOT Claude answering repo questions — see mk:ask-me) |
| UI/frontend work | Build | mk:frontend-design, mk:cook |
| Review my Vue feature code / "Vue best practices" / ordered Vue authoring workflow | Build | mk:vue-best-practices (deep review + workflow; NOT everyday authoring — see mk:vue; NOT test code — see mk:vue-testing-best-practices) |
| API/backend work | Build | mk:api-design, mk:cook |
| Need library/API docs | Build | mk:docs-finder |
| Database work | Build | mk:database, mk:cook |
| Writing or running tests | Verify | mk:testing, mk:qa |
| Design or review Vue test code; choose Vue test tooling ("review my Vue tests", "how should I test this component/composable/store") | Verify | mk:vue-testing-best-practices (advisory test-design + review; NOT running tests — see mk:testing; NOT feature code — see mk:vue-best-practices) |
| Something broke, debugging | Verify | mk:investigate, mk:fix |
| Browser testing needed | Verify | mk:agent-browser, mk:qa |
| Reviewing code quality | Review | mk:review |
| Review a GitHub PR, give a verdict on someone's pull request | Review | mk:review-pr (shallow single-pass; NOT a deep audit of your own diff — see mk:review) |
| Respond to / triage reviewer comments received on a PR | Review | mk:respond-pr (verify-before-agree; hands accepted fixes to mk:fix) |
| Security audit | Review | mk:cso |
| Simplify/refactor code | Review | mk:simplify |
| Optimize a measurable metric (coverage %, bundle size, lint count, latency) through bounded git-tracked iterations | Build | mk:loop (keep/revert per scalar metric; NOT for subjective cleanup — see mk:cook) |
| Factual project question with sources ("how does X work *here*", "explain X in this repo", "is it true that ... in the repo", "why is X structured this way") | any | mk:ask-me (cited inline answer; NOT library docs — see mk:docs-finder; NOT "why is X broken" — see mk:investigate) |
| Visualize code, draw diagram, build slide deck, render plan as HTML | any | mk:preview |
| Visualize a git diff or PR before review | Review | mk:preview (`--html --diff`) |
| Ready to ship/deploy | Ship | mk:ship |
| Need docs updated | Ship | mk:document-release |
| Session retrospective | Reflect | mk:retro, mk:memory |

## Multi-Signal Resolution

When multiple signals match:
- Prefer the EARLIEST unresolved phase (Plan before Build, Build before Review)
- If signal is ambiguous, suggest mk:help for guided navigation
- mk:agent-detector handles agent+tier assignment; this table handles skill suggestion

## Usage

Referenced by mk:help for "what should I do next?" recommendations.
NOT consumed by agent-detector scoring — output format is unchanged.

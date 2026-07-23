# Lifecycle Routing Table

Maps task signals to workflow phases and recommended skills.
Advisory only — does not change agent-detector scoring or output format.

## Discovery Tree

| Signal | Phase | Recommended Skill(s) |
|--------|-------|---------------------|
| Vague idea, needs refinement | Define | mk:plan-creator |
| New feature, need spec/plan | Plan | mk:plan-creator |
| Runtime context decision — context near budget, long session degrading, choosing a minimal read-set, or compact vs clear vs sub-agent | Any | mk:context-engineering (routes to one of 25 context patterns per decision; NOT structural .codex/ overhead audit — see mk:context-audit) |
| Green-field product build ("build me a kanban app", "make a SaaS dashboard", autonomous multi-hour build) | Plan + Build | mk:autobuild (preferred over mk:cook for autonomous green-field work; runs planner → contract → generator ⇄ evaluator loop) |
| Have plan, ready to implement | Build | mk:cook, mk:development |
| Rough-size from spec / pre-ticket sizing / estimate stories before tickets exist | Plan | mk:story-sizer |
| Stress-test / interrogate my OWN plan or design ("grill me", "get grilled on my design") until every branch is resolved | Plan | mk:grill (one question at a time; checkpoints to `docs/knowledge/<slug>.md`; NOT proposing options — see mk:brainstorming; NOT "should we build this" — see mk:office-hours; NOT Codex answering repo questions — see mk:ask-me) |
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
| Review codebase architecture for deepening opportunities ("find shallow modules", "where to deepen", "improve architecture") | Review | mk:improve-codebase-architecture (structured candidates → mk:preview renders → mk:grill a pick into a type-safe patch; NOT behavior-preserving cleanup of a known target — see mk:simplify; NOT rendering — see mk:preview) |
| Optimize a measurable metric (coverage %, bundle size, lint count, latency) through bounded git-tracked iterations | Build | mk:loop (keep/revert per scalar metric; NOT for subjective cleanup — see mk:cook) |
| Factual project question with sources ("how does X work *here*", "explain X in this repo", "is it true that ... in the repo", "why is X structured this way") | any | mk:ask-me (cited inline answer; NOT library docs — see mk:docs-finder; NOT "why is X broken" — see mk:investigate) |
| Deep multi-source technical research with a cited report ("research X", "evaluate X vs Y", "how do others solve Z", "find best practices for X") | any | mk:research (delegates to researcher sub-task(s), primary-source discipline + retrieval-call cap, one cited report, optional `--html`; NOT single-library docs — see mk:docs-finder; NOT project-only Q&A — see mk:ask-me) |
| Visualize code, draw diagram, build slide deck, visualize a git diff | any | mk:preview |
| Publish-grade diagram for blog, doc, slide, or editorial image (SVG/PNG export) | any | mk:tech-graph (NOT for in-HTML diagrams — use mk:preview --html --diagram; NOT for plan rendering — use mk:visual-plan) |
| Mermaid v11 diagram block embedded in markdown, README, or code comments | any | mk:mermaidjs-v11 (NOT for in-HTML — use mk:preview --html --diagram; NOT for standalone SVG/PNG — use mk:tech-graph) |
| Render a plan as a shareable, block-disciplined plan.html artifact at the plan-dir root | any | mk:visual-plan (canonical plan-as-HTML owner, scannable in <30s; NOT generic code/diagram/diff visuals — see mk:preview; NOT plan critique — see mk:plan-ceo-review) |
| Visualize a git diff or PR before review | Review | mk:preview (`--html --diff`) |
| Ready to ship/deploy | Ship | mk:ship |
| Resolve an in-progress git merge or rebase conflict ("finish the merge", "fix this rebase", unmerged paths) | any | mk:resolving-merge-conflicts (read state → recover intent → resolve hunks → run checks → finish; always resolves, never --abort; NOT the base-branch merge of shipping — see mk:ship) |
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

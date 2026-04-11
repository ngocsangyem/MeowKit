# Lifecycle Routing Table

Maps task signals to MeowKit workflow phases and recommended skills.
Advisory only — does not change agent-detector scoring or output format.

## Discovery Tree

| Signal | Phase | Recommended Skill(s) |
|--------|-------|---------------------|
| Vague idea, needs refinement | Define | meow:plan-creator |
| New feature, need spec/plan | Plan | meow:plan-creator |
| Have plan, ready to implement | Build | meow:cook, meow:development |
| UI/frontend work | Build | meow:frontend-design, meow:cook |
| API/backend work | Build | meow:api-design, meow:cook |
| Need library/API docs | Build | meow:docs-finder |
| Database work | Build | meow:database, meow:cook |
| Writing or running tests | Verify | meow:testing, meow:qa |
| Something broke, debugging | Verify | meow:investigate, meow:fix |
| Browser testing needed | Verify | meow:browse, meow:qa |
| Reviewing code quality | Review | meow:review |
| Security audit | Review | meow:cso |
| Simplify/refactor code | Review | meow:simplify |
| Ready to ship/deploy | Ship | meow:ship |
| Need docs updated | Ship | meow:document-release |
| Session retrospective | Reflect | meow:retro, meow:memory |

## Multi-Signal Resolution

When multiple signals match:
- Prefer the EARLIEST unresolved phase (Plan before Build, Build before Review)
- If signal is ambiguous, suggest meow:help for guided navigation
- meow:agent-detector handles agent+tier assignment; this table handles skill suggestion

## Usage

Referenced by meow:help for "what should I do next?" recommendations.
NOT consumed by agent-detector scoring — output format is unchanged.

# Lifecycle Routing Table

Maps task signals to workflow phases and recommended skills.
Advisory only — does not change agent-detector scoring or output format.

## Discovery Tree

| Signal | Phase | Recommended Skill(s) |
|--------|-------|---------------------|
| Vague idea, needs refinement | Define | mk:plan-creator |
| New feature, need spec/plan | Plan | mk:plan-creator |
| Have plan, ready to implement | Build | mk:cook, mk:development |
| UI/frontend work | Build | mk:frontend-design, mk:cook |
| API/backend work | Build | mk:api-design, mk:cook |
| Need library/API docs | Build | mk:docs-finder |
| Database work | Build | mk:database, mk:cook |
| Writing or running tests | Verify | mk:testing, mk:qa |
| Something broke, debugging | Verify | mk:investigate, mk:fix |
| Browser testing needed | Verify | mk:agent-browser, mk:qa |
| Reviewing code quality | Review | mk:review |
| Security audit | Review | mk:cso |
| Simplify/refactor code | Review | mk:simplify |
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

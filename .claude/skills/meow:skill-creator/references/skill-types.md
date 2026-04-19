# Skill Type Taxonomy

Classify your skill before writing it. Each type has different requirements.

| Type | Description | Example | Key Pattern |
|------|-------------|-----------------|-------------|
| Library/API | Wrap external APIs, handle auth, manage versions | meow:docs-finder, meow:multimodal | Scripts for API calls, config for auth |
| Verification | Check quality, validate, audit | meow:review, meow:cso, meow:lint-and-validate | Deterministic scripts, pass/fail output |
| Data | Database, migrations, ETL | (none yet) | Schema refs, migration scripts |
| Business Process | Multi-step workflows, approval chains | meow:cook, meow:ship, meow:workflow-orchestrator | Phase refs, state tracking |
| Scaffolding | Generate templates, boilerplate | meow:skill-creator, meow:plan-creator | assets/ with templates |
| Code Quality | Linting, formatting, style | meow:clean-code, meow:typescript | Rules refs, auto-fix scripts |
| CI/CD | Build, deploy, release | meow:ship | Pipeline refs, env config |
| Runbooks | Operational procedures, incident response | meow:investigate, meow:careful | Step-by-step with escape hatches |
| Infrastructure | Cloud, containers, networking | (none yet) | Provider-specific refs, IaC patterns |

## Decision: "What type is my skill?"

1. Does it call an external API? → **Library/API**
2. Does it check/validate/audit something? → **Verification**
3. Does it touch databases or data pipelines? → **Data**
4. Does it orchestrate multiple phases with approvals? → **Business Process**
5. Does it generate files from templates? → **Scaffolding**
6. Does it enforce code style or patterns? → **Code Quality**
7. Does it build, test, or deploy? → **CI/CD**
8. Does it guide through an operational procedure? → **Runbooks**
9. Does it manage infrastructure or cloud resources? → **Infrastructure**

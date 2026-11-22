# Model Selection

**Auto-select model based on task complexity and agent type.**

## Model Mapping

```toon
tier_selection[3]{tier,pin,when_to_use,agents}:
  TRIVIAL,haiku,Quick tasks/Mechanical or report-only work,documenter/shipper/project-manager/explore/git-manager
  STANDARD,sonnet,Implementation support/Research/Testing,analyst/tester/researcher/journal-writer/orchestrator
  COMPLEX,opus,Design/Implementation/Review/Security/Complex planning,planner/architect/developer/reviewer/security/brainstormer
```

## Complexity to Model

The task-complexity tiers and their routing CSV levels are defined in `references/model-selection-rules.md` (Task Complexity Tiers). A task takes the tier its complexity names.

## Task Type to Model

The task-type to tier table (including code review at COMPLEX) is the Routing Table in `references/model-selection-rules.md`. It is not restated here.

## Agent Default Models

Each agent runs on its `model:` pin, which follows the agent's tier in `references/model-selection-rules.md` (Agent `model:` Pins). The pin does not change per task: the tier declared for a task picks which agent runs, not which model it uses.

```toon
agent_models[14]{agent,pin,tier}:
  orchestrator,sonnet,STANDARD
  analyst,sonnet,STANDARD
  planner,opus,COMPLEX
  architect,opus,COMPLEX
  developer,opus,COMPLEX
  tester,sonnet,STANDARD
  reviewer,opus,COMPLEX
  security,opus,COMPLEX
  shipper,haiku,TRIVIAL
  documenter,haiku,TRIVIAL
  researcher,sonnet,STANDARD
  brainstormer,opus,COMPLEX
  journal-writer,sonnet,STANDARD
  project-manager,haiku,TRIVIAL
```

## Model Selection Output

Include in detection result:

```markdown
## Detection Result

- **Agent:** architect
- **Tier:** COMPLEX (pin: `opus`)
- **Reason:** API endpoint implementation
```

When delegating to the agent, leave the model unset so the agent's pin applies.

# Model Selection

**Auto-select model based on task complexity and agent type.**

## Model Mapping

```toon
model_selection[3]{model,when_to_use,agents}:
  haiku,Quick tasks/Mechanical or report-only work,documenter/shipper/project-manager/explore/git-manager
  sonnet,Implementation support/Research/Testing,analyst/tester/researcher/journal-writer/orchestrator
  opus,Design/Implementation/Review/Security/Complex planning,planner/architect/developer/reviewer/security/brainstormer
```

## Complexity to Model

```toon
complexity_model[3]{complexity,default_model,override_to_opus}:
  Quick,haiku,Never
  Standard,sonnet,User asks for architecture/design
  Deep,sonnet,Always consider opus for planning phase
```

## Task Type to Model

```toon
task_model[8]{task_type,model,reason}:
  Typo fix / config change,haiku,Minimal reasoning needed
  Bug fix / feature add,sonnet,Standard implementation
  API endpoint / component,sonnet,Standard implementation
  Test writing,sonnet,Requires code understanding
  Code review,sonnet,Pattern matching + analysis
  Architecture design,opus,Complex trade-off analysis
  Security audit,opus,Deep vulnerability analysis
  Refactoring / migration,opus,Cross-cutting impact analysis
```

## Agent Default Models

Each agent runs on its `model:` pin, which follows the agent's tier in `model-selection-rules.md` (Agent `model:` Pins). The pin does not change per task: the tier declared for a task picks which agent runs, not which model it uses.

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
- **Model:** opus (the agent's pin)
- **Complexity:** Standard
- **Reason:** API endpoint implementation
```

When spawning the agent, leave `model` unset so the agent's pin applies:

```
Agent(subagent_type="architect", ...)
```

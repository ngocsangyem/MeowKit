# Model Selection

<!-- Fixed: replaced phantom aura-frog agent names with actual MeowKit agents.
     lead/scanner/router/frontend/mobile/gamedev/strategist/devops → orchestrator/developer/planner/etc. -->

**Auto-select model based on task complexity and agent type.**

## Model Mapping

```toon
model_selection[3]{model,when_to_use,agents}:
  haiku,Quick tasks/Simple queries/Orchestration,orchestrator/analyst
  sonnet,Standard implementation/Coding/Testing/Bug fixes,developer/tester/reviewer/planner/researcher
  opus,Architecture/Deep analysis/Security audits/Complex planning,architect/security (audits)/Any agent (architecture mode)
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

```toon
agent_models[13]{agent,default_model,opus_when}:
  orchestrator,haiku,Never (routing only)
  analyst,haiku,Never (cost tracking/pattern extraction)
  planner,sonnet,Complex multi-phase planning
  architect,sonnet,Schema design / migration planning / system architecture
  developer,sonnet,Never (implementation focus)
  tester,sonnet,Never
  reviewer,sonnet,opus for security-critical reviews
  security,sonnet,opus for full audits
  shipper,sonnet,Never
  documenter,sonnet,Never
  researcher,sonnet,opus for deep technical research
  brainstormer,sonnet,opus for architecture evaluation
  journal-writer,haiku,Never (documentation only)
```

## Model Selection Output

Include in detection result:

```markdown
## Detection Result
- **Agent:** architect
- **Model:** sonnet
- **Complexity:** Standard
- **Reason:** API endpoint implementation
```

When spawning Agent tool, use the detected model:
```
Agent(subagent_type="architect", model="sonnet", ...)
```

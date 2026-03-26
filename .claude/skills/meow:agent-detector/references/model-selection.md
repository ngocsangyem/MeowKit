# Model Selection

**Auto-select model based on task complexity and agent type.**

## Model Mapping

```toon
model_selection[3]{model,when_to_use,agents}:
  haiku,Quick tasks/Simple queries/Orchestration,lead/scanner
  sonnet,Standard implementation/Coding/Testing/Bug fixes,All dev agents/tester/frontend
  opus,Architecture/Deep analysis/Security audits/Complex planning,security (audits)/Any agent (architecture mode)
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
agent_models[10]{agent,default_model,opus_when}:
  lead,haiku,Never (orchestration only)
  scanner,haiku,Never (detection/context loading)
  router,haiku,Never (routing only)
  architect,sonnet,Schema design / migration planning / system architecture
  frontend,sonnet,Design system architecture
  mobile,sonnet,Architecture decisions
  strategist,sonnet,Business strategy / ROI evaluation
  security,sonnet,opus for full audits
  tester,sonnet,Never
  devops,sonnet,Infrastructure architecture
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

When spawning Task tool, use the detected model:
```
Task(subagent_type="architect", model="sonnet", ...)
```

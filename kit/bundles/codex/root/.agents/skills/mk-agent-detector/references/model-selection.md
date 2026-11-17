# Model Selection

**Auto-select a tier based on task complexity and agent type.** Each tier maps to one model pin on this host; the pins live in the `model` key of each agent in `.codex/agents/*.toml`.

## Tier Mapping

```toon
tier_selection[3]{tier,pin,when_to_use,agents}:
  TRIVIAL,gpt-6-luna,Quick tasks/Mechanical or report-only work,documenter/shipper/project-manager/explore/git-manager
  STANDARD,gpt-6.1-sol,Implementation support/Research/Testing,analyst/tester/researcher/journal-writer
  COMPLEX,gpt-6-astra,Design/Implementation/Review/Security/Complex planning,planner/architect/developer/reviewer/security/brainstormer
```

## Complexity to Tier

```toon
complexity_tier[3]{complexity,default_tier,override_to_complex}:
  Quick,TRIVIAL,Never
  Standard,STANDARD,User asks for architecture/design
  Deep,STANDARD,Always consider COMPLEX for the planning phase
```

## Task Type to Tier

```toon
task_tier[8]{task_type,tier,reason}:
  Typo fix / config change,TRIVIAL,Minimal reasoning needed
  Bug fix / feature add,STANDARD,Standard implementation
  API endpoint / component,STANDARD,Standard implementation
  Test writing,STANDARD,Requires code understanding
  Code review,STANDARD,Pattern matching + analysis
  Architecture design,COMPLEX,Complex trade-off analysis
  Security audit,COMPLEX,Deep vulnerability analysis
  Refactoring / migration,COMPLEX,Cross-cutting impact analysis
```

## Agent Default Tiers

Each agent runs on its tier's pin (the `model` key of each agent in `.codex/agents/*.toml`). The pin does not change per task: the tier declared for a task picks which agent runs, not which model it uses.

```toon
agent_tiers[13]{agent,tier}:
  analyst,STANDARD
  planner,COMPLEX
  architect,COMPLEX
  developer,COMPLEX
  tester,STANDARD
  reviewer,COMPLEX
  security,COMPLEX
  shipper,TRIVIAL
  documenter,TRIVIAL
  researcher,STANDARD
  brainstormer,COMPLEX
  journal-writer,STANDARD
  project-manager,TRIVIAL
```

## Model Selection Output

Include in detection result:

```markdown
## Detection Result

- **Agent:** architect
- **Tier:** COMPLEX (pin: `gpt-6-astra`)
- **Complexity:** Standard
- **Reason:** API endpoint implementation
```

When delegating to the agent, leave the model unset so the agent's pin applies.

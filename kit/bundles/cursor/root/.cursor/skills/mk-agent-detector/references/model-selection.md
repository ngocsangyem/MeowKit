# Model Selection

**Auto-select a complexity tier based on task type and agent role.** Cursor's own
`model` field on an agent is `inherit` — this bundle does not pin agents to a
concrete model ID, so tiering here selects a REASONING BUDGET (how much scoping,
research, and review depth to apply), not a model swap.

## Tier Mapping

```toon
tier_selection[3]{tier,when_to_use,agents}:
  TRIVIAL,Quick tasks/Simple queries/Orchestration,orchestrator/analyst
  STANDARD,Standard implementation/Coding/Testing/Bug fixes,developer/tester/reviewer/planner/researcher
  COMPLEX,Architecture/Deep analysis/Security audits/Complex planning,architect/security (audits)/Any agent (architecture mode)
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

```toon
agent_tiers[14]{agent,default_tier,complex_when}:
  orchestrator,TRIVIAL,Never (routing only)
  analyst,TRIVIAL,Never (cost tracking/pattern extraction)
  planner,STANDARD,Complex multi-phase planning
  architect,STANDARD,Schema design / migration planning / system architecture
  developer,STANDARD,Never (implementation focus)
  tester,STANDARD,Never
  reviewer,STANDARD,COMPLEX for security-critical reviews
  security,STANDARD,COMPLEX for full audits
  shipper,STANDARD,Never
  documenter,STANDARD,Never
  researcher,STANDARD,COMPLEX for deep technical research
  brainstormer,STANDARD,COMPLEX for architecture evaluation
  journal-writer,TRIVIAL,Never (documentation only)
  project-manager,TRIVIAL,Never (delivery status reporting only)
```

## Tier Selection Output

Include in detection result:

```markdown
## Detection Result

- **Agent:** architect
- **Tier:** STANDARD
- **Complexity:** Standard
- **Reason:** API endpoint implementation
```

When delegating to a custom agent (Task-tool delegation to a `.cursor/agents/*.md`
agent), carry the detected tier in the delegation prompt so the agent scopes its own
depth accordingly — Cursor has no per-call model override; the agent's frontmatter
`model: inherit` is fixed.

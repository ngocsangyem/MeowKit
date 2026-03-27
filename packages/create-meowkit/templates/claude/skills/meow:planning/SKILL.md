---
name: meow:planning
description: "Use when creating plans, challenging premises, or generating ADRs. Activates during Phase 1 (Plan) for structured planning and architecture decisions."
---

# Planning Toolkit

Reference guides for planning: plan templates, premise challenging, and Architecture Decision Records.

## When to Use

- During Phase 1 (Plan) for creating implementation plans
- When the `planner` agent needs plan templates
- When the `architect` agent generates ADRs
- For premise challenging before committing to an approach

## Workflow Integration

Operates in **Phase 1 (Plan)**. Output supports the `planner` and `architect` agents.

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[plan-template.md](./references/plan-template.md)** | Creating a new plan | Plan structure, required sections, acceptance criteria format |
| **[premise-challenge.md](./references/premise-challenge.md)** | Before committing to approach | Questioning assumptions, evaluating alternatives |
| **[adr-generation.md](./references/adr-generation.md)** | Architecture decisions | ADR template, decision criteria, trade-off documentation |

## Gotchas

- **Over-planning trivial tasks**: Creating full ADR + multi-phase plan for a config change → Use plan-quick.md for < 5 files; skip planning entirely for < 2 files
- **Premise challenge becoming scope creep**: Questioning assumptions leads to expanding scope → Time-box premise challenge to 5 minutes; document but don't act on expansion ideas

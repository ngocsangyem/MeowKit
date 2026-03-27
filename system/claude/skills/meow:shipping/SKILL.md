---
name: meow:shipping
description: "Use when you need a quick reference for ship pipeline mechanics, canary deployment, or rollback procedures. For the full automated ship workflow, use meow:ship instead."
---

<!-- Restructured for context engineering compliance:
     3 loose .md files → SKILL.md (decision router) + references/
     This is MeowKit's simplified fallback for shipping.
     For the comprehensive automated workflow, use meow:ship (gstack). -->

# Shipping Toolkit

Simplified shipping reference covering the core mechanics: ship pipeline, canary deployment, and rollback protocol.

**For the full automated ship workflow** (13-step, with tests, reviews, version bump, PR creation): use `/meow:ship` instead.

## When to Use

- Quick reference for shipping steps when not using the full `/meow:ship` automation
- Canary deployment planning for high-risk changes (auth, payments, schema, infra)
- Creating rollback documentation for any shipped change
- Understanding the ship pipeline when debugging CI/CD issues

## Workflow Integration

Operates in **Phase 5 (Ship)** of MeowKit's workflow. Output feeds into the `shipper` agent.

## Process

1. **Determine deployment type** — standard ship or canary?
   - Standard: load `references/ship-pipeline.md`
   - High-risk (auth/payments/schema/infra): load `references/canary-deploy.md`
2. **Run pre-ship validation** — tests, lint, typecheck, security scan
3. **Generate conventional commit** — `feat:`, `fix:`, `refactor:`, etc.
4. **Create PR** — via `gh pr create` with rollback plan
5. **Document rollback** — load `references/rollback-protocol.md`

## References

Load **only when needed** — not all upfront.

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[ship-pipeline.md](./references/ship-pipeline.md)** | Standard shipping | Pre-ship validation, commit, branch, push, PR, CI verification |
| **[canary-deploy.md](./references/canary-deploy.md)** | High-risk changes | Staged rollout, 30-min monitoring, promote/rollback decision matrix |
| **[rollback-protocol.md](./references/rollback-protocol.md)** | Every ship | Rollback template, verification checklist, data safety evaluation |

## Handoff

On completion → `shipper` agent handles the actual git operations and PR creation.

## Gotchas

- **Canary deploy without monitoring**: Deploying canary but not watching metrics → Always set up health checks BEFORE canary rollout; define rollback trigger
- **Rollback plan referencing deleted infrastructure**: Rollback docs point to old deployment scripts → Validate rollback plan against current infra before every ship

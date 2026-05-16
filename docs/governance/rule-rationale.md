# Rule Rationale Reference

Human-only reference for background trimmed from `.claude/rules/` during token optimization. This file is documentation, not loaded policy; the rule files remain the operational source of truth.

## Optimization Policy

- Keep rule files concise and directive.
- Keep each `WHY:` to one sentence where possible.
- Prefer positive directives over `INSTEAD/USE` pairs.
- Preserve all mandatory language (`MUST`, `NEVER`, `ALWAYS`, `HARD`, `GATE`) in the operational rule files.
- Do not summarize or rewrite `injection-rules.md` numbered rules or the `agent-conduct.md` A1 Subagent Status Protocol.

## Preserved Background

### Agent Conduct

`agent-conduct.md` consolidates prior file naming, response formatting, context ordering, search-before-building, and Claude Code context-hygiene guidance. The source-provenance table was removed from the loaded rule because it documented history rather than operational behavior; the behavior remains in A1–A3 and B1–B6.

### Harness

Harness rationale comes from the dead-weight thesis and harness/evaluator research:

- Product-level planning leaves capable models room to discover better implementation paths.
- Generator/evaluator separation mitigates self-evaluation leniency drift.
- Sprint contracts are load-bearing for intermediate tiers but can be overhead for trivial or highly capable tiers.
- Active verification is required because static checks can miss runtime failures.
- Density overrides change scaffolding amount, never the quality bar or gates.

### Skill Authoring

Skill authoring rationale comes from progressive disclosure: keep `SKILL.md` as a concise entrypoint, route details into references or step files, and preserve learned edge cases in `## Gotchas`. Persistent skill-owned state belongs in `${CLAUDE_PLUGIN_DATA}` because skill directories can be replaced during plugin upgrades.

### Routing, Risk, and Model Tier

Domain CSV routing captures vertical risk; `risk-checklist.md` captures horizontal risks such as auth, data loss, and external providers. Both feed the existing TRIVIAL / STANDARD / COMPLEX system; they do not create new lanes.

### Rubrics

Rubric rationale focuses on evaluator calibration: balanced PASS/FAIL anchors reduce bias, hard-fail propagation prevents averages from hiding broken critical paths, and model-upgrade drift checks protect against silent grading changes.

### Step Files and Parallel Execution

Step files implement just-in-time loading to reduce context pressure. Parallel execution is limited to complex, independent tasks with worktree isolation because coordination and token cost can exceed throughput gains.

## Optimization Log

- 2026-05-11: Compressed verbose WHY blocks, removed non-operational provenance tables, replaced most `INSTEAD/USE` pairs with positive directives, and preserved all numbered prompt-injection rules unchanged.

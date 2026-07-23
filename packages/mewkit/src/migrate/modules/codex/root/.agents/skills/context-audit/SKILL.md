---
name: "context-audit"
description: "Read-only audit of `.codex/` structural overhead. Reports prioritized \"remove X save Y tokens\" recommendations against the model context window. NOT for monetary cost tracking — that's the budget skill. NOT for transcript size monitoring — long-session continuity defers to Codex native compaction. NOT for runtime context decisions (what to read, when to compact) — see mk:context-engineering. Use when planning to add context capacity, diagnosing perceived slowdowns, or auditing health."
---

# the context-audit skill — Context Window Structural Audit

Read-only audit of `.codex/` structural overhead. Surfaces what is loaded into
every host-runtime session and how much of the context window it consumes,
then recommends the highest-leverage trims.

Complementary lens: `mewkit inventory --substrate` shows the same artifact set
grouped by the responsibility each serves (covered / partial / missing), so a trim
can be checked against responsibility coverage before removing an artifact. The
per-phase read budget that bounds what an audit-driven session should load lives in
`rules/context-budget-rules.md`.

## When to Use

Three concrete triggers:

1. **Pre-add capacity check** — before adding a new agent, skill, or rule file,
   confirm the project is below the 25% structural-overhead threshold.
2. **Post-degradation diagnostic** — when sessions feel slow, off-topic, or
   over-compacted, audit to see if structural overhead has grown past 10%.
3. **Periodic health audit** — quarterly or on model upgrades, confirm
   the always-on bundle still pays its keep (paired with the dead-weight audit
   in `harness-rules.md` Rule 7).

## Context vs Cost (Boundary)

| Concern                         | Mechanism                                                | Unit          |
| ------------------------------- | -------------------------------------------------------- | ------------- |
| Monetary cost                   | `the budget skill` + `../autobuild/scripts/budget-tracker.sh`  | USD           |
| Window utilization (this skill) | `the context-audit skill` + `scripts/inventory-context.sh`      | tokens / %    |

The three concerns are deliberately separate. This skill measures only what
is **statically loaded** into every session — the always-on bundle. Conversation
history, tool output, and active edits live elsewhere.

## Workflow

The slash command runs the pipeline:

```bash
SCAN_ROOT="${1:-$PWD}"
bash .agents/skills/context-audit/scripts/inventory-context.sh "$SCAN_ROOT" \
  | bash .agents/skills/context-audit/scripts/estimate-tokens.sh \
  | bash .agents/skills/context-audit/scripts/format-audit-report.sh
```

Output is markdown, printed to terminal. The skill does NOT write any files.

Steps:

1. **Inventory** — `inventory-context.sh` walks `.codex/` and emits raw
   byte/line counts per category (AGENTS.md chain, agents, skills, rules,
   commands, MCP) as JSON.
2. **Estimate** — `estimate-tokens.sh` enriches the inventory with
   `estimated_tokens` (chars/4 heuristic, mirrors `budget-tracker.cjs`) and
   computes `totals` including `structural_overhead_pct` against a 200K window.
3. **Format** — `format-audit-report.sh` emits a 5-section markdown report:
   header, summary table, top consumers, recommendations, footer.
4. **Banner** — the formatter selects a banner based on
   `structural_overhead_pct`:
   - `< 10%`  → Healthy
   - `10–25%` → Watch
   - `≥ 25%`  → Action recommended

## Output Format

```
# Context Audit — <scan_root>
*Scanned at <timestamp> · model window 200K tokens · banner: <Healthy|Watch|Action>*

## Summary
| Category | Components | Bytes | Tokens | % of Window |
| ...      | ...        | ...   | ...    | ...          |

## Top Consumers
1. <component> ~<tokens> (<path>)
... (top 10)

## Recommendations
1. <priority finding> — saves ~<tokens>
... (sorted by token impact, descending)

## How to Act
- Cost: see `the budget skill`
- Runtime trim: see `mk:lazy-agent-loader`
```

The 10% / 25% thresholds are the canonical source of truth for token-overhead
banners — see `references/token-cost-model.md`. They are NOT linked to
`MEOWKIT_BUDGET_*` env vars (those are USD amounts, not token percentages).

## Integration Points

- **Reuses, does not duplicate:** `packages/mewkit/src/token-estimator/index.ts`
  is the canonical chars/4 source. Shell scripts inline the same heuristic with
  a citation comment, avoiding a Node bridge that would require `dist/`.
- **Reads, does not write:** `.meowkit/memory/cost-log.json`,
  `.codex/`, `.mcp.json`. No file writes anywhere.
- **No env vars introduced.** Window size is hard-coded 200K; override deferred
  until a real 1M-context use case appears.
- **Discovery:** via `keywords:` frontmatter and a cross-reference from
  `the budget skill`. There is no separate routing rule.

## Gotchas

(none yet — grow from observed failures)

## Related Rules

- Skill authoring conventions — discovery + Gotchas section requirements
- `AGENTS.md` (Data & injection boundary) Rule 11 — Skill Rule of Two; this skill
  scores 2 of 3 (untrusted SCAN_ROOT input + filename inventory may surface
  sensitive paths) so paths are canonicalized via `realpath` and never executed.
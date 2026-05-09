# Token Cost Model

This document explains how `mk:context-audit` converts raw bytes into token
estimates and how it derives the structural-overhead percentage banners.

## Heuristic: chars / 4

Every counted byte is divided by 4 to estimate tokens. This is the same
heuristic encoded in:

- `meowkit/packages/mewkit/src/orchviz/token-estimator.ts` (`CHARS_PER_TOKEN = 4`)
- `meowkit/.claude/hooks/handlers/budget-tracker.cjs` (cost-tracking path)

We inline the heuristic in shell rather than calling
`token-estimator.ts` because:

1. The TS module exports a programmatic API only (no CLI entry).
2. `dist/` is `.gitignore`d and not present on a fresh `mewkit init` install,
   so a Node bridge would require an extra build step.
3. The heuristic is a single expression. Mirroring it inline keeps the audit
   script zero-dep.

**Consistency over precision.** The chars/4 heuristic is wrong in the same
direction as `budget-tracker.cjs`. That makes audit results comparable
across runs and consistent with cost reports — even though it overestimates
code-heavy content and underestimates dense prose.

## Per-Category Notes

| Category    | Loaded When                                     | Notes |
| ----------- | ----------------------------------------------- | ----- |
| CLAUDE.md   | Every session, at preamble                      | Lives in always-on bundle. Trims here have the highest leverage. |
| agents      | On `Task` invocation; `mk:lazy-agent-loader` defers | Per-agent overhead is realized only when an agent is spawned. Many agent files inflate the static bundle even when unused. |
| skills      | On skill activation                             | SKILL.md frontmatter is always loaded; body is JIT. Frontmatter bloat is a hidden cost. |
| rules       | Always-on for `injection-rules.md`, `security-rules.md`, etc. | The 5 essentials are non-negotiable; auxiliary rules can grow without bound. |
| commands    | When user invokes the slash                     | Per-command overhead is realized at invoke time. Often small but counted in the structural budget for completeness. |
| mcp servers | Connected at session start                       | Tool schemas are large; counted as schema-bytes / 4. |

## Window Size

Hard-coded at **200,000 tokens** — Claude's standard context window. There
is no env-var override:

- A 1M-context model is not yet routine for production work.
- Adding a `MEOWKIT_CONTEXT_WINDOW` env var would need test-coverage and
  documentation drift across `cost-log.json`, agent specs, and routing.
- The override is a single integer change in `estimate-tokens.sh`. The cost
  of deferral is one line of refactor when real demand appears.

(Note: the script reads `MEOWKIT_CONTEXT_WINDOW` if set, but this is an
escape hatch, not a documented user-facing surface. Setting it does not
re-calibrate the 10/25% banners — see below.)

## Threshold Banners

Three banners drive the formatter's headline status:

| `structural_overhead_pct` | Banner             |
| ------------------------- | ------------------ |
| `< 10%`                   | Healthy            |
| `10% – 25%`               | Watch              |
| `≥ 25%`                   | Action recommended |

These thresholds are the **canonical source of truth** for token-overhead
banners. They are NOT linked to `MEOWKIT_BUDGET_*` env vars — those track
USD cost, not window utilization.

The 10 / 25% values are v1 defaults. Calibrate against real production data
before tuning.

## Schema (after estimation)

```json
{
  "scan_root": "...",
  "scan_timestamp": "...",
  "claude_md_chain": [{"path": "...", "bytes": N, "lines": N, "estimated_tokens": N}],
  "agents":          [{"name": "...", "bytes": N, "estimated_tokens": N}],
  "skills":          [{"name": "...", "bytes": N, "frontmatter_bytes": N, "estimated_tokens": N}],
  "rules":           [{"path": "...", "bytes": N, "estimated_tokens": N}],
  "commands":        [{"path": "...", "bytes": N, "estimated_tokens": N}],
  "mcp_servers":     [{"name": "...", "tool_count": N, "estimated_bytes": N, "estimated_tokens": N}],
  "totals": {
    "claude_md_tokens": N,
    "agents_tokens": N,
    "skills_tokens": N,
    "rules_tokens": N,
    "commands_tokens": N,
    "mcp_tokens": N,
    "structural_overhead_tokens": N,
    "window_size_tokens": 200000,
    "structural_overhead_pct": F
  }
}
```

# Dead-Weight Audit Registry

The versioned registry mandated by `.claude/rules/dead-weight-audit-rules.md` Rule 6:
the source of truth for what each harness component assumes the model *cannot* do, its
measured benchmark delta, and the resulting KEEP / WATCH / PRUNE decision. Every new
harness component gets a row on the PR that introduces it (Rule 6). Components exempt
from pruning regardless of delta (security defenses, Gate 1 / Gate 2 flows, the
active-verification hard gate) are marked **NEVER-PRUNE** per Rule 4 — their catch-rate
is not the right metric for a safety net.

This document is MeowKit-repo-internal (it audits MeowKit's own components) and is not
shipped by `npx mewkit init`; no shipped `.claude/` file references it.

Delta convention: `measured_delta = baseline_avg − disabled_avg` on the calibration set
(Rule 2). `N/A` = a correctness/safety component whose value is not a benchmark delta.

| Component | Encoded assumption | Measured delta | Model version | Audit date | Decision |
|---|---|---|---|---|---|
| `core/provider-adapter.ts` — `describeProvider().summary` | Two provider-support surfaces can silently diverge and over-claim enforcement | N/A (correctness fix — single source of truth) | Opus 4.8 | 2026-07-18 | KEEP |
| `hooks/lib/approval-receipt.sh` | The model may write source before a human approved the plan (Gate 1) | N/A (**NEVER-PRUNE** — Gate 1 flow, Rule 4) | Opus 4.8 | 2026-07-18 | KEEP |
| `commands/plan-approve.ts` (`mewkit plan approve`) | A human approval is not recorded against the plan revision, so stale approvals carry over | N/A (**NEVER-PRUNE** — Gate 1 write path, Rule 4) | Opus 4.8 | 2026-07-18 | KEEP |
| `hooks/lib/gate2-check.sh` — revision binding | A verdict with no revision can authorize a ship of code it never reviewed | N/A (**NEVER-PRUNE** — Gate 2 flow, Rule 4) | Opus 4.8 | 2026-07-18 | KEEP |

## Notes

- The `approval-receipt` + `gate2` revision bindings are **anti-accidental** (deter/detect):
  they are agent-writable and prove "an approval was stamped against this revision", not
  "a human approved". They are NEVER-PRUNE because they are part of the Gate 1 / Gate 2
  flows — but a future signed-receipt implementation (ADR 260715) is what would make them
  unforgeable; that is tracked separately, not a prune candidate.
- Retroactive entries: components introduced before this registry existed are added as they
  are next touched, not backfilled wholesale.

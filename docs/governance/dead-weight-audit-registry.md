# Dead-Weight Audit Registry

The versioned registry mandated by `.claude/skills/benchmark/references/dead-weight-audit-rules.md` Rule 6:
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
| `hooks/lib/approval-receipt.cjs` | The model may write source before a human approved the plan (Gate 1) | N/A (**NEVER-PRUNE** — Gate 1 flow, Rule 4) | Opus 4.8 | 2026-07-18 | KEEP |
| `commands/plan-approve.ts` (`mewkit plan approve`) | A human approval is not recorded against the plan revision, so stale approvals carry over | N/A (**NEVER-PRUNE** — Gate 1 write path, Rule 4) | Opus 4.8 | 2026-07-18 | KEEP |
| `hooks/lib/gate2-check.cjs` — revision binding | A verdict with no revision can authorize a ship of code it never reviewed | N/A (**NEVER-PRUNE** — Gate 2 flow, Rule 4) | Opus 4.8 | 2026-07-18 | KEEP |
| `skills/evaluate/scripts/recompute-score.py` | The evaluator can declare a passing weighted_score that its own per-rubric verdicts do not support (INCONSISTENT forged PASS — the audit's shape). Does NOT catch a self-consistent fabrication (all-PASS with weak evidence); that is the skeptic-evaluator's + evidence's job. | N/A (**NEVER-PRUNE** — active-verification / evaluator integrity, Rule 4) | Opus 4.8 | 2026-07-18 | KEEP |
| `skills/evaluate/scripts/validate-verdict.sh` v2 (recompute + evidence manifest + evaluator identity) | A well-formed verdict is trusted without checking the score follows from the rubrics or that evidence/identity exist | N/A (**NEVER-PRUNE** — active-verification hard gate, Rule 4) | Opus 4.8 | 2026-07-18 | KEEP |
| `migrate/denied-token-scan.ts` | Claude-Code-bound tokens (`/mk:`, `AskUserQuestion`, `.claude/`, `subagent`, …) leak into content installed for a non-Claude provider | N/A (correctness — provider-parity honesty; shared by the Codex classifier + Phase-6 target validator) | Opus 4.8 | 2026-07-18 | KEEP |
| `migrate/portability-policy.ts` runtime gate (`classifySkillForProvider` / `computeSkillParity`) | Migration silently copies `runtime: claude-code` skills to Codex as if portable (they installed unadapted) | N/A (correctness — default-deny + measured parity score) | Opus 4.8 | 2026-07-18 | KEEP |
| `migrate/providers/codex/adapter-map.ts` | A host-bound token has no declared Codex equivalent, so an adapted skill still leaks it | N/A (scaffold — empty skill-adapter table this phase; token rules projection-tested; now also cleans command→codex-skill tool tokens) | Opus 4.8 | 2026-07-18 | WATCH |
| `validate/targets/` (`target-profile.ts` + `codex-target.ts`) | A generated Codex project has no post-migration quality gate — a broken/leaky target ships undetected | N/A (correctness — provider-target validation; provider-keyed so new providers add a profile, not a command) | Opus 4.8 | 2026-07-18 | KEEP |
| `journey-validation/` (`deterministic-runner.ts` + `oracles.ts` + `side-effect-observer.ts`) | Cross-harness parity (J10) is claimed but never machine-checked — a payload could silently diverge | N/A (correctness — deterministic structural-parity oracles run in CI, no model calls; reuses migration + target validation as libraries) | Opus 4.8 | 2026-07-18 | KEEP |
| `journey-validation/cost-ledger.ts` (+ `run-canary.sh check-cap`) | A benchmark / live run overspends because the `cost_cap_usd` is recorded but never enforced | N/A (correctness — Rule 6 cap enforcement; proven against a mock backend so deferred live backends inherit it) | Opus 4.8 | 2026-07-18 | KEEP |
| `athena` agent + `--advice` supervision lane (`rules-conditional/advice-supervision-rules.md`, per-skill named checkpoints) | Executor models benefit from bounded elevated-reasoning supervision across a run: direction before work, rescue when stalled, an independent read of finished work, and a bounded correction cycle | Not yet measured — supervised-vs-control sample runs tune cadence and context budget; a checkpoint that duplicates an existing specialist with no unique caught defects is a removal candidate | Opus 5 | 2026-07-26 | WATCH |
| Codex/Cursor supervisor adapters + contract projections (`codex/.codex/agents/athena.toml` + `rule-advice-supervision` skill; `cursor/.cursor/agents/athena.md` + `domain-advice-supervision.mdc`) | A non-Claude runtime cannot reach the supervisor without a hand-authored adapter in its own dialect, and the contract has nowhere to live on a plane with no conditional-rule surface | N/A (correctness — semantic parity is asserted against the enforced constants, not a prose copy). Cost is real but conditional: both projections load only when `--advice` is present, so an unsupervised run pays nothing | Opus 5 | 2026-07-27 | WATCH |
| `core/advice-support-report.ts` + the `mewkit providers` advice section | Structural presence reads as working support — an operator trusts `--advice` on a runtime nobody has exercised | N/A (correctness — the report is the only surface where an unexercised runtime says so; a test forbids a `supported` claim on structural evidence) | Opus 5 | 2026-07-27 | KEEP |

| Wiki subsystem (`mewkit wiki`, `mk:wiki`, `mk:wiki-research`, `mk:wiki-render`; `packages/mewkit/src/wiki/`) | The model cannot find past project knowledge with a plain grep, so a gated, FTS-indexed wiki with a propose/approve pipeline is needed | not measured (benchmark baseline deferred by owner) | n/a (not measured) | 2026-11-01 | PRUNE (provisional; Rule 5 re-audit pending) |
| Wiki obfuscation and flood passes (`wiki/infrastructure/scanner-adapter.ts`: base64, ROT13, percent-decode, HTML comments, byte cap, flood check) | Injection hides in encoded blocks, and a flooded or oversized memory file is a context attack (`injection-rules.md` Rules 8–9) | N/A (**NEVER-PRUNE** — security defense, Rule 4); the passes are restored in `validate --memory`, not pruned | n/a (not measured) | 2026-11-01 | KEEP |
| Curated JSON stores and generated views (`fixes.json`, `review-patterns.json`, `architecture-decisions.json`, `security-findings.json`; `memory/render-views.ts`, `memory/seed-from-md.ts`) | Structured JSON stores with regenerated markdown views recall better than plain markdown | not measured (benchmark baseline deferred by owner) | n/a (not measured) | 2026-11-01 | PRUNE (provisional; Rule 5 re-audit pending) |
| Recall composition and derived index (`knowledgeRecall` envelope, `mewkit index`, `mewkit query`, `mewkit memory`; `core/derived-index.ts`) | A derived SQLite index and a recall envelope add retrieval quality over grep at this store size. Open: cross-run trace and cost aggregation has no successor | not measured (benchmark baseline deferred by owner) | n/a (not measured) | 2026-11-01 | PRUNE (provisional; Rule 5 re-audit pending) |
| Prompt-prefix capture hook (`hooks/handlers/immediate-capture-handler.cjs`, `mewkit memory capture`; `##pattern:` / `##decision:` / `##note:`) | Lessons are captured automatically from prompt prefixes without a human asking. Its write-time injection and secret gate is a security defense and is replaced by `validate --memory` and `mewkit note` (Rule 4) | not measured (benchmark baseline deferred by owner) | n/a (not measured) | 2026-11-01 | PRUNE (provisional; Rule 5 re-audit pending) |
| Auto-prune Stop hook (`hooks/lib/memory-prune.py`) | Stale memory must be removed automatically at session end | not measured (benchmark baseline deferred by owner) | n/a (not measured) | 2026-11-01 | PRUNE (provisional; Rule 5 re-audit pending) |
| Memory migrators (`scripts/memory-migrator.cjs`, `scripts/memory-topic-file-migrator.cjs`) | v2 stores must be migrated in place on upgrade | not measured (benchmark baseline deferred by owner) | n/a (not measured) | 2026-11-01 | PRUNE (provisional; Rule 5 re-audit pending) |
| Always-loaded memory and wiki instruction rules (`rules/memory-read-rules.md`, `rules/wiki-context-rules.md`) | The model needs instructions on how to read the memory and wiki surfaces at every session start | not measured (benchmark baseline deferred by owner) | n/a (not measured) | 2026-11-01 | PRUNE (provisional; Rule 5 re-audit pending) |
| `validate --memory` lint (`core/check-memory-store.ts`) | A committed, grep-read store must be checked at the PR boundary for injection, obfuscated injection, secrets, size and flood (`injection-rules.md` Rules 8–9) | N/A (**NEVER-PRUNE** — security defense, Rule 4) | n/a (not measured) | 2026-11-01 | KEEP |
| `mewkit note <decisions\|gotchas>` (`npx mewkit note`) | Every memory append must be lint-checked and serialized under a file lock, so a rejected or concurrent write never corrupts or silently loses an entry, and a secret is never echoed | N/A (**NEVER-PRUNE** — write-path security gate, Rule 4) | n/a (not measured) | 2026-11-01 | KEEP |
| Zero-residue CI check (`scripts/check-memory-wiki-residue.cjs`) | Removed wiki and JSON-store names must not reappear in `.claude/` or `packages/mewkit/src/` (AC-04 pinned roots) | N/A (correctness — residue oracle; no benchmark delta) | n/a (not measured) | 2026-11-01 | KEEP |

## Notes

- The `approval-receipt` + `gate2` revision bindings are **anti-accidental** (deter/detect):
  they are agent-writable and prove "an approval was stamped against this revision", not
  "a human approved". They are NEVER-PRUNE because they are part of the Gate 1 / Gate 2
  flows — but a future signed-receipt implementation (ADR 260715) is what would make them
  unforgeable; that is tracked separately, not a prune candidate.
- Retroactive entries: components introduced before this registry existed are added as they
  are next touched, not backfilled wholesale.
- Memory diet (phase 08): the removed-component rows are **provisional PRUNE**. No benchmark baseline
  was run (deferred by the owner), so `measured_delta` is recorded as not measured. Rule 3 needs
  `delta <= 0` and Rule 5 needs two consecutive model versions below 1 point before a PRUNE is final.
  Security-defense classes in the removed set (injection obfuscation passes, flood and byte caps,
  the capture gate) are NEVER-PRUNE under Rule 4; their replacement lives in `validate --memory`.

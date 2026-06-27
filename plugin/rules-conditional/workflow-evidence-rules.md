---
source: original
applies_to: [mk:fix, mk:cook, mk:review, mk:ship]
loaded_by: consuming skills on demand (NOT always-on)
trust_level: HIGH
---

# Workflow Evidence Index

**Core rule:** ONE JSON file per run indexes pointers + normalized summaries of
what already exists (plan, diagnosis, verify output, verdict, approvals). It is
an INDEX, not a second source of truth, and it **never approves anything**.
Gate 1 and Gate 2 remain human authority (`.claude/rules/gate-rules.md`).

Validator (executable source of truth for these rules):
`.claude/scripts/validate-workflow-evidence.cjs`. Zero runtime deps, Node
builtins, native JSON. Exit 0 = `EVIDENCE_OK`; exit 1 = `EVIDENCE_BLOCKED:<reasons>`.

## 1 — The Hard Line

Evidence can say **"ready for Gate 2"**, never **"Gate 2 approved."** It records
the *result* of the gate scripts and human approval; it does not produce them.
The validator performs **NO score check** — score is advisory display only and is
never an approval predicate.

## 2 — Fields (minimum shape)

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | number | index format version |
| `skill` | `mk:fix` \| `mk:cook` | required |
| `mode` | string | `auto` / `interactive` / `quick` / … |
| `task` | string | required, non-empty |
| `planPath` | string | pointer to `tasks/plans/<plan>/plan.md` when planned |
| `phase` | string | current workflow phase label |
| `risk` | object | `{ matchedFlags[], requiresHumanApproval, reason }` — flags ⊆ the 9 IDs in `risk-checklist.md` |
| `fixDiagnosis` | object | `{ exactSymptom, reproduction, expectedActual, rootCause, whyNow, blastRadius[] }` — `mk:fix` only (six fields) |
| `cookContract` | object | `{ expectedOutput, acceptanceCriteria[], scopeBoundary[], constraints[], touchpoints[] }` — `mk:cook` only (five dimensions) |
| `verification` | object | `{ commands[], overall }` — pointers/summary, NOT raw logs |
| `review` | object | `{ verdictPath, status, sideEffectsDetected, userDecisionAddendum? }` |
| `approvals` | object | `{ gate1, gate2, ship }` — each `not_applicable` \| `required` \| `approved` |
| `memory` | object | `{ fixPatternWritten, reviewPatternWritten }` — capture status, NOT the patterns |

## 3 — Validation Rules (enforced by the `.cjs`)

- `skill` ∈ {`mk:fix`, `mk:cook`}; `task` non-empty.
- `risk.matchedFlags` ⊆ the 9 IDs in `.claude/rules/risk-checklist.md`
  (`AUTH, AUTHZ, DATA_MODEL, AUDIT_SEC, EXT_SYSTEM, PUBLIC_CONTRACT, CROSS_PLATFORM, EXISTING_BEHAVIOR, WEAK_PROOF`).
- `mk:fix` → all six `fixDiagnosis` fields populated before implementation.
- `mk:cook` → all five `cookContract` dimensions populated before Gate 1, **unless**
  the input was an existing `plan.md` / `phase-*.md` path (pass `--plan-input`).
- `verification.commands` non-empty before review/finalize.
- `approvals.gate2 === "approved"` requires a non-empty `review.verdictPath`.
- `review.sideEffectsDetected === true` requires a non-empty `review.userDecisionAddendum`
  — mirrors `cook/scripts/validate-gate-2.sh` (mirror status; does NOT replace that script).
- **No score validation anywhere.**

Run before presenting for approval:
`node .claude/scripts/validate-workflow-evidence.cjs <path> --phase fix|cook [--plan-input]`.

## 4 — Storage Rules

| Run type | Path |
|---|---|
| Planned `mk:cook` work | `tasks/plans/<plan>/reports/evidence/workflow-evidence.json` |
| Standalone `mk:fix` standard/complex | `.claude/session-state/evidence/<YYMMDD-HHMM-slug>/workflow-evidence.json` |

`session-state/` is framework-internal state — the `${CLAUDE_PLUGIN_DATA}` rule
(`skill-authoring-rules.md` Rule 2) explicitly exempts it. `--quick` fixes write
the compact `fixDiagnosis` form; simple fixes may skip evidence entirely.

## 5 — Evidence ≠ Memory

Evidence is **one-run proof** (this run's pointers); memory JSON
(`.claude/memory/*.json`) is **durable cross-run patterns**. They never mix:
the run's evidence file is not a memory store, and the JSON stores stay
JSON-first per `memory-read-rules.md`. Write both separately.

## 6 — Scrub Rule

Before writing evidence, scrub secrets / tokens / PII. Store **pointers and
short summaries only** — never raw command logs, full stack traces, or
credential-bearing output. The validator reads a local path only and transmits
nothing (`injection-rules.md` Rules 5-6).

## Integrations

- `mk:fix` Step 2.5 / Step 5 / Step 6 → produces fix evidence
- `mk:cook` Phase 0-6 → produces cook evidence (mirrors gate scripts)
- `mk:review` → records `review.verdictPath`
- `mk:ship` pre-flight → reads evidence (augments, never overrides `mk:verify`)

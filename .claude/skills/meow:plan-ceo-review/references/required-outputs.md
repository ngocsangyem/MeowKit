# Required Outputs

## "NOT in scope" section

List work considered and explicitly deferred, with one-line rationale each.

## "What already exists" section

List existing code/flows that partially solve sub-problems and whether the plan reuses them.

## "Dream state delta" section

Where this plan leaves us relative to the 12-month ideal.

## Failure Analysis (merged: Error & Rescue + Failure Modes)

Single table combining method-level error paths and codepath failure modes:

```
  CODEPATH / METHOD | FAILURE MODE   | RESCUED? | RESCUE ACTION        | TEST? | USER SEES?     | LOGGED? | SEVERITY
  ------------------|----------------|----------|----------------------|-------|----------------|---------|----------
  PaymentService.charge | Stripe timeout | Y | Retry 3x, then queue | Y | "Processing..." | Y | HIGH-LEVERAGE
  AuthController.login  | DB connection  | N | —                    | N | 500 error       | N | BLOCKER
```

Any row with RESCUED=N AND TEST=N AND USER SEES=Silent → **BLOCKER** (automatic).

## TODOS.md updates

Present each potential TODO as its own individual AskUserQuestion. Never batch TODOs — one per question. Never silently skip this step. Follow the format in `.claude/skills/meow:review/TODOS-format.md`.

For each TODO, describe:
* **What:** One-line description of the work.
* **Why:** The concrete problem it solves or value it unlocks.
* **Pros:** What you gain by doing this work.
* **Cons:** Cost, complexity, or risks of doing it.
* **Context:** Enough detail that someone picking this up in 3 months understands the motivation, the current state, and where to start.
* **Effort estimate:** S/M/L/XL (human team) → with MeowKit: S→S, M→S, L→M, XL→L
* **Priority:** P1/P2/P3
* **Depends on / blocked by:** Any prerequisites or ordering constraints.

Then present options: **A)** Add to TODOS.md **B)** Skip — not valuable enough **C)** Build it now in this PR instead of deferring.

## Scope Expansion Decisions (EXPANSION and SELECTIVE EXPANSION only)

For EXPANSION and SELECTIVE EXPANSION modes: expansion opportunities and delight items were surfaced and decided in Step 0D (opt-in/cherry-pick ceremony). The decisions are persisted in the CEO plan document. Reference the CEO plan for the full record. Do not re-surface them here — list the accepted expansions for completeness:
* Accepted: {list items added to scope}
* Deferred: {list items sent to TODOS.md}
* Skipped: {list items rejected}

## Diagrams (mandatory, produce all that apply)

1. System architecture
2. Data flow (including shadow paths)
3. State machine
4. Error flow
5. Deployment sequence
6. Rollback flowchart

## Stale Diagram Audit

List every ASCII diagram in files this plan touches. Still accurate?

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | EXPANSION / SELECTIVE / HOLD / REDUCTION     |
  | System Audit         | [key findings]                              |
  | Step 0               | [mode + key decisions]                      |
  | Section 1  (Arch)    | ___ issues found                            |
  | Section 2  (Errors)  | ___ error paths mapped, ___ GAPS            |
  | Section 3  (Security)| ___ issues found, ___ High severity         |
  | Section 4  (Data/UX) | ___ edge cases mapped, ___ unhandled        |
  | Section 5  (Quality) | ___ issues found                            |
  | Section 6  (Tests)   | Diagram produced, ___ gaps                  |
  | Section 7  (Perf)    | ___ issues found                            |
  | Section 8  (Observ)  | ___ gaps found                              |
  | Section 9  (Deploy)  | ___ risks flagged                           |
  | Section 10 (Future)  | Reversibility: _/5, debt items: ___         |
  | Section 11 (Design)  | ___ issues / SKIPPED (no UI scope)          |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (___ items)                          |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| ___ methods, ___ CRITICAL GAPS              |
  | Failure modes        | ___ total, ___ CRITICAL GAPS                |
  | TODOS.md updates     | ___ items proposed                          |
  | Scope proposals      | ___ proposed, ___ accepted (EXP + SEL)      |
  | CEO plan             | written / skipped (HOLD/REDUCTION)           |
  | Outside voice        | ran (codex/claude) / skipped                 |
  | Lake Score           | X/Y recommendations chose complete option   |
  | Diagrams produced    | ___ (list types)                            |
  | Stale diagrams found | ___                                         |
  | Unresolved decisions | ___ (listed below)                          |
  +====================================================================+
```

## Unresolved Decisions

If any AskUserQuestion goes unanswered, note it here. Never silently default.

---

## Verdict (Layer 5)

After all sections complete, produce a severity rollup:

```
Verdict logic:
  blockers > 0 → NEEDS REVISION
  blockers = 0 → APPROVED (with notes if high-leverage or polish items exist)
```

## Append-Only CEO Review Output

**NEVER overwrite existing plan.md content.** Append the following block at the END of plan.md (below any existing `## MEOWKIT REVIEW REPORT` section — both coexist):

```markdown
## CEO Review ({date}, {MODE} SCOPE)

**Verdict:** {APPROVED / APPROVED with notes / NEEDS REVISION}
**Two-Lens:** Intent {PASS/WARN/FAIL}, Execution {PASS/WARN/FAIL}
**Blockers:** {count} {list if any}
**High-leverage:** {count} {brief list}
**Polish:** {count}
**Coverage:** {N}/{M} requirements mapped
**Pre-screen:** {PASS / N gaps noted}
```

All modes (including HOLD and REDUCTION) write this block. EXPANSION/SELECTIVE additionally write the CEO plan doc to `.claude/memory/projects/ceo-plans/`.

Accepted TODOs from the review are auto-written to TODOS.md with source tag `ceo-review`.

# Phase Gate Rules — HARD STOPS

<!-- Canonical source: .claude/workflow.yaml -->

These are hard stops. No automation may bypass them. No agent may self-approve.

## The Gate Authority Invariant

**Automation executes BETWEEN gates. It never supplies the authority OF a gate.**

Evaluator verdicts, reviewer scores, validator exit codes, evaluator "stamps", passing
test suites, and structural pre-checks are **evidence**. Evidence is what the human reads
at the gate. It is never a substitute for the approval the gate requires.

This invariant holds in every mode, including `--auto` and `--fast`. "Auto" means the
workflow advances between gates without prompting for each step — it does NOT mean the
workflow approves its own gates. A PASS verdict routes to gate *presentation*; it does
not clear the gate.

Concretely, the following are all forbidden regardless of wording:

- Skipping a gate prompt because a script, score, or verdict passed
- Treating an evaluator PASS as the Gate 2 approval itself
<!-- lint-allow-gate-authority -->
- Any mode that "auto-approves" Gate 1 or Gate 2

The three exceptions to Gate 1 below are exhaustive and are bypasses of the *gate*, not
grants of authority to automation. Gate 2 has no exceptions at all.

WHY: The moment automation can approve its own work, the gate measures whether the
automation is confident — not whether the change is correct. Confidence is not review.

## GATE 1 — After Phase 1 (Plan)

Gate 1 is formally the Phase 1→Phase 2 transition gate. In default (non-TDD) mode
Phase 2 is skipped, so Gate 1 is the effective block before Phase 3 Build begins.
Both statements are true simultaneously: the gate fires after Plan and before
whichever phase is next (Test in TDD mode; Build otherwise).

### Conditions for Approval

All must be true:

1. **Plan file exists** at `tasks/plans/YYMMDD-name/plan.md`
2. **All required sections are populated:**
   - Problem: what problem this solves and for whom
   - Success Criteria: measurable definition of done
   - Technical Approach: how it will be built
3. **Human has explicitly typed approval.** Approval is not inferred from silence, delay, or ambiguous responses.

### What It Blocks

Proceeding to Phase 2 (Test RED) in TDD mode, or directly to Phase 3 (Build) in default mode. No tests are written, no code is written, no reviews happen until the plan is approved.

### Exception

`/mk:fix` with complexity=simple bypasses Gate 1. The fix IS the plan — the scope is small enough that a separate planning document adds overhead without value.

Scale-routing one-shot: When `mk:scale-routing` returns `workflow=one-shot` AND orchestrator confirms zero blast radius, Gate 1 may be bypassed. See `scale-adaptive-rules.md` Rule 4.

Explicit user override: `/mk:cook` may bypass Gate 1 only when the user explicitly says
to skip planning **and** Phase 0 found zero matched risk flags. The agent records the
override and rationale in the active plan or security log per
`.claude/rules/intervention-recording-rules.md`; a keyword match or risk heuristic can
never grant this exception on its own.

### Plan Shape

Plans live under `tasks/plans/YYMMDD-name/`.

- `plan.md` is the overview entrypoint and stays under 80 lines.
- `phase-XX-name.md` files hold detailed phase instructions, context links, requirements, affected files, implementation steps, success criteria, risks, security notes, and next steps.

Every plan and phase file must be self-contained: goal, scope, assumptions, constraints, acceptance criteria, verification commands, and file paths must be understandable without prior conversation.

## GATE 2 — After Phase 4 (Review)

### Conditions for Approval

All must be true:

1. **Verdict file exists** at `tasks/reviews/YYMMDD-name-verdict.md`
2. **No FAIL dimensions** in the verdict (all 5 dimensions must be PASS or WARN)
3. **All WARN items acknowledged** by human (each WARN explicitly seen and accepted)
4. **Security scan shows no BLOCK items** (from security-rules.md patterns AND security agent verdict — a security agent BLOCK automatically makes the Security dimension FAIL)
5. **Human has explicitly typed approval.** Same standard as Gate 1 — explicit, not inferred.

### What It Blocks

Proceeding to Phase 5 (Ship). No commit, no PR, no deploy until Gate 2 passes.

### Exceptions

None. Every change ships through Gate 2. There are no exceptions to Gate 2, regardless of:
- Mode (even fast mode checks for BLOCKs)
- Urgency
- Size of change
- Who requested it

## Gate 2 Applicability at Ship Boundaries

Gate 2 has no exceptions — but it does have a scope. A change that ships no code has
nothing for Gate 2 to review. That is **N/A**, and N/A is declared out loud, never
silently skipped: a check that quietly passes is indistinguishable from a check that
never ran.

`.claude/hooks/lib/gate2-check.sh` enforces this at `git commit` / `push` / `merge`.

| Change contains | Gate 2 | Enforcement |
|---|---|---|
| Any source, config, hook, script, or `.claude/**` file | **Required** | Structural proof or hard block (exit 2) |
| Only `docs/**`, `tasks/reports/**`, or `*.md` outside `.claude/**` | **N/A** | Allowed, N/A stated explicitly |
| A mix of the two | **Required** | The source file in it still ships |

### Classifier

Only the **no-ship** set is enumerated:

- `docs/**`
- `tasks/reports/**`
- `*.md` — but **not** under `.claude/**`, where markdown *is* the product

Everything else is ship-capable. The list is one-sided on purpose: enumerating
ship-capable paths instead would be unportable (a consumer project's layout is not this
repo's) and fail-open (an unrecognized path would sail through). Unknown path ⇒
ship-capable.

Any single ship-capable file makes the whole change ship-capable. A mixed change is not
partially exempt.

### Which verdict applies

The verdict is resolved from the **active-plan pointer**
(`session-state/active-plan.json` → `path` / `slug`), then
`tasks/reviews/<YYMMDD>-<slug>-verdict.md` (or `-evalverdict.md`).

Missing pointer, unresolvable slug, zero verdicts, or **more than one** matching verdict
on a ship-capable change all **fail closed**. "Most recent verdict wins" is forbidden: it
would let an unrelated review authorize this ship.

### What the structural check proves — and does not

| Proven | Not proven |
|---|---|
| A verdict for the active plan exists | That a human approved it |
| It names no FAIL dimension, no security BLOCK | Which revision the human actually reviewed |
| A present evidence index does not contradict it | That the verdict was not authored by the acting session |

Every artifact the check reads is writable by the same session that produced the change,
so a session can author all of them. **A pass means the paperwork is present and
self-consistent — not that a human approved.** No hook output and no evidence field
(e.g. `approvals.gate2`) may be read as approval proof. Closing this requires a
host-authenticated approval receipt: see
`docs/architecture/adr/260715-gate2-approval-receipt.md` (designed; not yet enforced).

## Reviewer Checklist — Gate Authority (standing item)

`mewkit validate --gates` mechanically rejects the KNOWN wordings that grant automated
gate approval. It is a **floor, not the contract**: it matches a fixed pattern set, and
any paraphrase walks straight through it.

So at Gate 2, whenever a change touches `.claude/rules/`, `.claude/modes/`,
`.claude/skills/cook/`, or `.claude/skills/autobuild/`, the reviewer MUST answer:

> **Does any prose in this change grant approval authority to something that is not a
> human — in any wording?**

Look for the intent, not the phrase: a mode that "proceeds when the score is high enough",
a step that "continues once the verdict is clean", a flag that "runs unattended through
ship". If automation decides whether to advance past a gate, it is a violation no matter
how it is written.

A passing lint is not an answer to this question.

## Self-Check Before Gate Presentation

Before presenting Gate 1 or Gate 2 for human approval, the responsible agent MUST include:

1. **Completed:** List of completed items
2. **Skipped:** List of intentionally skipped items with justification (empty if none)
3. **Uncertain:** List of items the agent is uncertain about (empty if none)

If #2 or #3 contain items, the human sees them BEFORE the approval prompt — not buried in a report.

WHY: Declaring skipped/uncertain work prevents silent rationalization.

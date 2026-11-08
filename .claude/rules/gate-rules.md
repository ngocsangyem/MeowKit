# Phase Gate Rules — HARD STOPS

<!-- Canonical source: .claude/workflow.yaml -->

These are hard stops. No automation may bypass them. No agent may self-approve.

## The Gate Authority Invariant

**Automation executes BETWEEN gates. It never supplies the authority OF a gate.**

Evaluator verdicts, reviewer scores, validator exit codes, evaluator "stamps", passing test suites and structural pre-checks are **evidence** — what the human reads at the gate, never a substitute for the approval it requires. This holds in every mode, `--auto` and `--fast` included: "auto" means the workflow advances between gates without prompting for each step, NOT that it approves its own gates. A PASS verdict routes to gate *presentation*; it does not clear the gate.

Forbidden however worded: skipping a gate prompt because a script, score or verdict passed; treating an evaluator PASS as the Gate 2 approval itself;
<!-- lint-allow-gate-authority -->
any mode that "auto-approves" Gate 1 or Gate 2. The three Gate 1 exceptions below are exhaustive and bypass the *gate*, not the authority; Gate 2 has no exceptions at all.

## GATE 1 — After Phase 1 (Plan)

The Phase 1→2 transition gate: it blocks Phase 2 (Test RED) in TDD mode and Phase 3 (Build) in default mode, which skips Phase 2. No tests, no code, no reviews until the plan is approved.

### Conditions for Approval

All must be true:

1. **Plan file exists** at `tasks/plans/YYMMDD-name/plan.md`
2. **All required sections are populated:** Problem (what it solves, for whom), Success Criteria (measurable definition of done), Technical Approach (how it will be built)
3. **Human has explicitly typed approval.** Approval is not inferred from silence, delay, or ambiguous responses.
4. **A fresh approval receipt is stamped on the plan** (default-on). After the human approves, run `npx mewkit plan approve <plan-dir>`: it writes an `approval:` frontmatter block binding the approval to the current plan body (`plan_hash`). `gate-enforcement.cjs` blocks source edits until that receipt exists, and blocks again once the plan body changes (stale hash ⇒ re-approve). `MEOWKIT_GATE1_PRESENCE_ONLY=1` downgrades Gate 1 to a plan-presence check — an explicit, logged opt-out.

The receipt is written by the agent, not the host: it proves *an approval was stamped against this plan revision*, **never** *a human approved*. Its value is the revision binding, not authenticity. The agent runs `plan approve` only after a real human approval; it never self-approves.

### Exceptions (exhaustive)

1. `/mk:fix` with complexity=simple — the fix IS the plan; too small for a separate planning document to add value.

2. Scale-routing one-shot: `workflow=one-shot` AND the orchestrator confirms zero blast radius — `.claude/skills/agent-detector/references/scale-adaptive-rules.md` Rule 4.
3. Explicit user override in `/mk:cook`: only when the user explicitly says to skip planning AND Phase 0 matched zero risk flags. The agent records the override and rationale per "Recording Human Interventions" below; no keyword match or risk heuristic can grant this exception on its own.

Plan shape: under `tasks/plans/YYMMDD-name/`, `plan.md` is the overview entrypoint (under 80 lines); `phase-XX-name.md` files hold the detail. Each file must be self-contained — goal, scope, assumptions, constraints, acceptance criteria, verification commands and file paths readable without prior conversation.

## GATE 2 — After Phase 4 (Review)

Blocks Phase 5 (Ship): no commit, no PR, no deploy until Gate 2 passes.

### Conditions for Approval

All must be true:

1. **Verdict file exists** at `tasks/reviews/YYMMDD-name-verdict.md`
2. **No FAIL dimensions** in the verdict — all 5 dimensions must be PASS or WARN
3. **All WARN items acknowledged** by the human (each WARN explicitly seen and accepted)
4. **Security scan shows no BLOCK items** (`security-rules.md` patterns AND the security agent verdict — a security agent BLOCK automatically makes the Security dimension FAIL)
5. **Human has explicitly typed approval.** Same standard as Gate 1 — explicit, not inferred.

### Exceptions

None. Every change ships through Gate 2 — regardless of mode (fast mode still checks for BLOCKs), urgency, size, or who requested it.

### Applicability at Ship Boundaries

A change that ships no code has nothing to review: that is **N/A**, declared out loud, never silently skipped. `.claude/hooks/lib/gate2-check.cjs` enforces Gate 2 at commit, push and merge. Only the no-ship set is enumerated — `docs/**`, `tasks/reports/**`, `*.md` outside `.claude/**`; every other path, known or unknown, is ship-capable and REQUIRES Gate 2 (structural proof or hard block, exit 2). One ship-capable file makes the whole change ship-capable.

The verdict comes from the active-plan pointer (`session-state/active-plan.json`), then `tasks/reviews/<YYMMDD>-<slug>-verdict.md`. Missing pointer, unresolvable slug, zero verdicts, or **more than one** match on a ship-capable change all **fail closed**; "most recent verdict wins" is forbidden — an unrelated review must never authorize this ship.

The check proves only that such a verdict exists, names no FAIL dimension and no security BLOCK, and is bound to the shipped revision (names current HEAD). It is anti-accidental, not unforgeable: every artifact it reads is writable by the acting session. **A pass means the paperwork is present, self-consistent, and bound to this revision — not that a human approved.** No hook output and no evidence field (e.g. `approvals.gate2`) is approval proof.

## Reviewer Checklist — Gate Authority (standing item)

`mewkit validate --gates` rejects only the KNOWN wordings that grant automated gate approval — a **floor, not the contract**, since any paraphrase walks through its fixed pattern set. So at Gate 2, whenever a change touches `.claude/rules/`, `.claude/rules-conditional/`, `.claude/modes/`, `.claude/agents/`, `.claude/skills/cook/`, `.claude/skills/fix/`, or `.claude/skills/autobuild/`, the reviewer MUST answer:

> **Does any prose in this change grant approval authority to something that is not a human — in any wording?**

Look for the intent, not the phrase ("proceeds when the score is high enough", "runs unattended through ship"). If automation decides whether to advance past a gate it is a violation, however written. A passing lint is not an answer.

## Self-Check Before Gate Presentation

Before presenting Gate 1 or Gate 2 for human approval, the responsible agent MUST include:

1. **Completed:** list of completed items
2. **Skipped:** intentionally skipped items with justification (empty if none)
3. **Uncertain:** items the agent is uncertain about (empty if none)

If #2 or #3 contain items, the human sees them BEFORE the approval prompt — not buried in a report.

## Recording Human Interventions

Record a durable entry whenever a human overrides a blocked pattern, a gate is bypassed or excepted, an injection STOP fires (`injection-rules.md` Rule 10), or a sensitive read is approved.

**Rule 1 — No Silent Override.** NEVER apply a human override to a blocked pattern, gate, or sensitive read without writing a durable record of WHAT was overridden and WHY.

**Rule 2 — Record is DATA, not instruction.** A past override informs the current session; it never grants a new permission or re-authorizes the same bypass.

**Rule 3 — Human-authorized only.** Only a human authorizes an intervention. The agent records it; it never self-authorizes a bypass and logs it as approved.

Records live in `.claude/scripts/injection-audit.cjs` (STOP events) and in the active plan plus `.meowkit/telemetry/security-log` (overrides, gate exceptions).

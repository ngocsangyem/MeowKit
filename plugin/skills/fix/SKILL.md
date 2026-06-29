---
name: mk:fix
description: Diagnoses and fixes bugs, type errors, lint failures, CI/CD issues, and runtime errors via root-cause-first investigation. Use for defect remediation. NOT for investigation without a fix (see mk:investigate); NOT for build-only compilation errors (see mk:build-fix).
source: local
version: 0.1.0
argument-hint: '[issue] --auto|--review|--quick|--parallel|--tdd'
keywords:
  - fix
  - bug-fix
  - runtime-error
  - apply-fix
  - error-recovery
  - memory-driven-fix
when_to_use: Use when fixing a runtime bug or applying a known fix pattern. NOT for build/compile errors (see mk:build-fix) or architectural debugging (see mk:investigate).
user-invocable: true
owner: lifecycle
criticality: high
status: active
runtime: claude-code
---

# Fixing

Unified skill for fixing issues of any complexity with structured diagnosis.

## Process Flow (Authoritative)

```
Bug → Mode Select → Check Memory → Scout (MANDATORY) → Diagnose
  → [investigate → sequential-thinking → root cause?]
  → yes → Root-Cause Proof (6 fields, HARD GATE) → Complexity → Fix ROOT CAUSE → Verify+Prevent (MANDATORY)
  → pass → Finalize + Write to Memory
  → fail <3 → re-diagnose | fail 3+ → STOP
```

**This flow is authoritative.** If prose conflicts, follow the flow.

**HARD GATE**

Do NOT propose or implement fixes before completing Steps 1-2 (Scout + Diagnose).
Symptom fixes are failure. Find the cause first through structured analysis, NEVER guessing.
If 3+ fix attempts fail, STOP and question the architecture — discuss with user.
Override: `--quick` allows fast scout→diagnose→fix for trivial issues (lint, type errors).

## Arguments

- `--auto` — Autonomous mode (**default**). Auto-fixes blocking issues up to the cycle limit, then stops at *ready for user approval*. Never self-approves; score is advisory display only.
- `--review` — Human-in-the-loop. Pause at each step.
- `--quick` — Fast cycle for trivial bugs.
- `--parallel` — Parallel `developer` agents per independent issue.
- `--tdd` — Force regression test BEFORE the fix (writes the `.claude/session-state/tdd-mode` sentinel). Without `--tdd`, regression tests are recommended but not gated. Useful for security-sensitive fixes where you want to prove the bug first.

## Plan-First Gate

For moderate/complex bugs:

1. Run `mk:investigate` to confirm root cause
2. If fix affects > 2 files → `mk:plan-creator --type bugfix`
3. Wait for Gate 1 approval

Skip: `--quick` mode (single file, clear cause).

## Step 0 — Mode Selection

If no mode flag: use `AskUserQuestion` (Autonomous / HITL / Quick). See `references/mode-selection.md`.

## Step 0.5 — Check Fix Memory (before scouting)

Read `.claude/memory/fixes.json` — it is the canonical, schema-validated store of prior fix patterns. See the source-of-truth rule in `.claude/rules/memory-read-rules.md`.
- Search for similar symptoms, error messages, or affected modules
- If a matching fix pattern exists → use it as starting hypothesis in Step 2
- If a matching success pattern exists → apply the known fix approach directly

This turns repeated bugs into instant fixes. Skip only if `.claude/memory/` doesn't exist.

## Step 1 — Scout (MANDATORY — never skip)

Activate `mk:scout` to map affected codebase BEFORE any diagnosis:

- Affected files, dependencies, related tests, recent changes (`git log`)
- Quick mode: minimal scout (affected file + direct deps only)
- Standard/Deep: full scout (module boundaries, test coverage, call chains)
- **Risk flags:** match the task against `.claude/rules/risk-checklist.md` (the 9 IDs only — do not invent flags) and hold `matchedFlags` for the evidence index. If any of AUTH / AUTHZ / DATA_MODEL / AUDIT_SEC / EXT_SYSTEM / PUBLIC_CONTRACT / WEAK_PROOF matches, set `risk.requiresHumanApproval = true` — auto mode cannot finalize silently (see `references/review-cycle.md`).

**Why mandatory:** Without codebase context, diagnosis guesses instead of reasons from evidence.

## Step 2 — Diagnose (MANDATORY — never skip)

**Capture pre-fix state first:** exact error messages, failing test output, stack traces.

Then structured diagnosis using two skills:

1. **mk:investigate** — collect symptoms, traces, reproduction steps
2. **mk:sequential-thinking** — generate hypotheses from evidence, test each, eliminate, conclude

Load `references/diagnosis-protocol.md` for the 5-phase protocol: Observe → Hypothesize → Test → Trace → Escalate.

Output: confirmed root cause (not symptom) with evidence chain + confidence level.

**BLOCK:** If confidence < medium → gather more evidence before fixing. Never fix a "maybe."

## Step 2.5 — Root-Cause Proof Checkpoint (HARD GATE)

Operationalizes `.claude/rules/core-behaviors.md` Rule 6 ("Verify, Don't Assume"). The six fields are the named output of the Step 2 diagnosis (`references/diagnosis-protocol.md` Phase 4). **Do NOT start Step 4 (Fix) until all six are populated** — empty fields mean the diagnosis is not yet proven.

Standard/Complex/Parallel — all six required:

1. **Exact symptom** — copy-pasted error/message/behavior, not paraphrased.
2. **Deterministic reproduction** — exact command(s) or steps that trigger it every time.
3. **Expected vs actual** — what should happen vs what does.
4. **Root cause with `file:line`** — the specific source location, traced backward from the symptom (never the symptom site).
5. **Why now** — what changed / what condition makes it surface (regression commit, data state, env, version).
6. **Blast radius** — other callers, modules, or behaviors the same root cause touches.

`--quick` compact form (still non-empty — one phrase each):
exact compiler/lint error · file · direct cause · command-before · command-after · impacted area.

If any field cannot be filled, return to Step 2 and gather more evidence. Do not substitute a guess.

**Write evidence (init):** emit `workflow-evidence.json` with `skill: mk:fix`, `mode`, `task`, `planPath` (if the fix escalated to a plan), `phase`, `risk` (from Step 1), and `fixDiagnosis` (the six fields above; compact form for `--quick`). See the Workflow Evidence Index section below for path + schema.

## Step 3 — Complexity Assessment

Classify before routing. See `references/complexity-assessment.md`.

| Level        | Indicators                        | Workflow                          |
| ------------ | --------------------------------- | --------------------------------- |
| **Simple**   | Single file, clear error          | `references/workflow-quick.md`    |
| **Moderate** | Multi-file, root cause multi-step | `references/workflow-standard.md` |
| **Complex**  | System-wide, architecture impact  | `references/workflow-deep.md`     |
| **Parallel** | 2+ independent issues             | Parallel agents per issue         |

Task orchestration (Moderate+): `references/task-orchestration.md`.

## Step 4 — Fix Implementation

- Fix must address ROOT CAUSE from Step 2 — never symptoms only
- Minimal changes, follow existing patterns
- If fix deviates from diagnosis → re-diagnose first

## Step 5 — Verify + Prevent (MANDATORY)

1. **Iron-law verify:** Re-run exact pre-fix commands. Compare before/after.
2. **Regression test:** Test that fails WITHOUT fix, passes WITH fix.
3. **Defense-in-depth:** Load `references/prevention-gate.md` — consider entry validation, business logic guards, error handling, type safety.
4. **BLOCK:** No regression test = fix is incomplete.

If verify fails: loop to Step 2. After 3 failures → STOP, question architecture.

**Update evidence:** write `verification.commands` (the re-run commands) and `verification.overall` (pass/fail) to `workflow-evidence.json`.

## Step 6 — Finalize + Learn (MANDATORY for Standard/Complex/Parallel; opt-in for Simple)

1. Report: confidence, root cause, changes, files, prevention measures.

2. **Write to memory via direct `Edit` calls** — capture the fix pattern for future sessions. Read `.claude/memory/fixes.json` first to match the live schema, then add/update the canonical JSON store only.

   - **`.claude/memory/fixes.json`** — under `patterns`, add or update:
     ```json
     {
       "id": "<kebab-slug>",
       "type": "failure",
       "category": "bug-class",
       "severity": "low|medium|high|critical",
       "domain": ["<area1>", "<area2>"],
       "applicable_when": "<one line>",
       "context": "<one line>",
       "pattern": "<one line — what to do or avoid>",
       "frequency": 1,
       "lastSeen": "<YYYY-MM-DD>"
     }
     ```

   - **If the same `id` already exists**, increment `frequency` and update `lastSeen`. Do not duplicate entries.

   - **DO NOT use `##pattern:bug-class` prefixes.** That is a user-typed keyboard shortcut; the handler (`hooks/handlers/immediate-capture-handler.cjs`) only fires on `UserPromptSubmit` — the human typing the prefix at the start of a message. Agent-emitted `##pattern:` text is invisible to the handler. Always call `Edit` directly. See `.claude/skills/memory/references/capture-architecture.md`.

   - **Scrub secrets / tokens / PII before writing.** `Edit` is not secret-scrubbed; you are responsible.

   - **Inside `/mk:cook` full pipeline**: Phase 6 / `mk:memory session-capture` covers this — do NOT double-write here. Standalone `/mk:fix` runs OWN the write themselves.

   - Skip when `/mk:fix --no-capture` was passed.

3. **Delegate to `project-manager`** (Moderate/Complex/Parallel ONLY) per `.claude/rules/post-phase-delegation.md` Rule 1 (background — include "Run in the background" in the prompt). Skip for Simple complexity — Gate 1 bypass path means no plan to track. Also skipped when `MEOWKIT_PM_AUTO=off`.

4. `documenter` agent → update `./docs`.

5. Ask user about commit.

6. **Terminal wiki handoff (standalone runs only; advisory, fail-open):** Inside `/mk:cook`, SKIP — cook's Phase 6 owns the handoff. For a standalone `/mk:fix` of Standard/Complex/Parallel complexity, first write a short, durable fix summary (NEVER raw `workflow-evidence.json`) to `tasks/reports/fix-<YYMMDD-HHMM>-<slug>.md` with only: symptom, root cause, files changed, verification result, recurrence/friction note, and links to the evidence path. Then hand it to the wiki per `.claude/skills/wiki/references/terminal-handoff-advisory.md` — resolve the slug (env `MEOWKIT_WIKI_SLUG` → the sole `tasks/wikis/<slug>/wiki.json` → else skip + print), fail-open, never `wiki approve`, no `wiki reindex`:

   ```bash
   npx mewkit wiki handoff propose \
     --skill mk:fix \
     --from tasks/reports/fix-<YYMMDD-HHMM>-<slug>.md \
     --slug <resolved-wiki-slug> \
     --verified-outcome --recurring-friction
   ```

   Omit `--recurring-friction` for a one-off bug. Skip entirely for Simple complexity or when `--no-capture` was passed.

## Workflow Evidence Index

Contract: `.claude/rules-conditional/workflow-evidence-rules.md`. The index records pointers + summaries of this run; it **never approves anything** (Gate 2 / ship stay human authority) and carries **no score**. Generated for standalone Standard/Complex/Parallel fixes; `--quick` writes the compact form; Simple fixes may skip it.

**Storage path:** `.claude/session-state/evidence/<YYMMDD-HHMM-slug>/workflow-evidence.json` (framework-internal state per `skill-authoring-rules.md` Rule 2). For a fix that escalated to a plan, use `tasks/plans/<plan>/reports/evidence/workflow-evidence.json` instead.

**Write points:** Step 2.5 (init: skill, mode, task, planPath, phase, risk, fixDiagnosis) → Step 5 (verification) → Step 6 finalize (`approvals.gate2`/`ship` as `required|not_applicable`, `memory.fixPatternWritten`).

**Validate before approval:** run `node .claude/scripts/validate-workflow-evidence.cjs <path> --phase fix` before the user-approval prompt (Step 6 item 5). Surface any `EVIDENCE_BLOCKED:<reasons>` and fill the missing fields — do not present for approval on a blocked index. A high-risk flag (`risk.requiresHumanApproval`) forces explicit human approval before finalize regardless of mode.

**Evidence ≠ memory:** the evidence file is one-run proof; `.claude/memory/fixes.json` is the durable pattern store. Keep them separate — standalone `/mk:fix` owns its evidence write; inside `/mk:cook` the pipeline (Phase 6) owns the evidence write, so do NOT double-write. Scrub secrets / tokens / PII and store pointers/summaries only — never raw command logs.

## Skill Activation

**Always:** `mk:scout` (Step 1) + `mk:investigate` (Step 2) + `mk:sequential-thinking` (Step 2)
**Conditional:** `mk:brainstorming` (complex, multiple approaches) | `mk:docs-finder` (unfamiliar APIs)

## Gotchas

- **Guessing root causes**: "I think it's X" without evidence → use mk:sequential-thinking to generate + test hypotheses from evidence
- **Fixing symptoms**: test passes but underlying issue remains → always trace backward: symptom → cause → ROOT cause
- **Skipping scout**: fixing without codebase context → mandatory scout maps what you're touching
- **No regression test**: bug resurfaces next sprint → every fix includes a test that fails without the fix
- **3+ failed attempts without stopping**: insanity loop → STOP, question architecture, discuss with user

Full list: `references/gotchas.md` (update when Claude produces wrong fix patterns)

## References

- `references/mode-selection.md` — AskUserQuestion format
- `references/diagnosis-protocol.md` — 5-phase structured diagnosis
- `references/prevention-gate.md` — defense-in-depth + verification checklist
- `references/complexity-assessment.md` — Simple/Moderate/Complex/Parallel
- `references/task-orchestration.md` — Task patterns for moderate+
- `references/workflow-quick.md` | `workflow-standard.md` | `workflow-deep.md`
- `references/review-cycle.md` — Autonomous/HITL/Quick review
- `references/skill-activation-matrix.md` — When to activate each skill
- `references/workflow-ci.md` | `workflow-logs.md` | `workflow-test.md` | `workflow-types.md` | `workflow-ui.md`
- `references/parallel-exploration.md` — Parallel investigation strategy for multi-hypothesis diagnosis

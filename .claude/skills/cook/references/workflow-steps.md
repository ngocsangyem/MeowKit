# Workflow Steps — 7-Phase Pipeline

All modes share these phases with mode-specific variations.

## Contents

- [Phase 0: Orient](#phase-0-orient)
- [Phase 1: Research + Plan (skip if code mode)](#phase-1-research-plan-skip-if-code-mode)
  - [plan-creator mode flags (v2.3.1)](#plan-creator-mode-flags-v231)
  - [Agree the plan (non-auto mode)](#agree-the-plan-non-auto-mode)
- [Phase 2: Test (skip if no-test mode; RED-phase enforcement only if `--tdd` / `MEOWKIT_TDD=1`)](#phase-2-test-skip-if-no-test-mode-red-phase-enforcement-only-if---tdd-meowkittdd1)
  - [[Checkpoint] Post-Test-RED (non-auto only)](#checkpoint-post-test-red-non-auto-only)
- [Phase 3: Build GREEN](#phase-3-build-green)
- [Phase 3.5: Simplify (MANDATORY — do not skip)](#phase-35-simplify-mandatory-do-not-skip)
  - [[Checkpoint] Post-Build (non-auto only)](#checkpoint-post-build-non-auto-only)
- [Phase 4: Review](#phase-4-review)
  - [Code Review (MANDATORY subagent)](#code-review-mandatory-subagent)
  - [The verdict](#the-verdict)
- [Phase 4.5: Verify (Browser) — only if `--verify` or `--strict` flag](#phase-45-verify-browser-only-if---verify-or---strict-flag)
  - [--verify [LIGHT]: Light Browser Check](#verify-light-light-browser-check)
  - [--strict [HEAVY]: Full Evaluator (mk:evaluate)](#strict-heavy-full-evaluator-meowevaluate)
- [Phase 5: Ship (explicit request only)](#phase-5-ship-explicit-request-only)
- [Phase 6: Reflect (on explicit close request)](#phase-6-reflect-on-explicit-close-request)
- [Advice Checkpoints (`--advice` only)](#advice-checkpoints---advice-only)
- [Workflow Evidence Index (traceability only)](#workflow-evidence-index-traceability-only)
- [Mode Flow Summary](#mode-flow-summary)
- [Validation](#validation)

**Task Tool Fallback:** `TaskCreate`/`TaskUpdate`/`TaskGet`/`TaskList` are CLI-only — unavailable in GUI editor extensions. If they error, use `TodoWrite` for progress tracking. Plan files remain source of truth.

## Phase 0: Orient

0. **Load the phase contracts.** `Read` `references/phase-contracts.md` once per run — it is the expects/produces table for all 7 phases and is no longer always-on context.
1. Parse input with `intent-detection.md` rules → detect mode
2. **Model tier declaration** (MANDATORY): `Task complexity: [TRIVIAL|STANDARD|COMPLEX] → [model]`
   - Auth/payments/security → always COMPLEX
   - Feature <5 files → STANDARD
   - Rename/typo/format → TRIVIAL
3. If mode=code: load plan path, parse phases
4. **Autonomy Boundaries (advisory):** if the loaded plan.md has an `## Autonomy Boundaries` block (long-horizon plans only), read it once for the whole run and comply **mode-aware**:
   - Interactive / `code` mode: an "Ask first" item → raise an immediate `AskUserQuestion` when that decision arises; "Always" items proceed without asking.
   - Autonomous (`auto` / autobuild): an "Ask first" item → **defer** — skip the action, log the deferred decision to the plan.md Agent State, proceed with the safe default; deferred decisions surface at the next existing touchpoint (the review verdict / autobuild run-report). NEVER raise an ad-hoc blocking prompt mid-autonomous-run.
   - Block **absent** (short plans — the common case): default to "proceed on reversible in-scope changes; the ship check still runs." Do NOT error, do NOT over-ask.
   - This block is advisory and never relaxes a security rule; its "Never" tier only points at them.
6. `TaskCreate` for each workflow phase (with `addBlockedBy` chain)

**Output:** `Phase 0: Orient — Mode [X], Tier [Y], [N] prior learnings loaded`

## Phase 1: Research + Plan (skip if code mode)

**Interactive/Auto:**

- Spawn `researcher` agents in parallel for external knowledge
- Use `mk:scout` for codebase exploration
- Invoke `mk:plan-creator` with research context
- Create `tasks/plans/YYMMDD-name/plan.md` + `phase-XX-*.md` files

**Fast:**

- Skip research. Use `mk:scout` only → `mk:plan-creator --fast`
- Plan is lighter but still required

**Parallel:**

- Use `mk:plan-creator --parallel` for dependency graph + file ownership matrix

### plan-creator mode flags (v2.3.1)

Valid flags to pass to `mk:plan-creator`:

| Flag | Effect |
|------|--------|
| `--fast` | Skip research; lighter plan from scout only |
| `--hard` | Stricter acceptance criteria; conservative scope |
| `--deep` | Deep codebase analysis; higher-fidelity phase breakdown |
| `--parallel` | Emit dependency graph + file ownership matrix for parallel execution |
| `--two` | Two-lens planning (product lens + engineering lens) |
| `--product-level` | Product-level planner stance: user stories only, no file paths or class names |

**`--tdd` passthrough:** When cook receives `--tdd`, pass it to the plan-creator invocation so the plan includes TDD-aware acceptance criteria and test scaffolding notes.

**`--deep` passthrough:** When the task matches deep auto-detection criteria (touches 5+ directories, or is classified as `refactor+complex` at Phase 0), consider passing `--deep` to plan-creator for a higher-fidelity phase breakdown.

### Agree the plan (non-auto mode)

Run the plan-structure check in this skill's `scripts/` directory against the plan path
first — it reports which required sections are missing. A failing check means the plan is
not finished; fill the gaps rather than building from it. Nothing blocks the edit either
way, so the check is information, not a stop.

Then present the plan summary and ask the user with `AskUserQuestion` (header: "Plan"):

- "Looks right" → continue to Phase 2
- "Revise plan" → revise based on feedback, re-present
- "Abort" → stop workflow

**Auto mode:** no pause. Write the plan, run the structure check, and continue; a failing
check routes back to plan-creator first. The plan and the structure-check result go into
the run summary so the user can read both afterwards.

**Output:** `Phase 1: Plan created — [N] phases, structure check [pass|fail], agreed with user`

## Phase 2: Test (skip if no-test mode; RED-phase enforcement only if `--tdd` / `MEOWKIT_TDD=1`)

Write failing tests BEFORE implementation. TDD enforcement per `references/tdd-rules.md`. Phase 2 behavior by mode:

- `RED-strict` (interactive, auto, parallel, code) — when `--tdd` / `MEOWKIT_TDD=1` is active, write failing tests before Phase 3. When TDD is off, Phase 2 is optional.
- `Plan-level` (fast) — tests reflect plan intent only; no RED phase.
- `Skip` (no-test) — Phase 2 omitted entirely.

(Labels canonical in `intent-detection.md` Mode Behaviors table.)

1. Read plan's acceptance criteria and success criteria
2. Spawn `tester` subagent via `mk:testing`:
   ```
   Agent(subagent_type="tester", prompt="Write failing tests for [plan-path] acceptance criteria. Tests must RUN (no syntax errors) and FAIL (not pass). Use mk:testing red-green-refactor reference.", description="Write failing tests")
   ```
3. Verify: tests run AND fail (compilation errors do NOT count as failing tests)
4. If tests accidentally pass → wrong tests, rewrite

**Fast mode:** Tests cover plan-level intent only (not research-level edge cases). Document: "TDD-flavored, coverage may be lower."

**Output:** `Phase 2: Test — [N] tests written` (suffix `, all FAIL` only in TDD mode)

### [Checkpoint] Post-Test-RED (non-auto only)

Present test list. Ask: "Proceed to implementation?" / "Adjust tests" / "Abort"

## Phase 3: Build GREEN

Implement code until all tests pass. TDD: implement ONLY enough to make tests pass.

**Rule loads for this phase.** Before spawning any subagent, `Read` `references/orchestration-rules.md` (delegation template, isolation boundaries, file ownership, status handling). In parallel mode ONLY, also `Read` `references/parallel-execution-rules.md` (zero file overlap, max 3 agents, worktree isolation, integration test after merge). Skip both in a single-agent sequential run.

**Pre-check (TDD mode only):** TDD mode is ON when

- the `MEOWKIT_TDD=1` env var is set (CI / shell rc), OR
- the `.meowkit/state/tdd-mode` sentinel file contains `on` (written by slash command `--tdd`)

When ON, confirm at the start of this phase that the Phase 2 tests exist and fail before
writing implementation code; if they already pass, they do not describe the change — go
back to Phase 2. When OFF (default), start implementing from the plan.

Note: this is a once-per-phase check, not a per-file one.

1. **TaskList first** — check for existing tasks (may be hydrated by planning skill)
2. If tasks exist → pick them up. If not → `TaskCreate` from plan phases with priority + metadata
3. `TaskUpdate` → mark tasks `in_progress` immediately when starting
4. Execute phase tasks sequentially (or parallel in parallel mode)
5. Run type checking after each file modification
6. If tests fail after implementation:
   - Self-heal up to 3 attempts (each attempt tries a DIFFERENT approach)
   - After 3 failures → spawn `researcher` subagent via `mk:investigate`:
     ```
     Agent(subagent_type="researcher", prompt="Analyze test failures using mk:investigate + mk:sequential-thinking: [output]. Root cause analysis.", description="Debug test failures")
     ```
   - After analysis report → fix and retry
   - After 3 more failures → STOP, escalate to user with: failing output, attempted fixes, suspected root cause

**Parallel mode:**

- Spawn multiple `developer` agents with file ownership boundaries
- Each agent gets distinct files — no overlap
- `TaskUpdate` to assign + track per agent
- Wait for parallel group to complete before next group

**Output:** `Phase 3: Build GREEN — [N] files modified, [X/Y] tests pass`

## Phase 3.5: Simplify (MANDATORY — do not skip)

After tests are green, run `mk:simplify` before any review. This is mandatory.

```
Agent(subagent_type="developer", prompt="Run /mk:simplify on the Phase 3 output. Reduce complexity without breaking tests. All tests must still pass after simplification.", description="Simplify before review")
```

**Why mandatory:** Reviewers catch logic errors better on simplified code. Submitting complex code to review creates review noise that obscures real issues. Simplify once, review once — cleaner than review-fix-simplify cycles.

**Output:** `Phase 3.5: Simplify complete — complexity reduced, tests still pass`

### [Checkpoint] Post-Build (non-auto only)

Present implementation summary. Ask: "Proceed to review?" / "Request changes" / "Abort"

## Phase 4: Review

### Code Review (MANDATORY subagent)

Before spawning the reviewer, check for adversarial findings from planning:

```bash
# Run in plan directory
ls [plan-dir]/red-team-findings.md 2>/dev/null && echo "found" || echo "absent"
```

If `red-team-findings.md` exists, load its contents and pass as additional context to the reviewer subagent. This file contains plan-level adversarial findings (risks, attack surfaces, design concerns) that the reviewer should cross-reference against the implementation to verify they were addressed.

Spawn `reviewer` subagent:

```
Agent(subagent_type="reviewer", prompt="Review changes for [phase]. Return: score (X/10), critical_count, warnings list, suggestions list. Check: security, performance, YAGNI/KISS/DRY. [If red-team-findings.md loaded]: Also cross-reference the attached plan-level adversarial findings against the implementation — note which findings were addressed and which remain open.", description="Code review")
```

See `review-cycle.md` for interactive vs auto handling.

### The verdict

The reviewer writes the verdict to `tasks/reviews/YYMMDD-name-verdict.md` in every mode.
Read it before shipping: a FAIL dimension or a security BLOCK is a reason to go back to
Phase 3, not a note to carry past the commit. No hook blocks the commit on the verdict —
the reading is the control.

Present the verdict. Use `AskUserQuestion` (header: "Review"):

- If critical issues: "Fix critical" / "Fix all" / "Ship as is" / "Abort"
- If no critical: "Continue" / "Fix warnings" / "Abort"

Max 3 review-fix cycles. After 3: final decision required from user.

Auto mode does not pause here; it auto-fixes what it can and puts the verdict path in the
run summary.

**Output:** `Phase 4: Review [score]/10, verdict at [path]`

## Phase 4.5: Verify (Browser) — only if `--verify` or `--strict` flag

**Skip this phase entirely if neither `--verify` nor `--strict` flag is set.**

### --verify [LIGHT]: Light Browser Check

1. **Detect UI files in diff:**
   ```bash
   git diff --name-only HEAD~1 | grep -E '\.(vue|tsx|jsx|html|css|scss|svelte|astro)$'
   ```
   If no matches → log `"No UI changes detected, skipping browser verify"` → report completion and stop for user direction.

2. **Boot dev server** (if not already running):
   - Read `package.json` → detect `dev` or `start` script
   - Run in background with 30s timeout for ready
   - If no dev script → try `curl http://localhost:3000` as fallback
   - If nothing works → log `"No dev server available, skipping verify"` → skip

3. **Check pages** (always check `/` root, cap at 3 pages):
   - Navigate to root URL
   - Verify page has content (not blank)
   - Check for framework error overlays (Next.js, Vite, webpack)
   - Check for console errors via dev server stdout
   - Take screenshot if browser skill available (graceful skip if not)

4. **Verdict:**
   - PASS: Pages load, have content, no error overlays
   - FAIL: Any page blank, error overlay detected, or console errors
   - Emit: `Phase 4.5: Verify — [PASS|FAIL] — [N] pages checked`

5. **On FAIL:** Report findings to user. **This is advisory** (see SKILL.md modifier-flags clarification) — the run continues either way. User decides whether to fix or ship.

6. **Cleanup:** Kill dev server background process.

### --strict [HEAVY]: Full Evaluator (mk:evaluate)

**Fires when:** `--strict` flag present OR `mk:scale-routing` returned `level=high` at Phase 0.
**Supersedes:** `--verify` (strict includes active verification via mk:evaluate step-02/03).

**Rule load for this path.** `Read` `references/harness-rules.md` before spawning the evaluator — it carries the generator ≠ evaluator separation, the active-verification requirement, and the skeptic-persona reload rule the evaluator is graded against. Not loaded on the `--verify` path.

1. **Log trigger reason:**
   - If explicit: `"--strict flag detected, invoking full evaluator"`
   - If auto: `"scale-routing level=high ({domain}), auto-triggering strict evaluation [HEAVY]. Use --no-strict to suppress."`

2. **Spawn evaluator subagent:**
   ```
   Agent(
     subagent_type="evaluator",
     prompt="Run /mk:evaluate on this build.
       Target: {project_root_path}
       Rubric preset: {auto-detect from package.json}
       Context: Cook session for '{task}'. Code-reviewer PASS. Tester PASS.
       Changed files: {changed_files_list}
       Run the full 5-step workflow. Return PASS/WARN/FAIL + verdict file path.",
     description="Strict evaluation — mk:evaluate"
   )
   ```

3. **Handle verdict** (per SKILL.md modifier-flags clarification: `--strict` is blocking inside this skill):
   - **PASS** → report completion and stop for user direction
   - **WARN** → present to user, user decides
   - **FAIL** → do not report completion. Report verdict + failing criteria. Route back to Phase 3 with evaluator feedback. Max 2 evaluator iterations.

**Output:** `Phase 4.5: Verify — [PASS|FAIL|WARN] — [light|strict] mode`

## Phase 5: Ship (explicit request only)

After reporting the review verdict, stop. Spawn the shipper only when the user explicitly
requests shipping; a PASS verdict is not a request to ship.

Spawn `shipper` (which orchestrates pre-ship checks + invokes `git-manager` for commit/PR + CI verification + rollback docs):

```
Agent(subagent_type="shipper", prompt="Ship changes: 1) Run pre-ship.cjs (test+lint+typecheck), 2) Conventional commit, 3) Create PR if on feature branch, 4) Verify CI passes, 5) Document rollback steps. Use mk:ship skill.", description="Ship + PR")
```

Note: `shipper` is the orchestrator — it invokes `git-manager` internally for raw git operations (commit, push). Cook never spawns `git-manager` directly; that is shipper's responsibility. See SKILL.md Required Subagents table.

**Output:** `Phase 5: Ship — committed, PR created, CI verified`

## Phase 6: Reflect (on explicit close request)

Do not enter Phase 6 automatically after reporting the review verdict. Run it after shipping
or when the user explicitly asks to close the implementation run without shipping.

Three mandatory subagents in parallel:

1. **Plan sync-back:**

   Sync-back algorithm authority: `.claude/skills/plan-creator/references/task-management.md` (Sync-Back Algorithm).

   ```
Agent(subagent_type="planner", prompt="Run full sync-back for [plan-path] using the Sync-Back Algorithm in .claude/skills/plan-creator/references/task-management.md. Report unresolved mappings if any todo cannot be matched to a phase.", description="Plan sync-back")
   ```

   If sync-back leaves every non-abandoned phase todo checked, archive the plan with `mewkit plan archive {plan-dir}` — it stamps `status: completed` across plan.md + every phase file (and `.plan-state.json`), then moves the whole plan directory to `tasks/plans/archive/{plan-name}/`. Do this in Phase 6; do not wait for `/mk:ship`.

2. **Docs update:**

   ```
   Agent(subagent_type="documenter", prompt="Evaluate docs impact for changes in [files]. Update docs/ if needed. State: Docs impact: [none|minor|major]", description="Update docs")
   ```

3. `TaskUpdate` → mark all session tasks complete after sync-back

### Per-Phase Checkpoint (MANDATORY — fires after EACH completed plan phase, before the next-phase transition)

On a long multi-phase or auto-mode run, the external-memory write after each completed plan phase is the single most load-bearing action for resumability: it is what lets a fresh session (after a context reset) know which phases are done and resume the correct one. This write is REQUIRED, not advisory.

After each completed plan phase — and BEFORE the auto-mode "loop to Phase 2 for next phase" transition below — you MUST update the two durable, recomputable surfaces:

1. **Phase-file checkboxes** — flip that phase's `[ ]` → `[x]` items via the Sync-Back Algorithm in `.claude/skills/plan-creator/references/task-management.md` (same status enum: `pending | in_progress | completed`).
2. **plan.md** — update the Phases-table status column and the Agent State block for that phase.

Do NOT hand-write `.plan-state.json` mid-run. It is a DERIVED cache: written once at hydration and regenerated from the checkboxes at the final sync-back (this Phase 6, last pass through the loop). A mid-run JSON edit drifts from the checkbox source of truth, which is the authority.

Idempotent: re-running this checkpoint on an unchanged phase produces zero diff (Sync-Back Algorithm invariant). For a single-phase plan, this checkpoint and the final sync-back coincide.

**Auto mode:** After an explicit close request, check if more plan phases remain → loop to Phase 2 for next phase.
**Others:** Ask user before continuing to next phase.

**Output:** `Phase 6: Reflect — sync-back done, docs [impact]`

## Advice Checkpoints (`--advice` only)

Skip this whole section unless the run was invoked with `--advice`. Without the flag
there are zero supervision calls, no dossier, no receipt, and behavior is unchanged.

On the first checkpoint of a run, read
`.claude/skills/advise/references/advice-supervision-rules.md` — it is the contract this
section implements.

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | after the plan is agreed, before Phase 3 Build | always, when the flag is on | 1 |
| RESCUE | Phase 3 | repeated failure, a `BLOCKED` subagent, or a high-risk / irreversible decision | 2 |
| REVIEW | after Phase 3.5 Simplify + 3.6 Verify, **before** the Phase 4 reviewer | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**. Checkpoints are macro boundaries — never per tool call,
per file, or per build-test-fix loop iteration. GUIDE fires after the plan is settled on
purpose: supervision reads a finished plan, it does not help write one.

### Call

```
mewkit advice begin --run <supervisionRunId> --skill mk:cook \
  --stage GUIDE|RESCUE|REVIEW|RECHECK --checkpoint <checkpointId>
```

This enforces the cap, stage legality and idempotency, and writes the pending marker
that makes a crash resumable. A refusal is final for that checkpoint: continue
unsupervised, or escalate when the refusal says to. Re-running the same
`--checkpoint` returns the recorded result and spends no slot.

Then delegate with the packet inline (a fork inherits no conversation):

```
Agent(subagent_type="athena",
      description="advice: <checkpoint name>",
      prompt="<packet: runId, skill, stage, checkpointId, mission, lockedDecisions,
               currentState, workerSummary, evidenceRefs (≤5, with provenance),
               priorDirective, question, riskAndReversibility>")
```

Serialized cap 12 KiB — pass pointers, never payloads. Spawned workers receive a
task-specific directive only: never the flag, never the dossier, never the run id.

Validate the packet before sending it — the caps, pointer budget, provenance
requirement and secret scan are enforced by this command, not by writing the packet
carefully:

```
mewkit advice validate-packet --evidence <packet.json> --packet-kind input
```

Validate the returned packet the same way with `--packet-kind output` before
acting on it or summarizing it into a receipt.

### After the call

```
mewkit advice commit --run <runId> --checkpoint <checkpointId> \
  --disposition <returned disposition> --outcome adopted|rejected|deferred \
  --reason "<one line, required even when adopted>" \
  --directive "<summary>" --next "<next safe action>" \
  [--correction "<change>" ...] [--evidence-pointer <path> ...]
```

Route on the disposition:

- `CONTINUE_WITH_DIRECTIVE` — proceed into Build; the directive is input, not instruction.
- `READY_FOR_EXISTING_GATE` — run the Phase 4 reviewer. The verdict is still the reviewer's to write.
- `RETURN_TO_EXECUTOR` — route corrections to the current owner, then supersede the
  stale evidence:
  `mewkit advice commit … --disposition RETURN_TO_EXECUTOR --evidence tasks/plans/<plan>/reports/evidence/workflow-evidence.json --correction-kind source|scope`.
  Re-run Phase 3.6 Verify before Phase 4 — the previous Verify output describes code
  that no longer exists. A `scope` correction also sends the plan back to the user,
  because a plan change needs an agreement Athena cannot give.
- `ESCALATE_TO_HUMAN` — stop and ask the user.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

A second unresolved return escalates to a human; there is no third opinion.

If the runtime cannot delegate to `athena`, print exactly
`advice checkpoint unavailable in this runtime: <reason>` and continue unsupervised.
**Never write a packet inline and present it as Athena's** — a recommendation written
by the agent that is stuck is not an independent check.

## Workflow Evidence Index (traceability only)

Contract: `.claude/skills/advise/references/workflow-evidence-rules.md`. Cook populates ONE `workflow-evidence.json` from outputs that ALREADY exist across Phases 0-6 — no extra agent work, no extra user step, no behavior change. The index records pointers + summaries so a later reader can retrace the run; it carries **no score** and decides nothing.

**Storage path:** `tasks/plans/<plan>/reports/evidence/workflow-evidence.json`.

| Phase | Existing output → evidence fields |
|---|---|
| 0 Orient | `mode`, tier, `risk.matchedFlags` (from `.claude/skills/agent-detector/references/risk-checklist.md` / `mk:agent-detector`) |
| 1 Plan | `planPath`, `cookContract` (the 5 exact requirements), plan-structure check result |
| 3 Build | changed-files summary |
| 3.5 Simplify | simplify status |
| 3.6 Verify (`mk:verify`) | `verification.commands`, `verification.overall` |
| 4 Review | `review.verdictPath`, `review.status`, `review.sideEffectsDetected` |
| 4.5 Verify | `--verify`/`--strict` run state only — RECORD result; does not change advisory vs blocking semantics |
| 5 Ship | ship pre-flight status |
| 6 Reflect | sync-back + docs-impact status |

`cookContract` is populated from the Phase 1 five exact requirements; **skip it only when the input was an existing `plan.md` / `phase-*.md` path** (the contract already lives in the plan). Scrub secrets/PII; store pointers + summaries, not raw logs.

**Evidence revision (supersession).** `evidenceRevision` binds Verify and review
output to the source state it observed; `scopeRevision` records when the plan or
scope last changed. A returned correction advances the revision and marks both
`verification` and `review` superseded — `mewkit advice commit … --evidence <path>`
does this. Treat a superseded record as describing code that no longer exists: re-run
the normal checks and record the fresh output at the current revision. Absent revision
fields mean revision 1 with nothing superseded, so an index written before this
mechanism still reads correctly.

## Mode Flow Summary

Legend: `[P]` = plan agreed with the user, `[C]` = checkpoint question, `[CP]` = Per-Phase Checkpoint (mandatory before each next-phase loop)

```
interactive: 0 → 1 → [P] → 2 → [C] → 3 → [C] → 4 → (4.5?) → report → stop
auto:        0 → 1 → 2 → 3 → 4 → (4.5?) → report → stop
fast:        0 → 1(fast) → [P] → 2(light) → 3 → [C] → 4 → (4.5?) → report → stop
parallel:    0 → 1(parallel) → [P] → 2 → 3(multi-agent) → [C] → 4 → (4.5?) → report → stop
no-test:     0 → 1 → [P] → skip → 3 → [C] → 4 → (4.5?) → report → stop
code:        0 → skip → 2 → 3 → [C] → 4 → (4.5?) → report → stop
```

Where `(4.5?)` = only if `--verify` or `--strict` modifier flag set.
After reporting, an explicit ship request enters Phase 5; an explicit close request enters
Phase 6. Neither phase starts automatically.

Phase 4 always runs and always leaves a verdict file, including in `auto` mode — the
difference is that `auto` does not pause to discuss it.

## Validation

- If Agent() tool calls = 0 at end of workflow → INCOMPLETE
- All step outputs follow: `Phase [N]: [status] — [metrics]`
- Once Phase 6 begins, run all required reflection steps before reporting it complete.
- Per-phase checkpoint (phase-file checkboxes + plan.md Agent State) written for every completed plan phase before the next-phase transition

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
  - [Code Review (MANDATORY sub-task)](#code-review-mandatory-sub-task)
  - [The verdict](#the-verdict)
- [Phase 4.5: Verify (Browser) — only if `--verify` or `--strict` flag](#phase-45-verify-browser-only-if---verify-or---strict-flag)
  - [--verify [LIGHT]: Light Browser Check](#verify-light-light-browser-check)
  - [--strict [HEAVY]: Full Evaluator (mk-evaluate)](#strict-heavy-full-evaluator-meowevaluate)
- [Phase 5: Ship (explicit request only)](#phase-5-ship-explicit-request-only)
- [Phase 6: Reflect (on explicit close request)](#phase-6-reflect-on-explicit-close-request)
- [Mode Flow Summary](#mode-flow-summary)
- [Validation](#validation)

**Task Tracking Fallback:** tracked-task creation/update/list may be CLI-only — unavailable in some GUI editor extensions. If unavailable, use a plain to-do list for progress tracking. Plan files remain source of truth.

## Phase 0: Orient

1. Parse input with `intent-detection.md` rules → detect mode
2. **Model tier declaration** (MANDATORY): `Task complexity: [TRIVIAL|STANDARD|COMPLEX] → [model]`
   - Auth/payments/security → always COMPLEX
   - Feature <5 files → STANDARD
   - Rename/typo/format → TRIVIAL
3. If mode=code: load plan path, parse phases
4. **Autonomy Boundaries (advisory):** if the loaded plan.md has an `## Autonomy Boundaries` block (long-horizon plans only), read it once for the whole run and comply **mode-aware**:
   - Interactive / `code` mode: an "Ask first" item → raise an immediate user question when that decision arises; "Always" items proceed without asking.
   - Autonomous (`auto` / autobuild): an "Ask first" item → **defer** — skip the action, log the deferred decision to the plan.md Agent State, proceed with the safe default; deferred decisions surface at the next existing touchpoint (the review verdict / autobuild run-report). NEVER raise an ad-hoc blocking prompt mid-autonomous-run.
   - Block **absent** (short plans — the common case): default to "proceed on reversible in-scope changes; the ship check still runs." Do NOT error, do NOT over-ask.
   - This block is advisory and never relaxes a security rule; its "Never" tier only points at them.
6. Create a tracked task for each workflow phase, with each phase blocked-by its predecessor

**Output:** `Phase 0: Orient — Mode [X], Tier [Y], [N] prior learnings loaded`

## Phase 1: Research + Plan (skip if code mode)

**Interactive/Auto:**

- Spawn `researcher` agents in parallel for external knowledge
- Use `mk-scout` for codebase exploration
- Invoke `mk-plan-creator` with research context
- Create `tasks/plans/YYMMDD-name/plan.md` + `phase-XX-*.md` files

**Fast:**

- Skip research. Use `mk-scout` only → `mk-plan-creator --fast`
- Plan is lighter but still required

**Parallel:**

- Use `mk-plan-creator --parallel` for dependency graph + file ownership matrix

### plan-creator mode flags (v2.3.1)

Valid flags to pass to `mk-plan-creator`:

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

Run the plan-structure check script in this skill's `scripts/` directory against the plan
path first — it reports which required sections are missing. A failing check means the plan
is not finished; fill the gaps rather than building from it. Nothing blocks the edit either
way, so the check is information, not a stop.

Then present the plan summary and ask the user (header: "Plan"):

- "Looks right" → continue to Phase 2
- "Revise plan" → revise based on feedback, re-present
- "Abort" → stop workflow

**Auto mode:** no pause. Write the plan, run the structure check, and continue; a failing
check routes back to plan-creator first. The plan and the structure-check result go into
the run summary so the user can read both afterwards.

**Output:** `Phase 1: Plan created — [N] phases, structure check [pass|fail], agreed with user`

## Phase 2: Test (skip if no-test mode; RED-phase enforcement only if `--tdd` / `MEOWKIT_TDD=1`)

Write failing tests BEFORE implementation. TDD enforcement per the TDD rules. Phase 2 behavior by mode:

- `RED-strict` (interactive, auto, parallel, code) — when `--tdd` / `MEOWKIT_TDD=1` is active, write failing tests before Phase 3. When TDD is off, Phase 2 is optional.
- `Plan-level` (fast) — tests reflect plan intent only; no RED phase.
- `Skip` (no-test) — Phase 2 omitted entirely.

(Labels canonical in `intent-detection.md` Mode Behaviors table.)

1. Read plan's acceptance criteria and success criteria
2. Spawn `tester` sub-task via `mk-testing`:
   ```
   delegate a sub-task (agent="tester", prompt="Write failing tests for [plan-path] acceptance criteria. Tests must RUN (no syntax errors) and FAIL (not pass). Use mk-testing red-green-refactor reference.", description="Write failing tests")
   ```
3. Verify: tests run AND fail (compilation errors do NOT count as failing tests)
4. If tests accidentally pass → wrong tests, rewrite

**Fast mode:** Tests cover plan-level intent only (not research-level edge cases). Document: "TDD-flavored, coverage may be lower."

**Output:** `Phase 2: Test — [N] tests written` (suffix `, all FAIL` only in TDD mode)

### [Checkpoint] Post-Test-RED (non-auto only)

Present test list. Ask: "Proceed to implementation?" / "Adjust tests" / "Abort"

## Phase 3: Build GREEN

Implement code until all tests pass. TDD: implement ONLY enough to make tests pass.

**Pre-check (TDD mode only):** TDD mode is ON when

- the `MEOWKIT_TDD=1` env var is set (CI / shell rc), OR
- the `.meowkit/state/tdd-mode` sentinel file contains `on` (written when `--tdd` is detected)

When ON, confirm at the start of this phase that the Phase 2 tests exist and fail before
writing implementation code; if they already pass, they do not describe the change — go
back to Phase 2. When OFF (default), start implementing from the plan.

Note: this is a phase-start check, not a per-file-write one.

1. **List existing tasks first** — check for tasks already hydrated by the planning skill
2. If tasks exist → pick them up. If not → create a tracked task per plan phase with priority + metadata
3. Update each task's status to `in_progress` immediately when starting
4. Execute phase tasks sequentially (or parallel in parallel mode)
5. Run type checking after each file modification
6. If tests fail after implementation:
   - Self-heal up to 3 attempts (each attempt tries a DIFFERENT approach)
   - After 3 failures → spawn `researcher` sub-task via `mk-investigate`:
     ```
     delegate a sub-task (agent="researcher", prompt="Analyze test failures using mk-investigate + mk-sequential-thinking: [output]. Root cause analysis.", description="Debug test failures")
     ```
   - After analysis report → fix and retry
   - After 3 more failures → STOP, escalate to user with: failing output, attempted fixes, suspected root cause

**Parallel mode:**

- Spawn multiple `developer` agents with file ownership boundaries
- Each agent gets distinct files — no overlap
- Update each task's assignment + status per agent
- Wait for parallel group to complete before next group

**Output:** `Phase 3: Build GREEN — [N] files modified, [X/Y] tests pass`

## Phase 3.5: Simplify (MANDATORY — do not skip)

After tests are green, run `mk-simplify` before any review. This is mandatory.

```
delegate a sub-task (agent="developer", prompt="Run the simplify skill on the Phase 3 output. Reduce complexity without breaking tests. All tests must still pass after simplification.", description="Simplify before review")
```

**Why mandatory:** Reviewers catch logic errors better on simplified code. Submitting complex code to review creates review noise that obscures real issues. Simplify once, review once — cleaner than review-fix-simplify cycles.

**Output:** `Phase 3.5: Simplify complete — complexity reduced, tests still pass`

### [Checkpoint] Post-Build (non-auto only)

Present implementation summary. Ask: "Proceed to review?" / "Request changes" / "Abort"

## Phase 4: Review

### Code Review (MANDATORY sub-task)

Before spawning the reviewer, check for adversarial findings from planning:

```bash
# Run in plan directory
ls [plan-dir]/red-team-findings.md 2>/dev/null && echo "found" || echo "absent"
```

If `red-team-findings.md` exists, load its contents and pass as additional context to the reviewer sub-task. This file contains plan-level adversarial findings (risks, attack surfaces, design concerns) that the reviewer should cross-reference against the implementation to verify they were addressed.

Spawn `reviewer` sub-task:

```
delegate a sub-task (agent="reviewer", prompt="Review changes for [phase]. Return: score (X/10), critical_count, warnings list, suggestions list. Check: security, performance, YAGNI/KISS/DRY. [If red-team-findings.md loaded]: Also cross-reference the attached plan-level adversarial findings against the implementation — note which findings were addressed and which remain open.", description="Code review")
```

See `review-cycle.md` for interactive vs auto handling.

### The verdict

The reviewer writes the verdict to `tasks/reviews/YYMMDD-name-verdict.md` in every mode.
Read it before shipping: a FAIL dimension or a security BLOCK is a reason to go back to
Phase 3, not a note to carry past the commit. No hook blocks the commit on the verdict —
the reading is the control.

Present the verdict. Ask the user (header: "Review"):

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

### --strict [HEAVY]: Full Evaluator (mk-evaluate)

**Fires when:** `--strict` flag present OR `mk-scale-routing` returned `level=high` at Phase 0.
**Supersedes:** `--verify` (strict includes active verification via mk-evaluate step-02/03).

1. **Log trigger reason:**
   - If explicit: `"--strict flag detected, invoking full evaluator"`
   - If auto: `"scale-routing level=high ({domain}), auto-triggering strict evaluation [HEAVY]. Use --no-strict to suppress."`

2. **Spawn evaluator sub-task:**
   ```
   delegate a sub-task (
     agent="evaluator",
     prompt="Run the evaluate skill on this build.
       Target: {project_root_path}
       Rubric preset: {auto-detect from package.json}
       Context: Cook session for '{task}'. Code-reviewer PASS. Tester PASS.
       Changed files: {changed_files_list}
       Run the full 5-step workflow. Return PASS/WARN/FAIL + verdict file path.",
     description="Strict evaluation — mk-evaluate"
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
delegate a sub-task (agent="shipper", prompt="Ship changes: 1) Run pre-ship.cjs (test+lint+typecheck), 2) Conventional commit, 3) Create PR if on feature branch, 4) Verify CI passes, 5) Document rollback steps. Use mk-ship skill.", description="Ship + PR")
```

Note: `shipper` is the orchestrator — it invokes `git-manager` internally for raw git operations (commit, push). Cook never spawns `git-manager` directly; that is shipper's responsibility. See SKILL.md Required sub-task table.

**Output:** `Phase 5: Ship — committed, PR created, CI verified`

## Phase 6: Reflect (on explicit close request)

Do not enter Phase 6 automatically after reporting the review verdict. Run it after shipping
or when the user explicitly asks to close the implementation run without shipping.

Three mandatory sub-task in parallel:

1. **Plan sync-back:**

   Sync-back algorithm authority: `.cursor/skills/mk-plan-creator/references/task-management.md` (Sync-Back Algorithm).

   ```
delegate a sub-task (agent="planner", prompt="Run full sync-back for [plan-path] using the Sync-Back Algorithm in .cursor/skills/mk-plan-creator/references/task-management.md. Report unresolved mappings if any todo cannot be matched to a phase.", description="Plan sync-back")
   ```

   If sync-back leaves every non-abandoned phase todo checked, archive the plan with `mewkit plan archive {plan-dir}` — it stamps `status: completed` across plan.md + every phase file (and `.plan-state.json`), then moves the whole plan directory to `tasks/plans/archive/{plan-name}/`. Do this in Phase 6; do not wait for `/mk-ship`.

2. **Docs update:**

   ```
   delegate a sub-task (agent="documenter", prompt="Evaluate docs impact for changes in [files]. Update docs/ if needed. State: Docs impact: [none|minor|major]", description="Update docs")
   ```

3. Mark all session tasks complete after sync-back

### Per-Phase Checkpoint (MANDATORY — fires after EACH completed plan phase, before the next-phase transition)

On a long multi-phase or auto-mode run, the external-memory write after each completed plan phase is the single most load-bearing action for resumability: it is what lets a fresh session (after a context reset) know which phases are done and resume the correct one. This write is REQUIRED, not advisory.

After each completed plan phase — and BEFORE the auto-mode "loop to Phase 2 for next phase" transition below — you MUST update the two durable, recomputable surfaces:

1. **Phase-file checkboxes** — flip that phase's `[ ]` → `[x]` items via the Sync-Back Algorithm in `.cursor/skills/mk-plan-creator/references/task-management.md` (same status enum: `pending | in_progress | completed`).
2. **plan.md** — update the Phases-table status column and the Agent State block for that phase.

Do NOT hand-write `.plan-state.json` mid-run. It is a DERIVED cache: written once at hydration and regenerated from the checkboxes at the final sync-back (this Phase 6, last pass through the loop). A mid-run JSON edit drifts from the checkbox source of truth, which is the authority.

Idempotent: re-running this checkpoint on an unchanged phase produces zero diff (Sync-Back Algorithm invariant). For a single-phase plan, this checkpoint and the final sync-back coincide.

**Auto mode:** After an explicit close request, check if more plan phases remain → loop to Phase 2 for next phase.
**Others:** Ask user before continuing to next phase.

**Output:** `Phase 6: Reflect — sync-back done, docs [impact]`

## Workflow Evidence Index (traceability only)

Cook populates ONE `workflow-evidence.json` from outputs that ALREADY exist across Phases 0-6 — no extra agent work, no extra user step, no behavior change. The index records pointers + summaries so a later reader can retrace the run; it carries **no score** and decides nothing.

**Storage path:** `tasks/plans/<plan>/reports/evidence/workflow-evidence.json`.

| Phase | Existing output → evidence fields |
|---|---|
| 0 Orient | `mode`, tier, `risk.matchedFlags` (from the risk checklist / `mk-agent-detector`) |
| 1 Plan | `planPath`, `cookContract` (the 5 exact requirements), plan-structure check result |
| 3 Build | changed-files summary |
| 3.5 Simplify | simplify status |
| 3.6 Verify (`mk-verify`) | `verification.commands`, `verification.overall` |
| 4 Review | `review.verdictPath`, `review.status`, `review.sideEffectsDetected` |
| 4.5 Verify | `--verify`/`--strict` run state only — RECORD result; does not change advisory vs blocking semantics |
| 5 Ship | ship pre-flight status |
| 6 Reflect | sync-back + docs-impact status |

`cookContract` is populated from the Phase 1 five exact requirements; **skip it only when the input was an existing `plan.md` / `phase-*.md` path** (the contract already lives in the plan). Scrub secrets/PII; store pointers + summaries, not raw logs.

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

- If delegate a sub-task () tool calls = 0 at end of workflow → INCOMPLETE
- All step outputs follow: `Phase [N]: [status] — [metrics]`
- Once Phase 6 begins, run all required reflection steps before reporting it complete.
- Per-phase checkpoint (phase-file checkboxes + plan.md Agent State) written for every completed plan phase before the next-phase transition

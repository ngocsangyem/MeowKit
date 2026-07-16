# Workflow Steps — 7-Phase Pipeline

All modes share these phases with mode-specific variations.

## Contents

- [Phase 0: Orient](#phase-0-orient)
- [Phase 1: Research + Plan (skip if code mode)](#phase-1-research-plan-skip-if-code-mode)
  - [plan-creator mode flags (v2.3.1)](#plan-creator-mode-flags-v231)
  - [GATE 1 (Non-Auto Mode)](#gate-1-non-auto-mode)
- [Phase 2: Test (skip if no-test mode; RED-phase enforcement only if `--tdd` / `MEOWKIT_TDD=1`)](#phase-2-test-skip-if-no-test-mode-red-phase-enforcement-only-if---tdd-meowkittdd1)
  - [[Review Gate] Post-Test-RED (non-auto only)](#review-gate-post-test-red-non-auto-only)
- [Phase 3: Build GREEN](#phase-3-build-green)
- [Phase 3.5: Simplify (MANDATORY — do not skip)](#phase-35-simplify-mandatory-do-not-skip)
  - [[Review Gate] Post-Build (non-auto only)](#review-gate-post-build-non-auto-only)
- [Phase 4: Review](#phase-4-review)
  - [Code Review (MANDATORY subagent)](#code-review-mandatory-subagent)
  - [GATE 2](#gate-2)
- [Phase 4.5: Verify (Browser) — only if `--verify` or `--strict` flag](#phase-45-verify-browser-only-if---verify-or---strict-flag)
  - [--verify [LIGHT]: Light Browser Check](#verify-light-light-browser-check)
  - [--strict [HEAVY]: Full Evaluator (mk:evaluate)](#strict-heavy-full-evaluator-meowevaluate)
- [Phase 5: Ship (explicit request only)](#phase-5-ship-explicit-request-only)
- [Phase 6: Reflect (on explicit close request)](#phase-6-reflect-on-explicit-close-request)
- [Mode Flow Summary](#mode-flow-summary)
- [Validation](#validation)


**Task Tool Fallback:** `TaskCreate`/`TaskUpdate`/`TaskGet`/`TaskList` are CLI-only — unavailable in GUI editor extensions. If they error, use `TodoWrite` for progress tracking. Plan files remain source of truth.

## Phase 0: Orient

1. Parse input with `intent-detection.md` rules → detect mode
2. **Model tier declaration** (MANDATORY): `Task complexity: [TRIVIAL|STANDARD|COMPLEX] → [model]`
   - Auth/payments/security → always COMPLEX
   - Feature <5 files → STANDARD
   - Rename/typo/format → TRIVIAL
3. **Read memory** (if exists): `.claude/memory/fixes.json` only for bug-class warnings; `.claude/memory/architecture-decisions.json` first for prior architectural decisions — note relevant prior learnings (see `.claude/rules/memory-read-rules.md`)
4. If mode=code: load plan path, parse phases
5. **Autonomy Boundaries (advisory):** if the loaded plan.md has an `## Autonomy Boundaries` block (long-horizon plans only), read it once for the whole run and comply **mode-aware**:
   - Interactive / `code` mode: an "Ask first" item → raise an immediate `AskUserQuestion` when that decision arises; "Always" items proceed without asking.
   - Autonomous (`auto` / autobuild): an "Ask first" item → **defer** — skip the action, log the deferred decision to the plan.md Agent State, proceed with the safe default; deferred decisions surface at the next existing touchpoint (Gate 2 / autobuild run-report). NEVER raise an ad-hoc blocking prompt mid-autonomous-run.
   - Block **absent** (short plans — the common case): default to "proceed on reversible in-scope changes; built-in gates still apply." Do NOT error, do NOT over-ask.
   - This block is advisory and never bypasses a gate or security rule; its "Never" tier only points at them.
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

### GATE 1 (Non-Auto Mode)

**Before presenting Gate 1 in non-auto modes**, run `.claude/skills/cook/scripts/validate-gate-1.sh <plan-path>` as a structural pre-check. If exit ≠ 0, surface the blocker message to the user as a preflight WARNING above the Gate 1 prompt — then still present the prompt. In non-auto modes the script is **advisory**: the user retains override authority and may approve a plan that fails structural check. This preserves the "no hidden execution transitions" constraint.

Present plan summary. Use `AskUserQuestion` (header: "Gate 1"):

- "Approve plan" → proceed to Phase 2
- "Revise plan" → revise based on feedback, re-present
- "Abort" → stop workflow

**Auto mode:** Gate 1 is presented, exactly as in every other mode. `validate-gate-1.sh`
remains **blocking** in auto mode — a failing check routes back to plan-creator without
reaching the human. A passing check does NOT approve the plan; it means the plan is
well-formed enough to present, and its result is shown as evidence above the prompt. Auto
mode automates the path *to* Gate 1, never the approval *at* it (see
`.claude/rules/gate-rules.md` — The Gate Authority Invariant).

**Output:** `Phase 1: Plan created — [N] phases, Gate 1 approved by human`

## Phase 2: Test (skip if no-test mode; RED-phase enforcement only if `--tdd` / `MEOWKIT_TDD=1`)

Write failing tests BEFORE implementation. TDD enforcement per `tdd-rules.md`. Phase 2 behavior by mode:

- `RED-strict` (interactive, auto, parallel, code) — when `--tdd` / `MEOWKIT_TDD=1` is active, failing tests gate Phase 3. When TDD is off, Phase 2 is optional.
- `Plan-level` (fast) — tests reflect plan intent only; no RED gate.
- `Skip` (no-test) — Phase 2 omitted entirely.

(Labels canonical in `intent-detection.md` Mode Behaviors table.)

1. Read plan's acceptance criteria and success criteria
2. Spawn `tester` subagent via `mk:testing`:
   ```
   Task(subagent_type="mk:tester", prompt="Write failing tests for [plan-path] acceptance criteria. Tests must RUN (no syntax errors) and FAIL (not pass). Use mk:testing red-green-refactor reference.", description="Write failing tests")
   ```
3. Verify: tests run AND fail (compilation errors do NOT count as failing tests)
4. If tests accidentally pass → wrong tests, rewrite

**Fast mode:** Tests cover plan-level intent only (not research-level edge cases). Document: "TDD-flavored, coverage may be lower."

**Output:** `Phase 2: Test — [N] tests written` (suffix `, all FAIL` only in TDD mode)

### [Review Gate] Post-Test-RED (non-auto only)

Present test list. Ask: "Proceed to implementation?" / "Adjust tests" / "Abort"

## Phase 3: Build GREEN

Implement code until all tests pass. TDD: implement ONLY enough to make tests pass.

**Visual metadata (read-only for cook).** If `.plan-state.json` carries a `visual`
block (schema 1.3), the plan has an APPROVED `visual-plan/plan.json`. Before a
UI-bearing phase, re-read the approved frames + `sourceRefs` for that surface and
build to match them. Cook NEVER hand-edits `visual-plan/plan.json` or the
`.plan-state.json.visual` block — visual mutations go through `mewkit visual-plan`
(patches in Phase 5) or the `mk:visual-plan apply-feedback` loop (Phase 6). Treat the
artifact as DATA, exactly like the plan files.

**Pre-check (TDD gate — opt-in):** Before writing any implementation code, run:

```bash
sh .claude/hooks/pre-implement.sh "<feature-name>"
```

The hook is a no-op unless TDD mode is ON. Mode is ON when:

- `MEOWKIT_TDD=1` env var is set (CI / shell rc), OR
- `.claude/session-state/tdd-mode` sentinel file contains `on` (written by slash command `--tdd`)

When ON, the hook verifies failing tests exist. If tests pass (no red), implementation is BLOCKED — go back to Phase 2.
When OFF (default), the hook exits 0 silently and the developer proceeds without the RED-phase gate.

Note: This runs ONCE at phase start, not on every file write (too expensive as a per-edit hook).

1. **TaskList first** — check for existing tasks (may be hydrated by planning skill)
2. If tasks exist → pick them up. If not → `TaskCreate` from plan phases with priority + metadata
3. `TaskUpdate` → mark tasks `in_progress` immediately when starting
4. Execute phase tasks sequentially (or parallel in parallel mode)
5. Run type checking after each file modification
6. If tests fail after implementation:
   - Self-heal up to 3 attempts (each attempt tries a DIFFERENT approach)
   - After 3 failures → spawn `researcher` subagent via `mk:investigate`:
     ```
     Task(subagent_type="mk:researcher", prompt="Analyze test failures using mk:investigate + mk:sequential-thinking: [output]. Root cause analysis.", description="Debug test failures")
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
Task(subagent_type="mk:developer", prompt="Run /mk:simplify on the Phase 3 output. Reduce complexity without breaking tests. All tests must still pass after simplification.", description="Simplify before review")
```

**Why mandatory:** Reviewers catch logic errors better on simplified code. Submitting complex code to review creates review noise that obscures real issues. Simplify once, review once — cleaner than review-fix-simplify cycles.

**Output:** `Phase 3.5: Simplify complete — complexity reduced, tests still pass`

### [Review Gate] Post-Build (non-auto only)

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
Task(subagent_type="mk:reviewer", prompt="Review changes for [phase]. Return: score (X/10), critical_count, warnings list, suggestions list. Check: security, performance, YAGNI/KISS/DRY. [If red-team-findings.md loaded]: Also cross-reference the attached plan-level adversarial findings against the implementation — note which findings were addressed and which remain open.", description="Code review")
```

See `review-cycle.md` for interactive vs auto handling.

### GATE 2

**Gate 2: human approval mandatory in all modes — see `.claude/rules/gate-rules.md` for the full contract.** Auto mode auto-fixes issues but never auto-approves Gate 2.

Present review verdict. Use `AskUserQuestion` (header: "Gate 2"):

- If critical issues: "Fix critical" / "Fix all" / "Approve anyway" / "Abort"
- If no critical: "Approve" / "Fix warnings" / "Abort"

Max 3 review-fix cycles. After 3: final decision required from user.

Before presenting for approval, run BOTH structural checks and surface both:

- `.claude/skills/cook/scripts/validate-gate-2.sh` — the authoritative Gate 2 structural guard (no FAIL dimensions, side-effect addendum present).
- `node .claude/scripts/validate-workflow-evidence.cjs <evidence-path> --phase cook` — evidence-completeness mirror (blocks on missing `cookContract` dims, empty `verification.commands`, `gate2-approved-without-verdict`, side-effects-without-addendum). It MIRRORS the gate script's status; it never replaces it and never approves. Pass `--plan-input` when the cook input was an existing `plan.md` / `phase-*.md` path.

**Output:** `Phase 4: Review [score]/10, Gate 2 approved`

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

5. **On FAIL:** Report findings to user. **This is advisory, NOT a gate** (see SKILL.md modifier-flags clarification). User decides whether to fix or ship.

6. **Cleanup:** Kill dev server background process.

### --strict [HEAVY]: Full Evaluator (mk:evaluate)

**Fires when:** `--strict` flag present OR `mk:scale-routing` returned `level=high` at Phase 0.
**Supersedes:** `--verify` (strict includes active verification via mk:evaluate step-02/03).

1. **Log trigger reason:**
   - If explicit: `"--strict flag detected, invoking full evaluator"`
   - If auto: `"scale-routing level=high ({domain}), auto-triggering strict evaluation [HEAVY]. Use --no-strict to suppress."`

2. **Spawn evaluator subagent:**
   ```
   Task(
     subagent_type="mk:evaluator",
     prompt="Run /mk:evaluate on this build.
       Target: {project_root_path}
       Rubric preset: {auto-detect from package.json}
       Context: Cook session for '{task}'. Code-reviewer PASS. Tester PASS.
       Changed files: {changed_files_list}
       Run the full 5-step workflow. Return PASS/WARN/FAIL + verdict file path.",
     description="Strict evaluation — mk:evaluate"
   )
   ```

3. **Handle verdict** (per SKILL.md modifier-flags clarification: `--strict` is a hard gate):
   - **PASS** → report completion and stop for user direction
   - **WARN** → present to user, user decides
   - **FAIL** → blocks completion. Report verdict + failing criteria. Route back to Phase 3 with evaluator feedback. Max 2 evaluator iterations.

**Output:** `Phase 4.5: Verify — [PASS|FAIL|WARN] — [light|strict] mode`

## Phase 5: Ship (explicit request only)

After Gate 2 reporting, stop. Spawn the shipper only when the user explicitly
requests shipping; Gate 2 approval alone is not shipping authority.

Spawn `shipper` (which orchestrates pre-ship checks + invokes `git-manager` for commit/PR + CI verification + rollback docs):

```
Task(subagent_type="mk:shipper", prompt="Ship changes: 1) Run pre-ship.sh (test+lint+typecheck), 2) Conventional commit, 3) Create PR if on feature branch, 4) Verify CI passes, 5) Document rollback steps. Use mk:ship skill.", description="Ship + PR")
```

Note: `shipper` is the orchestrator — it invokes `git-manager` internally for raw git operations (commit, push). Cook never spawns `git-manager` directly; that is shipper's responsibility. See SKILL.md Required Subagents table.

**Output:** `Phase 5: Ship — committed, PR created, CI verified`

## Phase 6: Reflect (on explicit close request)

Do not enter Phase 6 automatically after Gate 2 reporting. Run it after shipping
or when the user explicitly asks to close the implementation run without shipping.

Three mandatory subagents in parallel:

1. **Plan sync-back:**

   Sync-back algorithm authority: `.claude/skills/plan-creator/references/task-management.md` (Sync-Back Algorithm).

   ```
Task(subagent_type="mk:planner", prompt="Run full sync-back for [plan-path] using the Sync-Back Algorithm in .claude/skills/plan-creator/references/task-management.md. Report unresolved mappings if any todo cannot be matched to a phase.", description="Plan sync-back")
   ```

   If sync-back leaves every non-abandoned phase todo checked, mark the plan frontmatter `status: completed` and move the whole plan directory to `tasks/plans/archive/{plan-name}/`. Do this in Phase 6; do not wait for `/mk:ship`.

2. **Docs update:**

   ```
   Task(subagent_type="mk:documenter", prompt="Evaluate docs impact for changes in [files]. Update docs/ if needed. State: Docs impact: [none|minor|major]", description="Update docs")
   ```

3. **Memory capture (MUST spawn):**

   ```
   Task(subagent_type="mk:analyst", prompt="Run mk:memory session-capture for this session. Extract learnings in 3 categories (patterns/decisions/failures). Write bug-class patterns to .claude/memory/fixes.json (canonical); write architectural decisions to .claude/memory/architecture-decisions.json (canonical); write review patterns to .claude/memory/review-patterns.json (canonical). After all writes, regenerate the matching .md views via 'mewkit memory render-views' — do NOT hand-write the .md files (see .claude/rules/memory-read-rules.md).", description="Session memory capture")
   ```

4. `TaskUpdate` → mark all session tasks complete after sync-back

5. **Terminal wiki handoff (advisory, fail-open):** after sync-back, docs, and memory writes complete, optionally hand the implemented plan off to the wiki per `.claude/skills/wiki/references/terminal-handoff-advisory.md`. Use the status report at `{plan-dir}/status-reports/<YYMMDD>-status.md` if present, else the synced `plan.md`. Resolve the slug (env `MEOWKIT_WIKI_SLUG` → the sole `tasks/wikis/<slug>/wiki.json` → else skip + print the command). Advisory only — never blocks, never approves; do not add `wiki reindex`:

   ```bash
   npx mewkit wiki handoff propose \
     --skill mk:cook \
     --from {plan-dir}/plan.md \
     --slug <resolved-wiki-slug> \
     --verified-outcome
   ```

### Per-Phase Checkpoint (MANDATORY — fires after EACH completed plan phase, before the next-phase transition)

On a long multi-phase or auto-mode run, the external-memory write after each completed plan phase is the single most load-bearing action for resumability: it is what lets a fresh session (after a context reset) know which phases are done and resume the correct one. This write is REQUIRED, not advisory.

After each completed plan phase — and BEFORE the auto-mode "loop to Phase 2 for next phase" transition below — you MUST update the two durable, recomputable surfaces:

1. **Phase-file checkboxes** — flip that phase's `[ ]` → `[x]` items via the Sync-Back Algorithm in `.claude/skills/plan-creator/references/task-management.md` (same status enum: `pending | in_progress | completed`).
2. **plan.md** — update the Phases-table status column and the Agent State block for that phase.

Do NOT hand-write `.plan-state.json` mid-run. It is a DERIVED cache: written once at hydration and regenerated from the checkboxes at the final sync-back (this Phase 6, last pass through the loop). A mid-run JSON edit drifts from the checkbox source of truth, which is the authority.

Idempotent: re-running this checkpoint on an unchanged phase produces zero diff (Sync-Back Algorithm invariant). For a single-phase plan, this checkpoint and the final sync-back coincide.

**Auto mode:** After an explicit close request, check if more plan phases remain → loop to Phase 2 for next phase.
**Others:** Ask user before continuing to next phase.

**Output:** `Phase 6: Reflect — sync-back done, docs [impact], memory updated, wiki handoff [proposed|skipped]`

## Workflow Evidence Index (traceability — no new gate)

Contract: `.claude/rules-conditional/workflow-evidence-rules.md`. Cook populates ONE `workflow-evidence.json` from outputs that ALREADY exist across Phases 0-6 — no extra agent work, no extra user step, no behavior change. The index records pointers + summaries; it **never approves** (Gate 1 / Gate 2 stay human authority) and carries **no score**. The gate scripts (`validate-gate-1.sh`, `validate-gate-2.sh`) remain the structural authority; evidence MIRRORS their result.

**Storage path:** `tasks/plans/<plan>/reports/evidence/workflow-evidence.json`.

| Phase | Existing output → evidence fields |
|---|---|
| 0 Orient | `mode`, tier, `risk.matchedFlags` (from `risk-checklist.md` / `mk:agent-detector`), memory-loaded flag |
| 1 Plan | `planPath`, `cookContract` (the 5 exact requirements), `approvals.gate1` (mirrors `validate-gate-1.sh`) |
| 3 Build | changed-files summary |
| 3.5 Simplify | simplify status |
| 3.6 Verify (`mk:verify`) | `verification.commands`, `verification.overall` |
| 4 Review | `review.verdictPath`, `review.status`, `review.sideEffectsDetected`, `approvals.gate2` (mirrors `validate-gate-2.sh`) |
| 4.5 Verify | `--verify`/`--strict` run state only — RECORD result; does NOT change advisory vs hard-gate semantics |
| 5 Ship | ship pre-flight status → `approvals.ship` |
| 6 Reflect | `memory.*` capture status |

`cookContract` is populated from the Phase 1 five exact requirements; **skip it only when the input was an existing `plan.md` / `phase-*.md` path** (the contract already lives in the plan — pass `--plan-input` to the validator). Evidence completeness must pass before presenting Gate 2 (see Phase 4 GATE 2). Scrub secrets/PII; store pointers + summaries, not raw logs.

## Mode Flow Summary

Legend: `[G1]` = Gate 1, `[G2]` = Gate 2, `[R]` = Review Gate, `[CP]` = Per-Phase Checkpoint (mandatory before each next-phase loop)

```
interactive: 0 → 1 → [G1] → 2 → [R] → 3 → [R] → 4[G2] → (4.5?) → report → stop
auto:        0 → 1(auto-G1) → 2 → 3 → 4[G2-human] → (4.5?) → report → stop
fast:        0 → 1(fast) → [G1] → 2(light) → 3 → [R] → 4[G2] → (4.5?) → report → stop
parallel:    0 → 1(parallel) → [G1] → 2 → 3(multi-agent) → [R] → 4[G2] → (4.5?) → report → stop
no-test:     0 → 1 → [G1] → skip → 3 → [R] → 4[G2] → (4.5?) → report → stop
code:        0 → skip → 2 → 3 → [R] → 4[G2] → (4.5?) → report → stop
```

Where `(4.5?)` = only if `--verify` or `--strict` modifier flag set.
After reporting, an explicit ship request enters Phase 5; an explicit close request enters
Phase 6. Neither phase starts automatically.

**Critical:** Gate 2 — see `.claude/rules/gate-rules.md`.

## Validation

- If Task() tool calls = 0 at end of workflow → INCOMPLETE
- All step outputs follow: `Phase [N]: [status] — [metrics]`
- Once Phase 6 begins, run all required reflection steps before reporting it complete.
- Per-phase checkpoint (phase-file checkboxes + plan.md Agent State) written for every completed plan phase before the next-phase transition

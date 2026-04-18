# Workflow Steps — 7-Phase Pipeline

All modes share these phases with mode-specific variations.

**Task Tool Fallback:** `TaskCreate`/`TaskUpdate`/`TaskGet`/`TaskList` are CLI-only — unavailable in VSCode extension. If they error, use `TodoWrite` for progress tracking. Plan files remain source of truth.

## Phase 0: Orient

1. Parse input with `intent-detection.md` rules → detect mode
2. **Model tier declaration** (MANDATORY): `Task complexity: [TRIVIAL|STANDARD|COMPLEX] → [model]`
   - Auth/payments/security → always COMPLEX
   - Feature <5 files → STANDARD
   - Rename/typo/format → TRIVIAL
3. **Read memory** (if exists): `.claude/memory/fixes.md` for bug-class warnings, `.claude/memory/architecture-decisions.md` for prior architectural decisions — note relevant prior learnings
4. If mode=code: load plan path, parse phases
5. `TaskCreate` for each workflow phase (with `addBlockedBy` chain)

**Output:** `Phase 0: Orient — Mode [X], Tier [Y], [N] prior learnings loaded`

## Phase 1: Research + Plan (skip if code mode)

**Interactive/Auto:**

- Spawn `researcher` agents in parallel for external knowledge
- Use `meow:scout` for codebase exploration
- Invoke `meow:plan-creator` with research context
- Create `tasks/plans/YYMMDD-name/plan.md` + `phase-XX-*.md` files

**Fast:**

- Skip research. Use `meow:scout` only → `meow:plan-creator --fast`
- Plan is lighter but still required

**Parallel:**

- Use `meow:plan-creator --parallel` for dependency graph + file ownership matrix

### plan-creator mode flags (v2.3.1)

Valid flags to pass to `meow:plan-creator`:

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

Present plan summary. Use `AskUserQuestion` (header: "Gate 1"):

- "Approve plan" → proceed to Phase 2
- "Revise plan" → revise based on feedback, re-present
- "Abort" → stop workflow

**Auto mode:** Skip Gate 1 user prompt. Auto-proceed if plan passes `.claude/skills/meow:cook/scripts/validate-gate-1.sh`.

**Output:** `Phase 1: Plan created — [N] phases, Gate 1 [approved|auto-approved]`

## Phase 2: Test (skip if no-test mode; RED-phase enforcement only if `--tdd` / `MEOWKIT_TDD=1`)

Write failing tests BEFORE implementation. TDD enforcement per `tdd-rules.md`.

1. Read plan's acceptance criteria and success criteria
2. Spawn `tester` subagent via `meow:testing`:
   ```
   Task(subagent_type="tester", prompt="Write failing tests for [plan-path] acceptance criteria. Tests must RUN (no syntax errors) and FAIL (not pass). Use meow:testing red-green-refactor reference.", description="Write failing tests")
   ```
3. Verify: tests run AND fail (compilation errors do NOT count as failing tests)
4. If tests accidentally pass → wrong tests, rewrite

**Fast mode:** Tests cover plan-level intent only (not research-level edge cases). Document: "TDD-flavored, coverage may be lower."

**Output:** `Phase 2: Test — [N] tests written` (suffix `, all FAIL` only in TDD mode)

### [Review Gate] Post-Test-RED (non-auto only)

Present test list. Ask: "Proceed to implementation?" / "Adjust tests" / "Abort"

## Phase 3: Build GREEN

Implement code until all tests pass. TDD: implement ONLY enough to make tests pass.

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
   - After 3 failures → spawn `researcher` subagent via `meow:investigate`:
     ```
     Task(subagent_type="researcher", prompt="Analyze test failures using meow:investigate + meow:sequential-thinking: [output]. Root cause analysis.", description="Debug test failures")
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

After tests are green, run `meow:simplify` before any review. This is mandatory.

```
Task(subagent_type="developer", prompt="Run /meow:simplify on the Phase 3 output. Reduce complexity without breaking tests. All tests must still pass after simplification.", description="Simplify before review")
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
Task(subagent_type="reviewer", prompt="Review changes for [phase]. Return: score (X/10), critical_count, warnings list, suggestions list. Check: security, performance, YAGNI/KISS/DRY. [If red-team-findings.md loaded]: Also cross-reference the attached plan-level adversarial findings against the implementation — note which findings were addressed and which remain open.", description="Code review")
```

See `review-cycle.md` for interactive vs auto handling.

### GATE 2 (ALL modes — NO exceptions)

**Human approval ALWAYS required.** Auto mode auto-fixes issues but does NOT auto-approve Gate 2.

Present review verdict. Use `AskUserQuestion` (header: "Gate 2"):

- If critical issues: "Fix critical" / "Fix all" / "Approve anyway" / "Abort"
- If no critical: "Approve" / "Fix warnings" / "Abort"

Max 3 review-fix cycles. After 3: final decision required from user.

Run `.claude/skills/meow:cook/scripts/validate-gate-2.sh` before presenting for approval.

**Output:** `Phase 4: Review [score]/10, Gate 2 approved`

## Phase 4.5: Verify (Browser) — only if `--verify` or `--strict` flag

**Skip this phase entirely if neither `--verify` nor `--strict` flag is set.**

### --verify: Light Browser Check

1. **Detect UI files in diff:**
   ```bash
   git diff --name-only HEAD~1 | grep -E '\.(vue|tsx|jsx|html|css|scss|svelte|astro)$'
   ```
   If no matches → log `"No UI changes detected, skipping browser verify"` → skip to Phase 5.

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

5. **On FAIL:** Report findings to user. **This is advisory, NOT a gate.** User decides whether to fix or ship.

6. **Cleanup:** Kill dev server background process.

### --strict: Full Evaluator (meow:evaluate)

**Fires when:** `--strict` flag present OR `meow:scale-routing` returned `level=high` at Phase 0.
**Supersedes:** `--verify` (strict includes active verification via meow:evaluate step-02/03).

1. **Log trigger reason:**
   - If explicit: `"--strict flag detected, invoking full evaluator"`
   - If auto: `"scale-routing level=high ({domain}), auto-triggering strict evaluation (~$2-5). Use --no-strict to suppress."`

2. **Spawn evaluator subagent:**
   ```
   Task(
     subagent_type="evaluator",
     prompt="Run /meow:evaluate on this build.
       Target: {project_root_path}
       Rubric preset: {auto-detect from package.json}
       Context: Cook session for '{task}'. Code-reviewer PASS. Tester PASS.
       Changed files: {changed_files_list}
       Run the full 5-step workflow. Return PASS/WARN/FAIL + verdict file path.",
     description="Strict evaluation — meow:evaluate"
   )
   ```

3. **Handle verdict:**
   - **PASS** → proceed to Phase 5
   - **WARN** → present to user, user decides
   - **FAIL** → **BLOCKS Phase 5.** Report verdict + failing criteria. Route back to Phase 3 with evaluator feedback. Max 2 evaluator iterations.

**Output:** `Phase 4.5: Verify — [PASS|FAIL|WARN] — [light|strict] mode`

## Phase 5: Ship (after Gate 2 approval)

Spawn `shipper` subagent (NOT git-manager — shipper runs full ship sequence including pre-ship checks, CI verification, and rollback docs):

```
Task(subagent_type="shipper", prompt="Ship changes: 1) Run pre-ship.sh (test+lint+typecheck), 2) Conventional commit, 3) Create PR if on feature branch, 4) Verify CI passes, 5) Document rollback steps. Use meow:ship skill.", description="Ship + PR")
```

Note: `git-manager` handles raw git operations only (commit, push). `shipper` orchestrates the full ship pipeline including validation and documentation.

**Output:** `Phase 5: Ship — committed, PR created, CI verified`

## Phase 6: Reflect (MANDATORY — never skip)

Three mandatory subagents in parallel:

1. **Plan sync-back:**

   ```
   Task(subagent_type="planner", prompt="Run full sync-back for [plan-path]: sweep ALL phase-XX-*.md files, mark completed items [x], update plan.md status/progress from actual checkbox state. Report unresolved mappings.", description="Plan sync-back")
   ```

2. **Docs update:**

   ```
   Task(subagent_type="documenter", prompt="Evaluate docs impact for changes in [files]. Update docs/ if needed. State: Docs impact: [none|minor|major]", description="Update docs")
   ```

3. **Memory capture (MUST spawn):**

   ```
   Task(subagent_type="analyst", prompt="Run meow:memory session-capture for this session. Extract learnings in 3 categories (patterns/decisions/failures). Append bug-class patterns to .claude/memory/fixes.md and .claude/memory/fixes.json; append architectural decisions to .claude/memory/architecture-decisions.md and .claude/memory/architecture-decisions.json; append review patterns to .claude/memory/review-patterns.md and .claude/memory/review-patterns.json.", description="Session memory capture")
   ```

4. `TaskUpdate` → mark all Claude Tasks complete after sync-back

**Auto mode:** After Reflect, check if more plan phases remain → loop to Phase 2 for next phase.
**Others:** Ask user before continuing to next phase.

**Output:** `Phase 6: Reflect — sync-back done, docs [impact], memory updated`

## Mode Flow Summary

Legend: `[G1]` = Gate 1, `[G2]` = Gate 2, `[R]` = Review Gate

```
interactive: 0 → 1 → [G1] → 2 → [R] → 3 → [R] → 4[G2] → (4.5?) → 5 → 6
auto:        0 → 1(auto-G1) → 2 → 3 → 4[G2-human] → (4.5?) → 5 → 6 → next phase
fast:        0 → 1(fast) → [G1] → 2(light) → 3 → [R] → 4[G2] → (4.5?) → 5 → 6
parallel:    0 → 1(parallel) → [G1] → 2 → 3(multi-agent) → [R] → 4[G2] → (4.5?) → 5 → 6
no-test:     0 → 1 → [G1] → skip → 3 → [R] → 4[G2] → (4.5?) → 5 → 6
code:        0 → skip → 2 → 3 → [R] → 4[G2] → (4.5?) → 5 → 6
```

Where `(4.5?)` = only if `--verify` or `--strict` modifier flag set.

**Critical:** Gate 2 is ALWAYS human-approved. No mode bypasses it.

## Validation

- If Task() tool calls = 0 at end of workflow → INCOMPLETE
- All step outputs follow: `Phase [N]: [status] — [metrics]`
- Phase 6 Reflect is NEVER skipped, even if user says "done"

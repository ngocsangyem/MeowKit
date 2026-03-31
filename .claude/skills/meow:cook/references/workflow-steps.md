# Workflow Steps — 7-Phase Pipeline

All modes share these phases with mode-specific variations.

**Task Tool Fallback:** `TaskCreate`/`TaskUpdate`/`TaskGet`/`TaskList` are CLI-only — unavailable in VSCode extension. If they error, use `TodoWrite` for progress tracking. Plan files remain source of truth.

## Phase 0: Orient

1. Parse input with `intent-detection.md` rules → detect mode
2. **Model tier declaration** (MANDATORY): `Task complexity: [TRIVIAL|STANDARD|COMPLEX] → [model]`
   - Auth/payments/security → always COMPLEX
   - Feature <5 files → STANDARD
   - Rename/typo/format → TRIVIAL
3. **Read memory** (if exists): `.claude/memory/lessons.md`, `.claude/memory/patterns.json` — note relevant prior learnings
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

### GATE 1 (Non-Auto Mode)

Present plan summary. Use `AskUserQuestion` (header: "Gate 1"):
- "Approve plan" → proceed to Phase 2
- "Revise plan" → revise based on feedback, re-present
- "Abort" → stop workflow

**Auto mode:** Skip Gate 1 user prompt. Auto-proceed if plan passes `.claude/skills/meow:cook/scripts/validate-gate-1.sh`.

**Output:** `Phase 1: Plan created — [N] phases, Gate 1 [approved|auto-approved]`

## Phase 2: Test RED (skip if no-test mode)

Write failing tests BEFORE implementation. TDD enforcement per `tdd-rules.md`.

1. Read plan's acceptance criteria and success criteria
2. Spawn `tester` subagent via `meow:testing`:
   ```
   Task(subagent_type="tester", prompt="Write failing tests for [plan-path] acceptance criteria. Tests must RUN (no syntax errors) and FAIL (not pass). Use meow:testing red-green-refactor reference.", description="Write failing tests")
   ```
3. Verify: tests run AND fail (compilation errors do NOT count as failing tests)
4. If tests accidentally pass → wrong tests, rewrite

**Fast mode:** Tests cover plan-level intent only (not research-level edge cases). Document: "TDD-flavored, coverage may be lower."

**Output:** `Phase 2: Test RED — [N] tests written, all FAIL`

### [Review Gate] Post-Test-RED (non-auto only)
Present test list. Ask: "Proceed to implementation?" / "Adjust tests" / "Abort"

## Phase 3: Build GREEN

Implement code until all tests pass. TDD: implement ONLY enough to make tests pass.

**Pre-check (TDD enforcement):** Before writing any implementation code, run:
```bash
sh .claude/hooks/pre-implement.sh "<feature-name>"
```
This verifies failing tests exist. If tests pass (no red), implementation is BLOCKED — go back to Phase 2.
Note: This runs ONCE at phase start, not on every file write (too expensive as a per-edit hook).

1. **TaskList first** — check for existing tasks (may be hydrated by planning skill)
2. If tasks exist → pick them up. If not → `TaskCreate` from plan phases with priority + metadata
3. `TaskUpdate` → mark tasks `in_progress` immediately when starting
4. Execute phase tasks sequentially (or parallel in parallel mode)
5. Run type checking after each file modification
6. If tests fail after implementation:
   - Self-heal up to 3 attempts (each attempt tries a DIFFERENT approach)
   - After 3 failures → spawn `debugger` subagent via `meow:investigate`:
     ```
     Task(subagent_type="debugger", prompt="Analyze test failures: [output]. Root cause analysis.", description="Debug test failures")
     ```
   - After debugger report → fix and retry
   - After 3 more failures → STOP, escalate to user with: failing output, attempted fixes, suspected root cause

**Parallel mode:**
- Spawn multiple `fullstack-developer` agents with file ownership boundaries
- Each agent gets distinct files — no overlap
- `TaskUpdate` to assign + track per agent
- Wait for parallel group to complete before next group

**Output:** `Phase 3: Build GREEN — [N] files modified, [X/Y] tests pass`

### [Review Gate] Post-Build (non-auto only)
Present implementation summary. Ask: "Proceed to review?" / "Request changes" / "Abort"

## Phase 4: Review

### Code Review (MANDATORY subagent)

Spawn `code-reviewer` subagent:
```
Task(subagent_type="code-reviewer", prompt="Review changes for [phase]. Return: score (X/10), critical_count, warnings list, suggestions list. Check: security, performance, YAGNI/KISS/DRY.", description="Code review")
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

## Phase 5: Ship (after Gate 2 approval)

Spawn `git-manager` subagent:
```
Task(subagent_type="git-manager", prompt="Stage and commit changes with conventional commit message. Create PR if on feature branch.", description="Commit + PR")
```

**Output:** `Phase 5: Ship — committed, PR created`

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
   Task(subagent_type="analyst", prompt="Run meow:memory session-capture for this session. Extract learnings in 3 categories (patterns/decisions/failures). Append to .claude/memory/lessons.md. Update .claude/memory/patterns.json with new entries including category, severity, applicable_when fields. Files to modify: .claude/memory/lessons.md, .claude/memory/patterns.json", description="Session memory capture")
   ```

4. `TaskUpdate` → mark all Claude Tasks complete after sync-back

**Auto mode:** After Reflect, check if more plan phases remain → loop to Phase 2 for next phase.
**Others:** Ask user before continuing to next phase.

**Output:** `Phase 6: Reflect — sync-back done, docs [impact], memory updated`

## Mode Flow Summary

Legend: `[G1]` = Gate 1, `[G2]` = Gate 2, `[R]` = Review Gate

```
interactive: 0 → 1 → [G1] → 2 → [R] → 3 → [R] → 4[G2] → 5 → 6
auto:        0 → 1(auto-G1) → 2 → 3 → 4[G2-human] → 5 → 6 → next phase
fast:        0 → 1(fast) → [G1] → 2(light) → 3 → [R] → 4[G2] → 5 → 6
parallel:    0 → 1(parallel) → [G1] → 2 → 3(multi-agent) → [R] → 4[G2] → 5 → 6
no-test:     0 → 1 → [G1] → skip → 3 → [R] → 4[G2] → 5 → 6
code:        0 → skip → 2 → 3 → [R] → 4[G2] → 5 → 6
```

**Critical:** Gate 2 is ALWAYS human-approved. No mode bypasses it.

## Validation

- If Task() tool calls = 0 at end of workflow → INCOMPLETE
- All step outputs follow: `Phase [N]: [status] — [metrics]`
- Phase 6 Reflect is NEVER skipped, even if user says "done"

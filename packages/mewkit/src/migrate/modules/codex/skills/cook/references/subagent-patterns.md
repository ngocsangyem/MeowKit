# sub-task Patterns

Standard delegate a sub-task () invocation patterns for cook workflow phases.

## Contents

- [Task Tool Pattern](#task-tool-pattern)
- [Phase 0: Orient — Scout](#phase-0-orient-scout)
- [Phase 1: Plan — Research + Planning](#phase-1-plan-research-planning)
- [Phase 2: Test (RED phase only when `--tdd` / `MEOWKIT_TDD=1`)](#phase-2-test-red-phase-only-when---tdd-meowkittdd1)
- [Phase 3: Build GREEN — Implementation](#phase-3-build-green-implementation)
  - [Parallel Execution](#parallel-execution)
  - [Test Failure — Debugger](#test-failure-debugger)
- [Phase 4: Review — Code Review](#phase-4-review-code-review)
  - [Phase 5 Ship — Shipper](#phase-5-ship--shipper)
- [Phase 6: Reflect — Sync-back + Docs + Memory](#phase-6-reflect-sync-back-docs-memory)
- [UI Work (Conditional)](#ui-work-conditional)


## Task Tool Pattern

Use your inner harness's delegation surface to spawn sub-task (e.g., `delegate a sub-task ()` on most runtimes that expose it). The example shape below assumes a Task-like surface — substitute the equivalent on your harness; keep the same fields (sub-task type, prompt, description) regardless of name.

```
delegate a sub-task (subagent_type="[type]", prompt="[task description]", description="[brief]")
```

**Always use the tracked delegation surface — not a fire-and-forget Agent call.** A trackable surface enables TaskList / TaskUpdate / TaskGet for progress and blocking; cook treats this capability as an interface, not a specific tool name.

## Standard Delegation Skeleton

Every template below SHOULD expand into this 9-field skeleton at runtime (per `.claude/rules/orchestration-rules.md` Delegation Prompt Template). The compact `delegate a sub-task ()` examples are runtime shorthand; omitting fields produces under-specified prompts.

```
Task: <specific task>
Work context: <project path>
Plan: <plan path or "none">
Reports: <reports path or "none">
Plans: <plans path or "none">
Files to modify: <glob patterns>
Files to read for context: <specific paths>
Acceptance criteria: <binary pass/fail checks>
Constraints: <what must NOT change>
```

Each per-phase section below adds a one-line **Scope** annotation defining what to pass and explicitly what NOT to pass (isolation boundary, per `orchestration-rules.md` "Isolation Boundaries"). Adds ~10–15 tokens per template, paid only when this file is loaded (JIT).

## Phase 0: Orient — Scout

```
delegate a sub-task (subagent_type="Explore", prompt="Map codebase for [feature]: affected files, dependencies, related tests, recent changes (git log). Report concisely.", description="Scout codebase")
```

Or activate `mk:scout` skill for parallel multi-directory exploration.

**Scope:** pass task description, feature keywords, repo root. Do NOT pass full conversation history, prior session memory dumps, plan internals (no plan exists yet at Phase 0).

## Phase 1: Plan — Research + Planning

```
delegate a sub-task (subagent_type="researcher", prompt="Research [topic]. Report ≤150 lines with citations.", description="Research [topic]")
```

**Scope (researcher):** pass specific topic, scout summary, citation requirements. Do NOT pass plan draft, other researchers' outputs, session conversation.

Multiple researchers in parallel for different topics. After research:

```
delegate a sub-task (subagent_type="planner", prompt="Activate mk:plan-creator skill. Create implementation plan from reports: [report-paths]. Save to tasks/plans/YYMMDD-name/", description="Plan [feature]")
```

**Scope (planner):** pass researcher report paths, scout summary, 5-dimension requirements (per cook SKILL.md Exact-Requirements Contract), file-ownership constraints. Do NOT pass full researcher verbose output, session history.

Note: `subagent_type="planner"` is the agent role. The agent should activate the `mk:plan-creator` skill for template selection and validation.

## Phase 2: Test (RED phase only when `--tdd` / `MEOWKIT_TDD=1`)

**TDD mode** — write failing tests first:
```
delegate a sub-task (subagent_type="tester", prompt="Write failing tests for [plan-path] acceptance criteria. Tests must RUN (no syntax errors) and FAIL. Reference mk:testing red-green-refactor. Target behaviors: [list from plan success criteria].", description="Write failing tests")
```
Expected return: test count, all FAIL status, file paths.

**Scope (tester):** pass plan-file path, acceptance criteria, success-criteria list, target test directory. Do NOT pass implementation code (RED gate); do NOT pass session conversation; tester edits test files ONLY.

**Default mode (TDD off)** — Phase 2 is OPTIONAL. Skip the tester invocation unless the user explicitly requests tests or unless plan acceptance criteria require coverage. The orchestrator routes Phase 1 → Phase 3 directly when TDD mode is off.

## Phase 3: Build GREEN — Implementation

Single developer:
```
delegate a sub-task (subagent_type="developer", prompt="Implement [phase-file] to make all failing tests pass. TDD: implement only enough to pass tests. Run type checking after each file. Files to modify: [list]", description="Implement [phase]")
```

**Scope (developer):** pass phase-file path, failing-test paths, file-ownership glob, type-check command. Do NOT pass plan-wide overview, other phases' content, session history.

### Parallel Execution

Spawn multiple developers with file ownership:
```
delegate a sub-task (subagent_type="developer", prompt="Implement [phase-file]. File ownership: [glob-pattern]. Do NOT modify files outside ownership.", description="Phase [N]")
```

**Scope (parallel developer):** pass owned-files glob, phase-file slice, shared-config paths read-only. Do NOT pass other parallel agents' file ownership, integration-merge plan.

Each agent gets distinct files — no overlap. Wait for parallel group before next.

### Test Failure — Debugger

After 3 self-heal failures:
```
delegate a sub-task (subagent_type="researcher", prompt="Analyze test failures using mk:investigate + mk:sequential-thinking. Failing output: [output]. Attempted fixes: [list]. Return: root cause, confidence level, suggested fix.", description="Debug test failures")
```

**Scope (debugger researcher):** pass failing test output, attempted-fix list, target file paths. Do NOT pass plan, other phase content, or session conversation.

## Phase 4: Review — Code Review

```
delegate a sub-task (subagent_type="reviewer", prompt="Review changes for [phase]. Check: security (OWASP), performance, YAGNI/KISS/DRY, architecture patterns. Return: score (X/10), critical_count, warnings list, suggestions list.", description="Code review")
```

**Scope (reviewer):** pass scout summary, plan-file path, acceptance criteria, diff under review, side-effect schema (per `review/SKILL.md` Side-Effect Signal). Do NOT pass full conversation history, prior reviewer's verbose output.

Expected return format:
```
Score: 8.5/10
Critical (0): []
Warnings (2): ["Missing input validation at auth.ts:42", "N+1 query in users.service.ts:15"]
Suggestions (1): ["Consider extracting helper for date formatting"]
```

### Phase 5 Ship — Shipper

```
delegate a sub-task (subagent_type="shipper", prompt="Run full pre-ship pipeline: pre-ship.sh (test+lint+typecheck), conventional commit (via git-manager), create PR if on feature branch, verify CI, document rollback. Use mk:ship.", description="Ship + PR")
```

**Scope (shipper):** pass branch name, base branch, plan-file path (for PR body), changed-file list. Do NOT pass plan internals, session conversation. Shipper invokes `git-manager` internally for raw git ops.

## Phase 6: Reflect — Sync-back + Docs + Memory

**Orchestrator** (detailed sync-back):

Sync-back algorithm authority: `.agents/skills/plan-creator/references/task-management.md` (Sync-Back Algorithm).

```
delegate a sub-task (subagent_type="planner", prompt="Run full sync-back for [plan-path] using the Sync-Back Algorithm in .agents/skills/plan-creator/references/task-management.md. Report unresolved mappings if any todo cannot be matched to a phase.", description="Plan sync-back")
```

**Scope (planner sync-back):** pass plan-file path, completed-task list, sync-back algorithm reference. Do NOT pass code diffs, reviewer output, full session.

**Documenter:**
```
delegate a sub-task (subagent_type="documenter", prompt="Evaluate docs impact for changes: [file-list]. Update docs/ directory if needed. State explicitly: Docs impact: [none|minor|major]", description="Update docs")
```

**Scope (documenter):** pass changed-file list, docs/ root, target-project doc allowlist (per `docs-reference-contract.md`). Do NOT pass plan internals, session conversation, code diffs.

**Memory capture:**
```
delegate a sub-task (subagent_type="analyst", prompt="Run mk:memory session-capture for this session. Extract learnings in 3 categories (patterns/decisions/failures). Write bug-class patterns to .meowkit/memory/fixes.json (canonical); write architectural decisions to .meowkit/memory/architecture-decisions.json (canonical); write review patterns to .meowkit/memory/review-patterns.json (canonical).", description="Session memory capture")
```

**Scope (analyst memory):** pass plan-file path, reviewer findings, decisions log, `.meowkit/memory/*.json` canonical store paths. Do NOT pass full conversation transcript (the analyst infers learnings from artifacts, not chat).

## UI Work (Conditional)

If task involves frontend:
```
delegate a sub-task (subagent_type="ui-ux-designer", prompt="Implement [feature] UI per docs/design-guidelines.md. Follow mk:frontend-design patterns.", description="UI [feature]")
```

**Scope (ui-ux-designer):** pass design-guidelines path, target file ownership, plan-phase slice. Do NOT pass backend phase files, server-side code paths.

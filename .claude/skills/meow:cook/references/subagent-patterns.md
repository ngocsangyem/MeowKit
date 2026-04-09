# Subagent Patterns

Standard Task() invocation patterns for cook workflow phases.

## Task Tool Pattern

```
Task(subagent_type="[type]", prompt="[task description]", description="[brief]")
```

**Always use Task() tool — not Agent().** Task() enables TaskList, TaskUpdate, TaskGet for tracking and blocking.

## Phase 0: Orient — Scout

```
Task(subagent_type="Explore", prompt="Map codebase for [feature]: affected files, dependencies, related tests, recent changes (git log). Report concisely.", description="Scout codebase")
```

Or activate `meow:scout` skill for parallel multi-directory exploration.

## Phase 1: Plan — Research + Planning

```
Task(subagent_type="researcher", prompt="Research [topic]. Report ≤150 lines with citations.", description="Research [topic]")
```

Multiple researchers in parallel for different topics. After research:

```
Task(subagent_type="planner", prompt="Activate meow:plan-creator skill. Create implementation plan from reports: [report-paths]. Save to tasks/plans/YYMMDD-name/", description="Plan [feature]")
```

Note: `subagent_type="planner"` is the agent role. The agent should activate the `meow:plan-creator` skill for template selection and validation.

## Phase 2: Test (RED phase only when `--tdd` / `MEOWKIT_TDD=1`)

**TDD mode** — write failing tests first:
```
Task(subagent_type="tester", prompt="Write failing tests for [plan-path] acceptance criteria. Tests must RUN (no syntax errors) and FAIL. Reference meow:testing red-green-refactor. Target behaviors: [list from plan success criteria].", description="Write failing tests")
```
Expected return: test count, all FAIL status, file paths.

**Default mode (TDD off)** — Phase 2 is OPTIONAL. Skip the tester invocation unless the user explicitly requests tests or unless plan acceptance criteria require coverage. The orchestrator routes Phase 1 → Phase 3 directly when TDD mode is off.

## Phase 3: Build GREEN — Implementation

Single developer:
```
Task(subagent_type="developer", prompt="Implement [phase-file] to make all failing tests pass. TDD: implement only enough to pass tests. Run type checking after each file. Files to modify: [list]", description="Implement [phase]")
```

### Parallel Execution

Spawn multiple developers with file ownership:
```
Task(subagent_type="developer", prompt="Implement [phase-file]. File ownership: [glob-pattern]. Do NOT modify files outside ownership.", description="Phase [N]")
```

Each agent gets distinct files — no overlap. Wait for parallel group before next.

### Test Failure — Debugger

After 3 self-heal failures:
```
Task(subagent_type="researcher", prompt="Analyze test failures using meow:investigate + meow:sequential-thinking. Failing output: [output]. Attempted fixes: [list]. Return: root cause, confidence level, suggested fix.", description="Debug test failures")
```

## Phase 4: Review — Code Review

```
Task(subagent_type="reviewer", prompt="Review changes for [phase]. Check: security (OWASP), performance, YAGNI/KISS/DRY, architecture patterns. Return: score (X/10), critical_count, warnings list, suggestions list.", description="Code review")
```

Expected return format:
```
Score: 8.5/10
Critical (0): []
Warnings (2): ["Missing input validation at auth.ts:42", "N+1 query in users.service.ts:15"]
Suggestions (1): ["Consider extracting helper for date formatting"]
```

### Ship — Git Operations

```
Task(subagent_type="git-manager", prompt="Stage and commit changes with conventional commit message. If on feature branch, create PR.", description="Commit + PR")
```

## Phase 6: Reflect — Sync-back + Docs + Memory

**Orchestrator** (detailed sync-back):
```
Task(subagent_type="planner", prompt="Run full sync-back for [plan-path]: 1) Sweep ALL phase-XX-*.md files in plan directory. 2) Mark every completed item [ ] → [x] based on completed tasks (including earlier phases). 3) Update plan.md status/progress (pending/in-progress/completed) from actual checkbox state. 4) Report unresolved mappings if any task cannot match a phase file.", description="Plan sync-back")
```

**Documenter:**
```
Task(subagent_type="documenter", prompt="Evaluate docs impact for changes: [file-list]. Update docs/ directory if needed. State explicitly: Docs impact: [none|minor|major]", description="Update docs")
```

**Memory capture:**
```
Task(subagent_type="analyst", prompt="Run meow:memory session-capture for this session. Extract learnings in 3 categories (patterns/decisions/failures). Append to .claude/memory/lessons.md. Update .claude/memory/patterns.json with new entries including category, severity, applicable_when fields. Files to modify: .claude/memory/lessons.md, .claude/memory/patterns.json", description="Session memory capture")
```

## UI Work (Conditional)

If task involves frontend:
```
Task(subagent_type="ui-ux-designer", prompt="Implement [feature] UI per docs/design-guidelines.md. Follow meow:frontend-design patterns.", description="UI [feature]")
```

# Parallel Execution Rules

These rules govern when and how MeowKit agents execute work in parallel.

## Rule 1: Zero File Overlap Required

Parallel execution is ONLY permitted when subtasks have zero file overlap.
Each parallel agent MUST declare its owned files via glob patterns before starting.
If two agents' ownership patterns overlap, STOP and restructure the decomposition.

WHY: Concurrent edits to the same file cause merge conflicts and lost work. No amount of tooling fixes this — prevention is the only reliable strategy.

### Staged Parallel Mode (Alternative)

When strict zero-overlap is impractical (shared config, utils, types), use staged parallel:

1. Identify overlapping files between parallel agents
2. Split work: non-overlapping files run in parallel, overlapping files handled sequentially
3. Agent A completes its overlapping file edits → merge → Agent B starts on same files
4. Non-overlapping work proceeds in parallel throughout

**When to use staged mode:**
- Features with shared utility files
- Changes touching both frontend and shared types
- Multiple agents needing the same config file

**Constraints:** Same max-3-agent limit. Same worktree isolation. Integration test still required after merge.

## Rule 2: Max 3 Parallel Agents

NEVER spawn more than 3 parallel agents simultaneously.
Token costs scale linearly with parallel agents. 3 is the practical ceiling.

WHY: Each parallel agent consumes a full context window. 3 agents = 3x token cost. Beyond 3, the coordination overhead exceeds the throughput gains.

## Rule 3: Worktree Isolation

Each parallel agent MUST work in its own git worktree.
Create: `git worktree add .worktrees/{agent-name} -b {branch-name}`
Merge: After all parallel agents complete, merge worktree branches to feature branch.
Cleanup: `git worktree remove .worktrees/{agent-name}`

WHY: Worktrees provide filesystem-level isolation. Agents cannot accidentally overwrite each other's work. This is how ClaudeKit handles parallel teams — proven pattern.

## Rule 4: Gates Are Never Parallel

Gate 1 (plan approval) and Gate 2 (review approval) are ALWAYS sequential.
They ALWAYS require human approval. They NEVER run in parallel with other work.

WHY: Gates are the discipline core. Parallelizing them defeats their purpose.

## Rule 5: Integration Test After Merge

After merging parallel worktrees, run the FULL test suite on the merged result.
If tests fail, the parallel decomposition was wrong — fix before proceeding.

After the integration test passes, delegate to `project-manager` per
`.claude/rules/post-phase-delegation.md` Rule 1 to emit a merge report
summarizing what each parallel branch contributed.

WHY: Individual branches may pass their own tests but fail when combined. Integration testing catches interaction bugs that per-branch testing misses.

## Rule 6: Only COMPLEX Tasks Qualify

Parallel execution is only available for tasks classified as COMPLEX by the orchestrator.
TRIVIAL and STANDARD tasks use the default sequential pipeline.

WHY: Parallel decomposition has coordination overhead. For simple tasks, sequential is faster. Parallelism only pays off when the task is large enough to amortize the setup cost.

## When to Parallelize

| Scenario | Parallel? | Why |
|----------|-----------|-----|
| Multiple independent research topics | Yes | Researchers are read-only, no file conflicts |
| Independent components (API + UI) | Yes | Different directories, clear ownership |
| Feature + its tests | No | Tests depend on implementation |
| Sequential phases (plan → test → build) | No | Each phase needs prior phase output |
| Architecture decision | No — use Party Mode | Discussion, not parallel implementation |

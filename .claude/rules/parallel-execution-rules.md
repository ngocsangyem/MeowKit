# Parallel Execution Rules

These rules govern when and how agents execute work in parallel.

## Rule 1: Zero File Overlap Required

Parallel execution is ONLY permitted when subtasks have zero file overlap.
Each parallel agent MUST declare its owned files via glob patterns before starting.
If two agents' ownership patterns overlap, STOP and restructure the decomposition.

WHY: Preventing overlap is the only reliable way to avoid lost concurrent edits.

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

WHY: Beyond 3 agents, coordination and token cost exceed throughput gains.

## Rule 3: Worktree Isolation

Each parallel agent MUST work in its own git worktree.
Create: `git worktree add .worktrees/{agent-name} -b {branch-name}`
Merge: After all parallel agents complete, merge worktree branches to feature branch.
Cleanup: `git worktree remove .worktrees/{agent-name}`

WHY: Worktrees provide filesystem-level isolation.

## Rule 4: Gates Are Never Parallel

Gate 1 (plan approval) and Gate 2 (review approval) are ALWAYS sequential.
They ALWAYS require human approval. They NEVER run in parallel with other work.

WHY: Parallel gates defeat the approval discipline.

## Rule 5: Integration Test After Merge

After merging parallel worktrees, run the FULL test suite on the merged result.
If tests fail, the parallel decomposition was wrong — fix before proceeding.

After the integration test passes, delegate to `project-manager` per
`.claude/rules/post-phase-delegation.md` Rule 1 to emit a merge report
summarizing what each parallel branch contributed.

WHY: Integration tests catch cross-branch interaction bugs.

## Rule 6: Only COMPLEX Tasks Qualify

Parallel execution is only available for tasks classified as COMPLEX by the orchestrator.
TRIVIAL and STANDARD tasks use the default sequential pipeline.

WHY: Parallelism only pays off when task size amortizes coordination cost.

## Rule 7: Team Coordination Is Opt-In

Agent Team rules apply only when a team/worktree workflow is active. Standard single-session subagent workflows use `orchestration-rules.md`.

The team-mode coordination details (ownership, no-force-push, worktree-branch commits, actionable completion messages, docs-impact ownership) are loaded on demand by `mk:team-config` from `.claude/skills/team-config/references/team-coordination.md` — they cost zero always-on context in standard sessions.

WHY: Team mode needs extra coordination that normal sessions do not; keeping the detail skill-local avoids loading it in the common single-session path.

## When to Parallelize

| Scenario | Parallel? | Why |
|----------|-----------|-----|
| Multiple independent research topics | Yes | Researchers are read-only, no file conflicts |
| Independent components (API + UI) | Yes | Different directories, clear ownership |
| Feature + its tests | No | Tests depend on implementation |
| Sequential phases (plan → test → build) | No | Each phase needs prior phase output |
| Architecture decision | No — use Party Mode | Discussion, not parallel implementation |

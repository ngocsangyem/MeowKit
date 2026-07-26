# Deep Workflow

Full pipeline with research, brainstorming, and planning for complex issues.

## Steps

### Step 1: Scout, Debug & Parallel Investigation
Run `mk:scout`, then activate `mk:investigate` and `mk:sequential-thinking`. Launch parallel exploration only for independent evidence paths:
```
Agent("Explore", "Find error origin and trace")
Agent("Explore", "Find affected components and dependencies")
Agent("Explore", "Find similar patterns in codebase")
```

**Output:** `Step 1: Root cause — [summary], system impact: [scope]`

### Step 2: Research (parallel with Step 1)
Use researcher agent for external knowledge.
- Search latest docs, best practices
- Find similar issues/solutions
- Gather security advisories if relevant

**Output:** `Step 2: Research complete — [key findings]`

### Step 3: Brainstorm
Use brainstormer agent.
- Evaluate multiple approaches with trade-offs
- Consider second-order effects
- Get user input on preferred direction

**Output:** `Step 3: Approach selected — [chosen approach]`

### Step 4: Plan
Use planner agent to create implementation plan.
- Break down into phases
- Identify dependencies
- Define success criteria

**Output:** `Step 4: Plan created — [N] phases`

### Step 5: Implement
Implement per plan. Follow AGENTS.md (Development / TDD) for flag precedence and regression-test requirements; do not restate or weaken that contract here.

**Parallel Verification** after implementation.

**Output:** `Step 5: Implemented — [N] files, [M] phases, verified`

### Step 6: Test
Use tester agent. Comprehensive testing including edge cases, security, performance.

**Output:** `Step 6: Tests [X/X passed]`

### Step 7: Review
Use reviewer agent. See `references/review-cycle.md`.

**Output:** `Step 7: Review [score]/10 — [status]`

### Step 8: Finalize
- Use documenter agent for documentation
- Use shipper agent for commit + PR
- Use journal-writer agent if this was a significant failure

**Output:** `Step 8: Complete — [actions taken]`

## Advice Checkpoints (`--advice` only)

Skip this whole section unless the run was invoked with `--advice`. Without the
flag there are zero advisory calls.

### Triggers

| Trigger | Fires at | Condition |
|---|---|---|
| a — stuck run | Step 5 | Root cause is evidenced AND two distinct fix approaches have failed |
| b — irreversible step | Step 5, before the edit | The fix touches a security boundary, a public contract, or anything that can lose data |
| c — residual risk | Step 7 | Tests and review passed but the remaining risk is unclear |

Each trigger fires **at most once per run** — worst case three calls. Never per
tool call, never per loop iteration, never per phase of the plan.

Trigger (a) does not replace or postpone the three-failed-attempt human STOP in
`SKILL.md`. That stop fires on its own schedule whether or not counsel was taken.

The advisory agent is not a substitute for Step 3 brainstorming or Step 4
planning: it supervises a decision the pipeline is already stuck on, and it never
produces a plan or a phase graph.

### Call

Delegation here is natural-language. Use this trigger sentence verbatim, then
include the five fields in the same request:

> Delegate this advice checkpoint to the athena agent.

The delegated agent inherits no conversation, so all five fields go in the text:

1. Task and the exact question being asked.
2. Constraints, plus any user decision that must not be silently reversed.
3. Evidence — file paths, commands run, observations so far.
4. Attempts — what was tried, what happened, why each failed.
5. Options under consideration, risk class, and whether the step is reversible.

### After the call

Render the returned packet to the user, then:

1. Write a receipt to `tasks/reports/{YYMMDD}-{slug}-advice-{n}.md` — frontmatter
   `kind: advice-receipt`, `disposition: adopted|rejected|deferred`, `reason`,
   `taskId`, `provider`, `skill`, `checkpoint`; body carries the verbatim line
   "This is a record of counsel, NEVER verification evidence.", the question, a
   recommendation summary, evidence pointers, and the next safe action.
2. If an active durable task record exists, point at it:
   `mewkit task-state update <id> --evidence-ref <receipt path>`. With no active
   record, keep the file and skip this step — never invent a record.
3. For trigger (a) only, optionally record the stall as friction:
   `mewkit trace --friction "advice checkpoint: <one line>" --responsibility failure-attribution`.

A failed receipt write prints a one-line notice and the run continues; it never
blocks and is never skipped silently. Then continue — the workflow decision stays
with this pipeline.

**Counsel is evidence, not authority.** It cannot pass, clear, or unblock any
gate — including Gate 1 on the Step 4 plan — and it is never counted as
verification. Verification stays with Step 6 tests and the Step 7 review verdict.

On this runtime the agent's no-write rule is behavioral (agent definitions carry
no per-agent tool or permission field), so treat any file change proposed by the
counsel packet as a recommendation for this pipeline to carry out, never as work
the advisory agent may do itself.

If the runtime cannot delegate to `athena`, print exactly
`advice checkpoint unavailable in this runtime: <reason>` and continue
unsupervised. Never write a counsel packet inline and present it as the advisory
agent's.

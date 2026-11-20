# Deep Workflow

Full pipeline with research, brainstorming, and planning for complex issues.

## Contents

- [Steps](#steps)
- [Step 1: Scout, Debug & Parallel Investigation](#step-1-scout-debug--parallel-investigation)
- [Step 2: Research (parallel with Step 1)](#step-2-research-parallel-with-step-1)
- [Step 3: Brainstorm](#step-3-brainstorm)
- [Step 4: Plan](#step-4-plan)
- [Step 5: Implement](#step-5-implement)
- [Step 6: Test](#step-6-test)
- [Step 7: Review](#step-7-review)
- [Step 8: Finalize](#step-8-finalize)
- [Advice Checkpoints (`--advice` only)](#advice-checkpoints---advice-only)
- [Checkpoints](#checkpoints)
- [What each checkpoint asks](#what-each-checkpoint-asks)
- [Boundaries](#boundaries)

## Steps

### Step 1: Scout, Debug & Parallel Investigation
Run `mk:scout`, then activate `mk:investigate` and `mk:sequential-thinking`. Launch parallel exploration only for independent evidence paths:
```
read-only search subagent: "Find error origin and trace"
read-only search subagent: "Find affected components and dependencies"
read-only search subagent: "Find similar patterns in codebase"
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
Implement per plan. Follow `.claude/skills/cook/references/tdd-rules.md` for flag precedence and regression-test requirements; do not restate or weaken that contract here.

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

Skip this whole section unless the run was invoked with `--advice`. Without the flag
there are zero supervision calls and nothing here loads.

On the first checkpoint of a run, read the supervision contract this skill's `SKILL.md`
names under `--advice`. This section implements it, and it holds the call protocol every
checkpoint follows.

### Checkpoints

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | Step 5, before the first edit | Root cause is confirmed, or a diagnostic report was handed off | 1 |
| RESCUE | Step 5 | Two distinct fix approaches have failed, OR the evidence contradicts itself, OR the step is irreversible (security boundary, public contract, possible data loss) | 2 |
| REVIEW | Step 6→7 boundary, after Verify and before the normal review | always, when the flag is on | 1 |
| RECHECK | after corrections from a `RETURN_TO_EXECUTOR` | only after a return | 1 |

Hard cap **5 calls per run**, charged as `--skill mk:fix`. Checkpoints are macro
boundaries — never per tool call, per loop iteration, or per file.

The RESCUE trigger does not replace or postpone the three-failed-attempt human STOP in
`SKILL.md`. That stop fires on its own schedule whether or not supervision was taken at
two failures.

### What each checkpoint asks

- **GUIDE** — given this root cause, which fix path carries the least risk, and what
  proof would show it worked?
- **RESCUE** — two approaches failed on this evidence; what does the evidence actually
  support, and what would disconfirm the current hypothesis?
- **REVIEW** — does the evidence cover the reported bug and its regression, or does this
  go back?
- **RECHECK** — were the corrections addressed and proven?

### Boundaries

**Supervision is evidence, not authority.** It cannot agree the Step 4 plan, clear the
Step 7 review, or stand in for either — and it is never counted as verification.
Verification stays with Step 6 tests and the Step 7 review verdict.

### Routing in this skill

The call protocol defines the dispositions; here is what each one means for this skill.

- `CONTINUE_WITH_DIRECTIVE` — proceed; the directive is input, not instruction.
- `READY_FOR_EXISTING_GATE` — run the normal Step 7 review. The gate is NOT cleared.
- `RETURN_TO_EXECUTOR` — apply the corrections, then supersede the stale evidence:
  `mewkit advice commit … --disposition RETURN_TO_EXECUTOR --evidence <workflow-evidence.json> --correction-kind source|scope`.
  Re-run Step 6 before the review. A `scope` correction also sends the plan back to the
  user — a plan change needs their agreement, which Athena cannot give.
- `ESCALATE_TO_HUMAN` — stop at the existing human touchpoint.
- `BLOCKED_MISSING_EVIDENCE` — supply the named evidence or continue unsupervised.

If the runtime cannot delegate to `athena`, print exactly

```
advice checkpoint unavailable in this runtime: <reason>
```

and continue unsupervised. Never write a packet inline and present it as the agent's —
that is not an independent check, and a receipt produced that way records supervision
that never happened.

Athena is not a substitute for Step 3 brainstorming or Step 4 planning: it assesses
a decision the pipeline is already facing and recommends one operational path inside
the locked scope. It never authors a plan or a phase graph, and it never agrees the
Step 4 plan on the user's behalf.

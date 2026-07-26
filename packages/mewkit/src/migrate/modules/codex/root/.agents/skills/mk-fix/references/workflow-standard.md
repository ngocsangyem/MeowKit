# Standard Workflow

Full pipeline for moderate complexity issues. Uses task tracking for phase coordination.

## Steps

### Step 1: Scout, Debug & Investigate
Run `mk:scout`, then activate `mk:investigate` and `mk:sequential-thinking`. Use a researcher only if external docs are needed.
- Read error messages, logs, stack traces
- Capture deterministic reproduction or bounded intermittent evidence
- Trace backward to root cause
- Identify all affected files

**Output:** `Step 1: Root cause — [summary], [N] files affected`

### Step 2: Extend Scout Coverage
Extend the mandatory scout when the initial blast radius is larger than the direct module.

- Find patterns, similar implementations, dependencies, and callers
- Use parallel exploration only for independent affected areas

**Output:** `Step 2: Scouted [N] areas — Found [M] related files`

### Step 3: Implement Fix
Fix the issue following debugging findings.

**Parallel Verification** after implementation:
```
Agent(subagent_type="Bash", prompt="Run typecheck")
Agent(subagent_type="Bash", prompt="Run lint")
Agent(subagent_type="Bash", prompt="Run build")
```

**Output:** `Step 3: Implemented — [N] files, verified`

### Step 4: Test
Use tester agent to run tests.
- Write new tests if needed
- Run existing test suite
- If fail → self-heal up to 3 attempts

**Output:** `Step 4: Tests [X/X passed]`

### Step 5: Review
Use reviewer agent. See `references/review-cycle.md`.

**Output:** `Step 5: Review [score]/10 — [status]`

### Step 6: Finalize
- Report summary to user
- Ask to commit via shipper agent
- Update docs if needed via documenter agent

**Output:** `Step 6: Complete — [action]`

## Advice Checkpoints (`--advice` only)

Skip this whole section unless the run was invoked with `--advice`. Without the
flag there are zero advisory calls.

### Triggers

| Trigger | Fires at | Condition |
|---|---|---|
| a — stuck run | Step 3 | Root cause is evidenced AND two distinct fix approaches have failed |
| b — irreversible step | Step 3, before the edit | The fix touches a security boundary, a public contract, or anything that can lose data |
| c — residual risk | Step 5 | Tests and review passed but the remaining risk is unclear |

Each trigger fires **at most once per run** — worst case three calls. Never per
tool call, never per loop iteration, never per file.

Trigger (a) does not replace or postpone the three-failed-attempt human STOP in
`SKILL.md`. That stop fires on its own schedule whether or not counsel was taken.

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
gate, and it is never counted as verification. Verification stays with Step 4
tests and the Step 5 review verdict.

On this runtime the agent's no-write rule is behavioral (agent definitions carry
no per-agent tool or permission field), so treat any file change proposed by the
counsel packet as a recommendation for this pipeline to carry out, never as work
the advisory agent may do itself.

If the runtime cannot delegate to `athena`, print exactly
`advice checkpoint unavailable in this runtime: <reason>` and continue
unsupervised. Never write a counsel packet inline and present it as the advisory
agent's.

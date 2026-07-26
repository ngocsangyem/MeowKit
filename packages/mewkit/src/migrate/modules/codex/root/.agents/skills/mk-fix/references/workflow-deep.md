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

**Not available in this bundle yet.** The supervisor contract that governs
`--advice` — the `GUIDE → RESCUE* → REVIEW → RECHECK*` cadence, per-stage and
per-skill caps, the continuity dossier, the receipt, and the `RETURN_TO_EXECUTOR`
correction cycle — is enforced by `mewkit advice begin|commit`, and the adapter that
reaches it from this runtime has not been authored or smoke-tested here.

Until it is, treat `--advice` as unavailable on this surface: print exactly

```
advice checkpoint unavailable in this runtime: adapter not authored for this bundle
```

and continue unsupervised. The ordinary workflow is unaffected.

Do NOT improvise a checkpoint. Writing a packet inline and presenting it as the
advisory agent's output is not an independent check, and a receipt produced that way
records supervision that never happened. The canonical contract, for reference, is
the advice-supervision rule in the source kit.

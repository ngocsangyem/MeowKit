# Agent Teams vs sub-task

When the autobuild workflow should use file-based sub-task dispatches (default) vs live Agent Teams (opt-in for live generator↔evaluator coupling).

## Contents

- [TL;DR](#tldr)
- [sub-task (Default)](#sub-task-default)
- [Agent Teams (Opt-in)](#agent-teams-opt-in)
- [When to Use Which](#when-to-use-which)
- [Configuration](#configuration)
- [File Ownership Matrix (Teams Mode Only)](#file-ownership-matrix-teams-mode-only)
- [Defaults](#defaults)
- [Risk Notes](#risk-notes)


## TL;DR

**Default to sub-task (file-based, reproducible).** Agent Teams are an opt-in acceleration for **live generator↔evaluator peer comms** during tight iteration loops where the file-based round-trip overhead becomes the bottleneck.

For 95% of autobuild runs, sub-task are correct. Teams are appropriate when: (a) iteration loops run > 5 rounds in practice, (b) the latency between FAIL verdict and next-iteration generate is the dominant cost, (c) the user explicitly opts in via `--teams` flag.

## sub-task (Default)

**How they work:**
- Each phase spawns a fresh sub-task via `delegate a sub-task (subagent_type=...)`
- Inputs are file paths (plan, contract, handoff, verdict) — no shared in-memory state
- Outputs are files (handoff.md, verdict.md, run.md) — committed to git
- sub-task context is isolated; no live coupling between generator and evaluator

**Pros:**
- **Reproducible.** Same inputs → same outputs. Replayable for debugging.
- **Auditable.** Every step is a git commit; the run report is the audit trail.
- **No coupling.** Generator and evaluator can't accidentally share assumptions.
- **Resumable.** Killed autobuild runs resume from the last completed step.
- **Observable.** Every artifact is a file; users can read intermediate state.

**Cons:**
- **Latency.** File round-trips add seconds per step. For tight iteration loops (5+ rounds) this compounds.
- **No live feedback.** The evaluator can't ask the generator a clarifying question mid-build.
- **Context resets per step.** Each sub-task reloads relevant files; warm context across steps is lost.

## Agent Teams (Opt-in)

**How they work:**
- Generator and evaluator run as long-lived agents in the same session
- Live message passing via `SendMessage` between named teammates
- Shared task queue via `TaskList` / `TaskClaim` patterns
- File ownership matrix prevents concurrent edits to same files

**Pros:**
- **Lower latency** in iteration loops (no per-step sub-task spawn cost)
- **Live clarification:** evaluator can DM generator with "criterion AC-04 unclear, did you mean X or Y" mid-build
- **Warm context:** generator doesn't re-read the contract on every iteration
- **Faster convergence** when iteration loops would otherwise hit 4–5 rounds

**Cons:**
- **Coupling risk.** Live message passing makes failures harder to trace.
- **File ownership conflicts.** If both agents try to edit the same file, the team protocol must arbitrate.
- **Less reproducible.** Live message ordering can affect outcomes — re-runs may diverge.
- **Harder to resume.** Killed teams can leave shared state in inconsistent partial states.
- **Token cost.** Long-lived agents consume context windows continuously, not just per dispatch.

## When to Use Which

| Scenario | Use |
|---|---|
| First run of any new task | **sub-task** (build muscle memory; reproducibility) |
| Single-iteration LEAN build | **sub-task** (overhead irrelevant at 1 iteration) |
| Iteration loops averaging 1–2 rounds | **sub-task** |
| Iteration loops historically averaging 4+ rounds | **Teams** (latency is the bottleneck) |
| Debugging a failing harness | **sub-task** (audit trail required) |
| User explicitly requests `--teams` | **Teams** (user owns the trade-off) |
| Production ship pipeline | **sub-task** (Gate 2 needs reproducibility) |
| Research / experiments | **Teams** (iteration speed matters more than reproducibility) |

## Configuration

To opt in to Agent Teams for a autobuild run:

```bash
the autobuild skill "build a kanban app" --teams
```

The autobuild workflow then uses `mk:team-config` to spin up a generator + evaluator team, hands off the contract via shared task queue, and runs the iteration loop with live message passing.

To force sub-task mode (override any default that might switch):

```bash
the autobuild skill "..." --no-teams
```

Both flags are logged in the run report.

## File Ownership Matrix (Teams Mode Only)

When teams mode is active, file ownership is enforced via `mk:team-config`'s ownership matrix. The evaluator owns:

- `tasks/reviews/*-evalverdict.md` (its verdicts)
- `tasks/reviews/*-evalverdict-evidence/` (its evidence)

The generator owns:

- `tasks/handoff/*.md` (its handoff files)
- `src/`, `lib/`, `app/` (source code)
- `progress.md` (its working memory)

Both can READ the contract at `tasks/contracts/*.md`. Neither can WRITE to it without re-triggering the contract negotiation protocol (the autobuild contract stage).

## Defaults

- `mk:autobuild` defaults to **sub-task** unless `--teams` flag is set
- `mk:cook` (single-task) always uses sub-task — teams are not relevant for single-task pipelines
- The autobuild run report records which mode was used in the "Density Decision" section alongside the density choice

## Risk Notes

- Teams mode **does not bypass** any gate. Gate 1, Gate 2, and the contract gate all still apply.
- Teams mode **does not reduce** the active-verification HARD GATE. The evaluator still runs `validate-verdict.sh` on every verdict.
- Teams mode **increases** the cost of context window per agent (long-lived = continuous consumption).
- If a team session crashes mid-iteration, the recovery path is to fall back to sub-task and resume from the last committed step.
---
title: What's New
description: Improvement — scale-adaptive routing, adversarial review, Party Mode, step-file architecture, and parallel execution.
persona: A
---

# What's New (v0.2.0)

## Improvements

Seven capabilities shipped across two weeks. Each addresses a specific failure mode in AI agent workflows.

## Scale-Adaptive Intelligence

**Problem:** Orchestrators guess task complexity. Guesses are wrong. A fintech payment task classified as STANDARD gets Sonnet instead of Opus — and misses a security edge case.

**Solution:** Domain-based routing at Phase 0 via `meow:scale-routing`. A CSV maps keyword signals to complexity levels. The CSV verdict overrides manual classification — no exceptions.

```
Task: "Add Stripe refund endpoint"
  → scale-routing detects: domain=fintech, level=high
  → Override: COMPLEX tier (Opus)
  → Manual classification: ignored
```

Key behaviors:

- **High domains** (fintech, healthcare, auth) force COMPLEX tier
- **Low domains** (docs, config, changelog) unlock one-shot bypass of Gate 1
- **User-extensible** — add rows to `domain-complexity.csv` for project-specific domains
- **No rationalization** — agents cannot argue down a high-level verdict

[Model Routing docs →](/guide/model-routing)

---

## Project Context System

**Problem:** Each agent infers project conventions independently. One agent uses `snake_case`, another uses `camelCase`. Context drift compounds over a session.

**Solution:** `docs/project-context.md` is the agent constitution. Every agent loads it at session start, before any task-specific context.

```
Session Start
  1. Load docs/project-context.md   ← Always first
  2. Load memory/lessons.md
  3. Load task context
  4. Route to agent
```

What goes in `project-context.md`:

- Tech stack and versions
- Naming conventions
- Anti-patterns to avoid
- Testing approach and coverage targets
- Deployment process

Generate or update it:

```bash
/meow:docs-init   # new project — scan codebase, generate skeleton
/meow:docs-sync   # after shipping a feature — diff-aware update
```

---

## Multi-Layer Adversarial Review

**Problem:** Single-pass code review misses bugs. One reviewer looks for what they expect to see.

**Solution:** `meow:review` now uses a 4-step workflow with 3 parallel reviewers and a triage step.

```
Step 1: Blind Hunter     — reviews with zero context (catches hidden bugs)
Step 2: Edge Case Hunter — stress-tests boundary conditions and error paths
Step 3: Criteria Auditor — verifies every acceptance criterion is actually met
Step 4: Triage           — synthesizes findings, eliminates duplicates, assigns severity
```

Results: catches **2-3x more bugs** than single-pass review, particularly:

- Silent failures where code compiles but behaves wrong under load
- Missing error handling in exception paths
- Acceptance criteria that are technically "met" but miss the intent

This uses the [step-file architecture](#step-file-architecture) — each step is JIT-loaded, keeping context lean.

---

## Anti-Rationalization Hardening

**Problem:** Agents rationalize their way around rules. "This is just a simple task, we don't need security review." "The tests look fine, I won't write more."

**Solution:** Four explicit blocks with no self-override:

| Blocked behavior                                               | Why                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| Downgrading complexity after scale-routing assigns it          | Domain signals are more reliable than in-context reasoning |
| Minimizing test coverage ("looks fine")                        | Tests that don't cover real paths are worse than no tests  |
| Skipping security rules for "simple" tasks                     | Security issues don't respect task complexity              |
| Dismissing WARN verdicts without explicit human acknowledgment | WARNs exist for a reason; silence is not acknowledgment    |

---

## Party Mode

**Problem:** AI agents presented with an architectural question give one answer. It may be wrong. There's no structured way to stress-test the decision.

**Solution:** `/meow:party` spawns 2-4 deliberation agents with different analytical lenses. Each reaches an independent conclusion. A synthesis agent reconciles positions into a single recommendation.

```bash
/meow:party "PostgreSQL or MongoDB for the session store?"
```

```
Agent A (performance lens): PostgreSQL — ACID transactions, predictable latency
Agent B (ops lens):          MongoDB — horizontal scaling easier, ops simpler
Agent C (migration lens):    PostgreSQL — existing data in PG, no migration needed

Synthesis: PostgreSQL. Migration cost and existing infra outweigh scaling argument.
MongoDB revisit if read load exceeds 50k req/s (not projected for 12 months).
```

Party output feeds into an ADR. The decision is documented before any code is written.

**When to use:** Two reasonable engineers would disagree. Long-term consequences. Wrong choice costs > 2 days.

[Party Mode skill →](/reference/skills/party) | [Architecture workflow →](/workflows/architecture)

---

## Step-File Architecture

**Problem:** Complex skills with 3+ distinct phases load everything into context at once. Token-expensive. Hard to audit. Cannot resume after context reset.

**Solution:** Skills decompose into JIT-loaded step files.

```
skills/meow:review/
├── SKILL.md           # Entry point — metadata only
├── workflow.md        # Step sequence
├── step-01-blind-review.md
├── step-02-edge-cases.md
├── step-03-criteria-audit.md
└── step-04-triage.md
```

Only the active step is in context. State persists to `session-state/{skill}-progress.json` — interrupted workflows resume from the last completed step, not from scratch.

Rules:

- One step at a time — never pre-load the next step
- Never skip steps — even short steps run fast and preserve sequence integrity
- Monolithic skills (< 150 lines) don't need decomposition

Currently step-file enabled: `meow:review` (4 steps).

[Step-file architecture →](/guide/agent-skill-architecture#step-file-architecture)

---

## Parallel Execution

**Problem:** COMPLEX tasks with independent subtasks run sequentially. A backend API, its tests, and a frontend component have no dependency between them — but they run one at a time.

**Solution:** Up to 3 parallel agents, each isolated in a git worktree.

```bash
# Orchestrator decomposes COMPLEX task:
git worktree add .worktrees/api-agent    -b feat/api-agent
git worktree add .worktrees/ui-agent     -b feat/ui-agent
git worktree add .worktrees/test-agent   -b feat/test-agent

# Agents work simultaneously, zero file overlap
# After all complete: merge branches, run full integration tests
```

Constraints:

| Rule                         | Value                                    |
| ---------------------------- | ---------------------------------------- |
| Max parallel agents          | 3                                        |
| File overlap allowed         | Never                                    |
| Gates (1 and 2)              | Always sequential, always human-approved |
| Integration test after merge | Required                                 |
| Eligible task tier           | COMPLEX only                             |

Party Mode and Gates are never parallelized — coordination overhead exceeds the benefit.

---

## Summary

| Feature                | Solves                                    | When it activates            |
| ---------------------- | ----------------------------------------- | ---------------------------- |
| Scale-Adaptive Routing | Wrong model tier for domain               | Phase 0, automatic           |
| Project Context System | Agent convention drift                    | Session start, automatic     |
| Adversarial Review     | Single-pass review misses bugs            | Phase 4 via `meow:review`    |
| Anti-Rationalization   | Agents bypass rules via reasoning         | Always, built into rules     |
| Party Mode             | No stress-test for architecture decisions | Explicit `/meow:party`       |
| Step-File Architecture | Token waste + no resumability             | Complex skills (meow:review) |
| Parallel Execution     | Sequential bottleneck on independent work | COMPLEX tasks, explicit      |

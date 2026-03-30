---
title: Workflow Phases (0-6)
description: MeowKit's 7-phase development workflow from task receipt to reflection.
persona: B
---

# Workflow Phases

Every non-trivial task flows through MeowKit's 7-phase pipeline. Each phase has a specific agent, a clear deliverable, and (in two cases) a hard gate requiring human approval.

## Phase 0 — Orient (automatic)

**Agent:** orchestrator, analyst
**Deliverable:** Model tier assignment, execution mode, context loaded

- Read `docs/project-context.md` (agent constitution — loaded first, always; auto-injected by `project-context-loader.sh` hook)
- Read `memory/lessons.md` and `memory/patterns.json`
- **Retroactive capture:** check `lessons.md` for `NEEDS_CAPTURE` markers from previous sessions. Process at most 3 recent markers (2-min budget). Reconstructs learnings from `git log`. Skip markers with 0 files touched. Mark older ones as `skipped-too-old`
- Run `meow:scale-routing` — domain-based complexity classification (CSV-driven)
- Load stack-relevant skills only (lazy loading)
- Route: assign model tier by task complexity (Haiku / Sonnet / Opus)
- Select execution mode: sequential (default), parallel (COMPLEX), or party (discussions)
- Print cost estimate before starting

### Navigation help

When you're unsure which phase to enter next, run:

```bash
/meow:help
```

`/meow:help` scans plans, reviews, tests, git log, and memory to determine current pipeline state and prints a single concrete next action. Use it to re-orient after a context reset or mid-session interruption.

### Execution modes

| Mode | When | How |
|------|------|-----|
| **Sequential** | Default for all tasks | Phases run one at a time, single agent per phase |
| **Parallel** | COMPLEX tasks with independent subtasks | Up to 3 agents, each in a git worktree, zero file overlap |
| **Party** | Architecture decisions, trade-off analysis | 2-4 agents deliberate, one synthesis — no code during party |

Party Mode is triggered explicitly:

```
/meow:party "Should we use GraphQL or REST for the public API?"
```

## Phase 1 — Plan Gate 1

**Agent:** planner
**Deliverable:** `tasks/plans/YYMMDD-name.md`

Phase 1 produces an approved plan using one or more planning skills:

| Skill                  | Lens               | Use when                           |
| ---------------------- | ------------------ | ---------------------------------- |
| `meow:plan-creator`    | Full plan creation | Starting from scratch              |
| `meow:plan-ceo-review` | Product lens       | Is this the right thing to build?  |
| `meow:plan-eng-review` | Engineering lens   | Is this the right way to build it? |
| `meow:validate-plan`   | 8-dimension quality check | COMPLEX tasks — runs before Gate 1 |

For COMPLEX tasks (5+ files), the planner also applies **bead decomposition** — breaking the plan into atomic, independently committable work units. See [planner](/reference/agents/planner) for details. The `meow:validate-plan` skill checks bead boundaries as one of its 8 dimensions, ensuring clean handoff to the developer.

### Gate 1 behavior — Print & Stop

All three skills end with a **Print & Stop**:

1. Skill prints a copy-pasteable `/meow:cook [plan path]` command
2. Claude stops — no auto-proceed
3. You review the output and decide the next step
4. When ready: run `/meow:cook [plan path]` to begin Phase 2

### Review combinations

You control which reviews to run. Common patterns:

```bash
# Plan only — fastest
/meow:cook tasks/plans/260328-feature.md

# Plan + product review
# Run meow:plan-ceo-review, then:
/meow:cook tasks/plans/260328-feature.md

# Plan + both reviews (recommended for large features)
# Run meow:plan-ceo-review, then meow:plan-eng-review, then:
/meow:cook tasks/plans/260328-feature.md
```

No skill automatically chains into another. You decide the review depth.

- **HUMAN APPROVAL REQUIRED** — no code until plan is approved

## Phase 2 — Test RED

**Agent:** tester
**Deliverable:** Failing tests

- Write failing tests FIRST — the task file's acceptance criteria drive the test cases
- `pre-implement.sh` hook: BLOCKS if no failing test exists
- Security pre-check: scan for known anti-patterns
- Run `meow:nyquist` at the end of Phase 2 to verify test-to-requirement coverage — every acceptance criterion in the plan must have at least one test targeting it before Phase 3 begins

## Phase 3 — Build GREEN

**Agent:** developer
**Deliverable:** Passing implementation

- Implement until tests pass
- `post-write.sh` hook: security scan on every file write
- Self-heal: auto-fix failures up to 3 attempts
- Memory capture: log patterns as they emerge
- For COMPLEX tasks: process the plan's **bead decomposition** sequentially — commit after each bead, resume from last uncommitted bead if interrupted. See [developer](/reference/agents/developer) for the full bead processing loop.

## Phase 4 — Review ✋ Gate 2

**Agent:** reviewer
**Deliverable:** `tasks/reviews/YYMMDD-name-verdict.md`

- 5-dimension structural audit: architecture, types, security, tests, performance
- `validate.py`: deterministic checks outside the LLM
- Review verdict saved to `tasks/plans/YYMMDD-name/reports/`
- **Optional pre-review:** run `meow:scout` to detect edge cases and unusual patterns before the main review runs — findings are injected into the review context
- **Optional post-verdict:** run `meow:elicit` after the verdict to push deeper on WARN dimensions using 8 structured elicitation methods
- **HUMAN APPROVAL REQUIRED** — no shipping until review passes

## Phase 5 — Ship

**Agent:** shipper  
**Deliverable:** PR URL + rollback documentation

- **Live capture:** before shipping, if the session produced non-obvious decisions, corrections, or rejected approaches, append a brief note to `memory/lessons.md` with status `live-captured`. This preserves WHY decisions were made — retroactive capture can only recover WHAT
- `pre-ship.sh` hook: full test + lint + typecheck
- Conventional commit (auto-generated)
- PR — never push to main directly
- Verify CI passes before closing
- Document rollback steps

## Phase 6 — Reflect (automatic)

**Agent:** documenter, analyst
**Deliverable:** Updated memory + documentation

- **3-category extraction:** capture learnings as patterns, decisions, or failures
- Update `memory/patterns.json` with new entries (category, severity, applicable_when fields)
- Update `memory/cost-log.json` with token usage
- Sync affected documentation
- Close sprint task

## Hook Enforcement

MeowKit uses shell hooks to upgrade behavioral rules to preventive enforcement — the action is blocked *before* it executes, not after the agent has already reasoned its way past the rule.

| Hook | Event | What it blocks |
|------|-------|---------------|
| `privacy-block.sh` | PreToolUse | `.env`, `*.key`, credential file reads |
| `gate-enforcement.sh` | PreToolUse | Source code writes before Gate 1 approval |
| `project-context-loader.sh` | SessionStart | Missing project-context.md (auto-loads it) |

`privacy-block.sh` and `gate-enforcement.sh` are preventive — they intercept the tool call. `project-context-loader.sh` is proactive — it ensures the agent constitution is in context before any task runs.

Hooks supplement rules. Rules define the WHY; hooks enforce the WHAT.

### Plan-First Gate Pattern

Most MeowKit skills enforce a plan-first gate: they check for an approved plan before proceeding with significant work.

| Skill                      | Gate behavior            | Skip condition               |
| -------------------------- | ------------------------ | ---------------------------- |
| meow:cook                  | Create plan if missing   | Plan path arg, `--fast` mode |
| meow:fix                   | Plan if > 2 files        | `--quick` mode               |
| meow:ship                  | Require approved plan    | Hotfix with human approval   |
| meow:cso                   | Scope audit via plan     | `--daily` mode               |
| meow:qa                    | Create QA scope doc      | Quick tier                   |
| meow:review                | Read plan for context    | PR diff reviews              |
| meow:workflow-orchestrator | Route to plan-creator    | Fasttrack mode               |
| meow:investigate           | Produces input FOR plans | Always skips                 |
| meow:office-hours          | Pre-planning skill       | Always skips                 |
| meow:retro                 | Data-driven, no plan     | Always skips                 |
| meow:document-release      | Scope from diff          | Post-ship sync               |

Skills that skip planning have documented reasons — they either produce planning input (investigate, office-hours) or are data-driven (retro).

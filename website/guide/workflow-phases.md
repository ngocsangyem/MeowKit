---
title: Workflow Phases (0-6)
description: MeowKit's 7-phase development workflow from task receipt to reflection.
persona: B
---

# Workflow Phases

Every non-trivial task flows through MeowKit's 7-phase pipeline. Each phase has a specific agent, a clear deliverable, and (in two cases) a hard gate requiring human approval.

## Phase 0 — Orient (automatic)

**Agent:** orchestrator, analyst  
**Deliverable:** Model tier assignment, context loaded

- Read `memory/lessons.md` and `memory/patterns.json`
- Load stack-relevant skills only (lazy loading)
- Route: assign model tier by task complexity (Haiku / Sonnet / Opus)
- Print cost estimate before starting

## Phase 1 — Plan Gate 1

**Agent:** planner
**Deliverable:** `tasks/plans/YYMMDD-name.md`

Phase 1 produces an approved plan using one or more planning skills:

| Skill                  | Lens               | Use when                           |
| ---------------------- | ------------------ | ---------------------------------- |
| `meow:plan-creator`    | Full plan creation | Starting from scratch              |
| `meow:plan-ceo-review` | Product lens       | Is this the right thing to build?  |
| `meow:plan-eng-review` | Engineering lens   | Is this the right way to build it? |

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

## Phase 3 — Build GREEN

**Agent:** developer  
**Deliverable:** Passing implementation

- Implement until tests pass
- `post-write.sh` hook: security scan on every file write
- Self-heal: auto-fix failures up to 3 attempts
- Memory capture: log patterns as they emerge

## Phase 4 — Review ✋ Gate 2

**Agent:** reviewer
**Deliverable:** `tasks/reviews/YYMMDD-name-verdict.md`

- 5-dimension structural audit: architecture, types, security, tests, performance
- `validate.py`: deterministic checks outside the LLM
- Review verdict saved to `tasks/plans/YYMMDD-name/reports/`
- **HUMAN APPROVAL REQUIRED** — no shipping until review passes

## Phase 5 — Ship

**Agent:** shipper  
**Deliverable:** PR URL + rollback documentation

- `pre-ship.sh` hook: full test + lint + typecheck
- Conventional commit (auto-generated)
- PR — never push to main directly
- Verify CI passes before closing
- Document rollback steps

## Phase 6 — Reflect (automatic)

**Agent:** documenter, analyst
**Deliverable:** Updated memory + documentation

- Capture patterns to `memory/`
- Update `memory/lessons.md` and `memory/cost-log.json`
- Sync affected documentation
- Close sprint task

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

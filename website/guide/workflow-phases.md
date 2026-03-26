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

## Phase 1 — Plan ✋ Gate 1

**Agent:** planner  
**Deliverable:** `tasks/plans/YYMMDD-name.md`

- Challenge premises (/office-hours pattern)
- Product lens: is this the right thing to build?
- Engineering lens: is this the right way to build it?
- Architecture check: does this need an ADR?
- **HUMAN APPROVAL REQUIRED** — no code until plan is approved

## Phase 2 — Test RED

**Agent:** tester  
**Deliverable:** Failing tests

- Write failing tests FIRST
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

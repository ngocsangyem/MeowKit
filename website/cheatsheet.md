---
title: Cheatsheet
description: Dense quick reference for all MeowKit commands, agents, skills, and workflow phases.
persona: B
---

# Cheatsheet

## Slash Commands

| Command | Phase | What it does |
|---------|-------|-------------|
| `/meow:meow [task]` | 0 | Entry point — classifies and routes to right agent |
| `/meow:plan [feature]` | 1 | Premise challenge + two-lens plan + Gate 1 |
| `/meow:cook [feature]` | 1→5 | Full pipeline: plan → test → build → review → ship |
| `/meow:fix [bug]` | varies | Auto-detect complexity, route to fix strategy |
| `/meow:review` | 4 | Multi-pass code review + adversarial analysis |
| `/meow:ship` | 5 | Pre-ship → commit → PR → CI verify → rollback doc |
| `/meow:test` | 2 | TDD enforcement — write or run tests |
| `/meow:audit` | 4 | Full security scan across all platforms |
| `/meow:validate` | any | Run deterministic Python validation scripts |
| `/meow:arch [action]` | 1 | Generate, list, or analyze ADRs |
| `/meow:design [system]` | 1 | System design consultation (docs only) |
| `/meow:docs-init` | 6 | Initial codebase scan → doc skeleton |
| `/meow:docs-sync` | 6 | Diff-aware doc updates after feature work |
| `/meow:canary` | 5 | Staged deployment with monitoring |
| `/meow:retro` | 6 | Sprint retrospective with trend tracking |
| `/meow:budget` | any | Token cost tracking report |
| `/meow:spawn [agent]` | any | Launch parallel agent session |
| `/meow:upgrade` | any | Self-update MeowKit |

## Agents Quick Reference

| Agent | Auto-activates when | Phase | Key output |
|-------|---------------------|-------|------------|
| orchestrator | Every task | 0 | Routing decision + model tier |
| planner | Standard/complex tasks | 1 | Plan file at tasks/plans/ |
| brainstormer | Explicit or complex planning | 1 | Trade-off analysis |
| researcher | Research tasks | 0,1,4 | Structured findings |
| architect | Schema/API/infra changes | 1 | ADR + system design |
| tester | Before implementation | 2 | Failing tests (RED phase) |
| security | Auth/payments/security changes | 2,4 | BLOCK/PASS verdict |
| developer | After tester confirms RED | 3 | Implementation (GREEN phase) |
| reviewer | After implementation | 4 | 5-dimension verdict |
| shipper | After Gate 2 | 5 | PR + rollback docs |
| documenter | After ship | 6 | Updated docs + changelog |
| analyst | Session start/end | 0,6 | Cost report + patterns |
| journal-writer | On failure/escalation | 6 | Root cause documentation |

## Workflow Phases

| Phase | Name | Gate? | What happens |
|-------|------|-------|-------------|
| 0 | Orient | — | Read memory, load skills, route model tier |
| 1 | Plan | ✋ Gate 1 | Challenge premises, create plan, human approval |
| 2 | Test RED | — | Write failing tests first (TDD) |
| 3 | Build GREEN | — | Implement until tests pass |
| 4 | Review | ✋ Gate 2 | 5-dimension audit, human approval |
| 5 | Ship | — | Commit, PR, CI verify, rollback docs |
| 6 | Reflect | — | Update docs, memory, retrospective |

## Model Routing

| Tier | Examples | Model |
|------|---------|-------|
| TRIVIAL | Rename, typo, format | Cheapest (Haiku) |
| STANDARD | Feature, bug fix, tests | Default (Sonnet) |
| COMPLEX | Architecture, security, auth | Best (Opus) |

## Modes

| Mode | Gates | Security | Use for |
|------|-------|---------|---------|
| default | Both | Full | Most work |
| strict | Both (no WARN) | Every file | Production, auth, payments |
| fast | Gate 1 only | BLOCK only | Prototypes |
| architect | N/A | N/A | Design-only sessions |
| audit | N/A | Comprehensive | Security reviews |

## Hooks

| Hook | Type | What it does | Blocks? |
|------|------|-------------|---------|
| post-write.sh | PostToolUse | Security scan on Edit/Write | Yes |
| post-session.sh | Stop | Capture session to memory | No |
| pre-task-check.sh | Skill-invoked | Injection pattern detection | Yes |
| pre-implement.sh | Skill-invoked | TDD gate (must have failing test) | Yes |
| pre-ship.sh | Skill-invoked | Test + lint + typecheck | Yes |

## Key Skills

| Skill | Trigger | Output |
|-------|---------|--------|
| meow:cook | "build feature" | Full pipeline execution |
| meow:fix | "fix bug", "debug" | Root cause + fix + regression test |
| meow:ship | "ship", "deploy", "create PR" | PR URL + rollback docs |
| meow:review | "review", "check diff" | Verdict: APPROVE/BLOCK |
| meow:scout | "find files", "search codebase" | File map + architecture fingerprint |
| meow:investigate | "debug this", "why broken" | Root cause + evidence |
| meow:docs-finder | "docs for [lib]" | Structured documentation |
| meow:multimodal | Image/video/audio file | Analysis via Gemini |
| meow:qa-manual | "test this flow" | QA report or Playwright .spec.ts |
| meow:cso | "security audit" | OWASP + STRIDE findings |

## Task Templates

| Template | Use when | Create with |
|----------|----------|-------------|
| feature | Adding new functionality | `npx meowkit task new --type feature` |
| bug-fix | Fixing broken behavior | `npx meowkit task new --type bug-fix` |
| refactor | Restructuring code | `npx meowkit task new --type refactor` |
| security | Security review | `npx meowkit task new --type security` |
| guideline | Team standards | Copy from `tasks/templates/guideline.md` |

### Task status flow
`draft` → `in-progress` → `blocked` → `review` → `done`

### Non-trivial rule
Create a task file for any change affecting > 2 files OR > 30 minutes.

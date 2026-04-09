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
| `/meow:party [topic]` | 1 | Multi-agent deliberation — 2-4 agents debate, forced synthesis |
| `/meow:spawn [agent]` | any | Launch parallel agent session |
| `/meow:upgrade` | any | Self-update MeowKit |
| `/meow:help` | any | Scan project state, recommend next pipeline step |
| `/meow:harness "build a X"` | 0→5 | Autonomous green-field build with generator/evaluator loop |
| `/meow:evaluate` | 4 | Behavioral rubric grading with active verification |
| `/meow:sprint-contract` | 3 | Draft contract before harness sprint |
| `/meow:rubric` | 4 | Load/compose rubric preset |
| `/meow:trace-analyze` | any | Scatter-gather analysis of trace log |
| `/meow:benchmark` | any | Canary suite (quick tier default; `--full` for 6-task tier) |
| `/meow:summary` | any | Inspect conversation-summary cache |

## Agents Quick Reference

| Agent | Auto-activates when | Phase | Key output |
|-------|---------------------|-------|------------|
| orchestrator | Every task | 0 | Routing decision + model tier |
| planner | Standard/complex tasks | 1 | Plan file at tasks/plans/ |
| brainstormer | Explicit or complex planning | 1 | Trade-off analysis |
| researcher | Research tasks | 0,1,4 | Structured findings |
| architect | Schema/API/infra changes | 1 | ADR + system design |
| tester | When invoked (always in `--tdd` mode, on-request otherwise) | 2 | Tests (failing tests in `--tdd` mode) |
| security | Auth/payments/security changes | 2,4 | BLOCK/PASS verdict |
| developer | After planner (TDD off) or tester (TDD on) | 3 | Implementation |
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
| 2 | Test | — | Write failing tests first (TDD mode `--tdd`/`MEOWKIT_TDD=1`); optional otherwise |
| 3 | Build | — | Implement per plan; in TDD mode, until tests pass |
| 4 | Review | ✋ Gate 2 | 5-dimension audit, human approval |
| 5 | Ship | — | Commit, PR, CI verify, rollback docs |
| 6 | Reflect | — | Update docs, memory, retrospective |

## Execution Modes

| Mode | When | Agents | Gate behavior |
|------|------|--------|---------------|
| Sequential (default) | All tasks | 1 per phase | Full gates |
| Parallel | COMPLEX + independent subtasks | Up to 3, worktree isolation | Gates always sequential |
| Party | Architecture decisions | 2-4 deliberation agents | No code, synthesis only |

## Model Routing

| Tier | Examples | Model |
|------|---------|-------|
| TRIVIAL | Rename, typo, format | Cheapest (Haiku) |
| STANDARD | Feature, bug fix, tests | Default (Sonnet) |
| COMPLEX | Architecture, security, auth | Best (Opus) |

**Domain override:** `meow:scale-routing` at Phase 0. Fintech, healthcare, auth → force COMPLEX regardless of manual classification.

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
| pre-implement.sh | Skill-invoked | TDD gate — opt-in via `--tdd` / `MEOWKIT_TDD=1`; no-op otherwise | Only when TDD enabled |
| pre-ship.sh | Skill-invoked | Test + lint + typecheck | Yes |
| privacy-block.sh | PreToolUse | Block .env / *.key / credential reads | Yes |
| gate-enforcement.sh | PreToolUse | Block source writes before Gate 1 approval | Yes |
| project-context-loader.sh | SessionStart | Auto-load project-context.md into context | No |

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
| meow:party | "decide architecture" | Multi-agent decision brief |
| meow:scale-routing | Phase 0 (automatic) | Domain complexity level |
| meow:worktree | Parallel execution setup | Isolated git worktree |
| meow:harness | "build a X from scratch" | Autonomous generator/evaluator build loop |
| meow:evaluate | Harness Phase 4 | Rubric-graded behavioral verdict with evidence |
| meow:sprint-contract | Harness FULL density | Acceptance criteria contract before sprint |
| meow:rubric | Evaluator setup | Load/compose rubric preset |
| meow:trace-analyze | Trace log available | Root cause analysis across trace spans |
| meow:benchmark | Canary testing | Quick or full canary suite with scored output |

## Planning (Phase 1)

| Command | Purpose | Ends with |
|---------|---------|-----------|
| `meow:plan-creator` | Create plan from scratch | Print & Stop |
| `meow:plan-ceo-review` | Product lens review | Print & Stop |
| `meow:plan-eng-review` | Engineering lens review | Print & Stop |
| `/meow:cook [path]` | Begin implementation | Runs pipeline |

All three review skills stop after printing — you control when to run `/meow:cook [plan path]`.

| Command | What it does |
|---------|-------------|
| `/meow:plan "feature"` | Create plan via meow:plan-creator |
| `npx mewkit task new --type feature "desc"` | Create task from template |
| `npx mewkit task list` | List active tasks |

## Task Templates

| Template | Use when | Create with |
|----------|----------|-------------|
| feature | Adding new functionality | `npx mewkit task new --type feature` |
| bug-fix | Fixing broken behavior | `npx mewkit task new --type bug-fix` |
| refactor | Restructuring code | `npx mewkit task new --type refactor` |
| security | Security review | `npx mewkit task new --type security` |
| guideline | Team standards | Copy from `tasks/templates/guideline.md` |

### Task status flow
`draft` → `in-progress` → `blocked` → `review` → `done`

### Non-trivial rule
Create a task file for any change affecting > 2 files OR > 30 minutes.

## Harness Env Vars

| Variable | Values | Effect |
|----------|--------|--------|
| `MEOWKIT_HARNESS_MODE` | `MINIMAL` \| `FULL` \| `LEAN` | Override auto-detected scaffolding density |
| `MEOWKIT_MODEL_HINT` | e.g. `opus-4-6` | Tell harness which model is running (enables LEAN auto-detect) |
| `MEOWKIT_BUDGET_CAP` | e.g. `50` | Hard budget cap in USD for harness runs |
| `MEOWKIT_SUMMARY_CACHE` | `off` | Disable conversation-summary cache |

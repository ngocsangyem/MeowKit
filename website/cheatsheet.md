---
title: Cheatsheet
description: Dense quick reference for all MeowKit commands, agents, skills, and workflow phases.
persona: B
---

# Cheatsheet

## Slash Commands

| Command | Phase | What it does |
|---------|-------|-------------|
| `/mk:meow [task]` | 0 | Entry point — classifies and routes to right agent |
| `/mk:plan [feature]` | 1 | Premise challenge + two-lens plan + Gate 1 |
| `/mk:cook [feature]` | 1→5 | Full pipeline: plan → test → build → review → ship |
| `/mk:fix [bug]` | varies | Auto-detect complexity, route to fix strategy |
| `/mk:review` | 4 | Multi-pass code review + adversarial analysis |
| `/mk:ship` | 5 | Pre-ship → commit → PR → CI verify → rollback doc |
| `/mk:test` | 2 | TDD enforcement — write or run tests |
| `/mk:audit` | 4 | Full security scan across all platforms |
| `/mk:validate` | any | Run deterministic Python validation scripts |
| `/mk:arch [action]` | 1 | Generate, list, or analyze ADRs |
| `/mk:design [system]` | 1 | System design consultation (docs only) |
| `/mk:docs-init` | 6 | Initial codebase scan → doc skeleton |
| `/mk:docs-sync` | 6 | Diff-aware doc updates after feature work |
| `/mk:canary` | 5 | Staged deployment with monitoring |
| `/mk:retro` | 6 | Sprint retrospective with trend tracking |
| `/mk:budget` | any | Token cost tracking report |
| `/mk:party [topic]` | 1 | Multi-agent deliberation — 2-4 agents debate, forced synthesis |
| `/mk:spawn [agent]` | any | Launch parallel agent session |
| `/mk:upgrade` | any | Self-update MeowKit |
| `/mk:help` | any | Scan project state, recommend next pipeline step |
| `/mk:harness "build a X"` | 0→5 | Autonomous green-field build with generator/evaluator loop |
| `/mk:evaluate` | 4 | Behavioral rubric grading with active verification |
| `/mk:sprint-contract` | 3 | Draft contract before harness sprint |
| `/mk:rubric` | 4 | Load/compose rubric preset |
| `/mk:trace-analyze` | any | Scatter-gather analysis of trace log |
| `/mk:benchmark` | any | Canary suite (quick tier default; `--full` for 6-task tier) |
| `/mk:summary` | any | Inspect conversation-summary cache |

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

**Domain override:** `mk:scale-routing` at Phase 0. Fintech, healthcare, auth → force COMPLEX regardless of manual classification.

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
| mk:cook | "build feature" | Full pipeline execution |
| mk:fix | "fix bug", "debug" | Root cause + fix + regression test |
| mk:ship | "ship", "deploy", "create PR" | PR URL + rollback docs |
| mk:review | "review", "check diff" | Verdict: APPROVE/BLOCK |
| mk:scout | "find files", "search codebase" | File map + architecture fingerprint |
| mk:investigate | "debug this", "why broken" | Root cause + evidence |
| mk:docs-finder | "docs for [lib]" | Structured documentation |
| mk:multimodal | Image/video/audio file | Analysis via Gemini |
| mk:qa-manual | "test this flow" | QA report or Playwright .spec.ts |
| mk:cso | "security audit" | OWASP + STRIDE findings |
| mk:party | "decide architecture" | Multi-agent decision brief |
| mk:scale-routing | Phase 0 (automatic) | Domain complexity level |
| mk:worktree | Parallel execution setup | Isolated git worktree |
| mk:harness | "build a X from scratch" | Autonomous generator/evaluator build loop |
| mk:evaluate | Harness Phase 4 | Rubric-graded behavioral verdict with evidence |
| mk:sprint-contract | Harness FULL density | Acceptance criteria contract before sprint |
| mk:rubric | Evaluator setup | Load/compose rubric preset |
| mk:trace-analyze | Trace log available | Root cause analysis across trace spans |
| mk:benchmark | Canary testing | Quick or full canary suite with scored output |

## Planning (Phase 1)

| Command | Purpose | Ends with |
|---------|---------|-----------|
| `mk:plan-creator` | Create plan from scratch | Print & Stop |
| `mk:plan-ceo-review` | Product lens review | Print & Stop |
| `mk:plan-ceo-review` | Engineering lens review | Print & Stop |
| `/mk:cook [path]` | Begin implementation | Runs pipeline |

All three review skills stop after printing — you control when to run `/mk:cook [plan path]`.

| Command | What it does |
|---------|-------------|
| `/mk:plan "feature"` | Create plan via mk:plan-creator |
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

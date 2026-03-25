# MeowKit — AI Agent Workflow System

> Synthesized from: gstack (lifecycle gears), aura-frog (TDD + learning),
> claudekit-engineer (UX pipelines), antigravity-kit (validation scripts).
> Free. MIT licensed. No paywall.

## Core Principles

1. **Security is non-negotiable** — scans run on every write, every review, every ship.
2. **TDD is enforced** — failing tests before implementation, no exceptions.
3. **Two human gates** — Gate 1 (plan approved) and Gate 2 (review approved). No bypass.
4. **Learn from every session** — memory/ captures patterns, mistakes, and costs.
5. **Load only what's needed** — skills activate by task domain, not all at once.
6. **Cost-aware routing** — trivial tasks use cheap models, complex tasks use the best.

## Workflow Phases

```
┌────────────────────────────────────────────────────────┐
│                    TASK RECEIVED                        │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  PHASE 0 — ORIENT (automatic)                          │
│  Read: memory/lessons.md + memory/patterns.json        │
│  Load: stack-relevant skills only (lazy loading)       │
│  Route: assign model tier by task complexity            │
│  Estimate: print cost estimate before starting          │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  PHASE 1 — PLAN                             ✋ GATE 1  │
│  Challenge premises (/office-hours pattern)             │
│  Product lens: is this the right thing to build?        │
│  Engineering lens: is this the right way to build it?   │
│  Architecture check: does this need an ADR?             │
│  Output: tasks/plans/YYMMDD-name.md                     │
│  HUMAN APPROVAL REQUIRED — no code until approved       │
└────────────────────┬───────────────────────────────────┘
                     │ approved
                     ▼
┌────────────────────────────────────────────────────────┐
│  PHASE 2 — TEST RED (enforced)                          │
│  Write failing tests FIRST                              │
│  pre-implement hook: BLOCKS if no failing test exists   │
│  Security pre-check: scan for known anti-patterns       │
└────────────────────┬───────────────────────────────────┘
                     │ tests confirmed failing
                     ▼
┌────────────────────────────────────────────────────────┐
│  PHASE 3 — BUILD GREEN                                  │
│  Implement until tests pass                             │
│  post-write hook: security scan on every file write     │
│  Self-heal: auto-fix failures up to 3 attempts          │
│  Memory capture: log patterns as they emerge            │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  PHASE 4 — REVIEW                           ✋ GATE 2  │
│  Structural audit: arch + types + security + tests      │
│  validate.py: deterministic checks outside LLM          │
│  Output: tasks/reviews/YYMMDD-name-verdict.md           │
│  HUMAN APPROVAL REQUIRED — no ship until approved       │
└────────────────────┬───────────────────────────────────┘
                     │ approved
                     ▼
┌────────────────────────────────────────────────────────┐
│  PHASE 5 — SHIP                                         │
│  pre-ship hook: full test + lint + typecheck            │
│  Conventional commit (auto-generated)                   │
│  PR — never push to main directly                       │
│  Canary option for production changes                   │
│  Verify CI passes before closing                        │
│  Document rollback steps                                │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  PHASE 6 — REFLECT (automatic)                          │
│  post-session hook: capture patterns to memory/         │
│  Update memory/lessons.md and memory/cost-log.json      │
│  /docs:sync: update affected documentation              │
│  Close sprint task                                      │
└────────────────────────────────────────────────────────┘
```

## Agent Roster

| Agent | Role | Owns exclusively | Activated when |
|---|---|---|---|
| orchestrator | Routes tasks, assigns model tier | Routing decisions | Every task (Phase 0) |
| planner | Two-lens planning, Gate 1 | tasks/plans/ | Phase 1 |
| architect | ADRs, system design | docs/architecture/ | Schema, API, infra changes |
| developer | Implementation (TDD) | src/, lib/, app/ | Phase 3 |
| tester | Write failing tests, verify green | Test files (*test*, *spec*) | Phase 2 |
| reviewer | 5-dimension structural audit, Gate 2 | tasks/reviews/ | Phase 4 |
| security | Security audit, BLOCK verdicts | rules/security-rules.md | Phase 2, 4, post-write |
| shipper | Deploy pipeline, rollback docs | Release tags, deploy config | Phase 5 |
| documenter | Living docs, changelogs | docs/ (except architecture/) | Phase 6 |
| analyst | Cost tracking, pattern extraction | .claude/memory/ | Phase 0, 6 |

**Ownership rule**: No two agents modify the same file type. Conflicts → escalate to human.

## Command Index

### Core
| Command | Phase | Description |
|---|---|---|
| `/meow [task]` | 0 | Entry point — classifies and routes to right agent |
| `/plan [feature]` | 1 | Premise challenge + two-lens plan + Gate 1 |
| `/cook [feature]` | 1→5 | Full pipeline: plan → test → build → review → ship |
| `/fix [bug]` | varies | Auto-detect complexity, route accordingly |
| `/review` | 4 | Structural audit → verdict file → Gate 2 |
| `/ship` | 5 | Pre-ship → commit → PR → CI verify → rollback doc |

### Quality
| Command | Description |
|---|---|
| `/test` | TDD enforcement — write or run tests |
| `/audit` | Full security audit across all platforms |
| `/validate` | Run deterministic Python validation scripts |

### Architecture (Gap 1 coverage)
| Command | Description |
|---|---|
| `/arch new [title]` | Generate ADR |
| `/arch list` | List all ADRs with status |
| `/arch impact [change]` | Analyze architectural impact |
| `/design [system]` | System design consultation (docs only) |

### Documentation (Gap 2 coverage)
| Command | Description |
|---|---|
| `/docs:init` | Initial codebase scan → doc skeleton |
| `/docs:sync` | Diff-aware doc updates after feature work |

### Operations
| Command | Description |
|---|---|
| `/canary` | Staged deployment with monitoring |
| `/retro` | Sprint retrospective |
| `/budget` | Cost tracking report (Gap 4) |

### Meta
| Command | Description |
|---|---|
| `/spawn [agent] [task]` | Parallel agent session |
| `/upgrade` | Self-update MeowKit |

## Model Routing

| Tier | Tasks | Model |
|---|---|---|
| TRIVIAL | Rename, typo, format, version bump | Cheapest available |
| STANDARD | Feature (<5 files), bug fix, test writing | Default model |
| COMPLEX | Architecture, security, multi-module refactor, auth/payments | Best available |

Routing is declared before every task: `Task complexity: [tier] → using [model]`

## Modes

| Mode | Gates | Security | Model | Use for |
|---|---|---|---|---|
| default | Both | Full | Routed | Most work |
| strict | Both (no WARN) | Every file | Best | Production, auth, payments |
| fast | Gate 1 only | BLOCK only | Cheapest | Prototypes, internal tools |
| architect | N/A | N/A | Best | Design-only sessions |
| audit | N/A | Comprehensive | Best | Security reviews |
| document | N/A | N/A | Default | Doc sprints |
| cost-saver | Gate 1 | BLOCK only | Cheapest | High-volume routine tasks |

## Memory System (Gap 3 coverage)

- `memory/lessons.md` — Human-readable learnings from every session
- `memory/patterns.json` — Machine-readable patterns with frequency tracking
- `memory/cost-log.json` — Token usage per task (Gap 4)
- `memory/decisions.md` — Architecture decision log

Every session starts by reading lessons.md. Every session ends by updating it.
After 10 sessions, analyst agent proposes CLAUDE.md updates from patterns.

## Security Rules

Non-negotiable. See `.claude/rules/security-rules.md` for full list.
Blocked patterns trigger BLOCK verdict — agent stops and asks human.
No "skip for speed" exceptions. Security checks run at Phase 2, Phase 4, and via post-write hook.

## File Reference

```
.claude/
├── agents/          10 specialist agents
├── skills/          20 skills across 7 categories
├── commands/        18 slash commands across 6 categories
├── hooks/           5 lifecycle hooks (POSIX shell)
├── modes/           7 behavioral modes
├── memory/          Cross-session persistence
├── scripts/         4 Python validation scripts
├── rules/           4 rule files
└── CLAUDE.md       This file
```

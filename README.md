<p align="center">
  <img src="assets/banner/meowkit_banner.png" alt="MeowKit Banner" width="100%" />
</p>

<h1 align="center">MeowKit</h1>

<p align="center">
  <strong>AI agent toolkit for Claude Code &amp; Antigravity IDE</strong><br>
  42 skills &middot; 10 agents &middot; 18 commands &middot; 7 modes &middot; enforced TDD &middot; self-improving memory
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#what-it-does">What It Does</a> &middot;
  <a href="#commands">Commands</a> &middot;
  <a href="#workflow">Workflow</a> &middot;
  <a href="#skills">Skills</a> &middot;
  <a href="#architecture">Architecture</a>
</p>

---

## Why MeowKit

AI coding tools are powerful but undirected. Without structure, they skip tests, ignore security, and ship untested code. MeowKit fixes this by giving your AI agent:

- **Hard gates** that block shipping without a plan and a passing review
- **TDD enforcement** that requires failing tests before implementation
- **Security scans** on every file write, not just at review time
- **Cost-aware model routing** so trivial tasks don't burn your best model
- **Cross-session memory** that learns from corrections and accumulates patterns

Built by synthesizing the best patterns from [gstack](https://github.com/garrytan/gstack), [antigravity-kit](https://github.com/vudovn/antigravity-kit), [aura-frog](https://github.com/nguyenthienthanh/aura-frog), and [claudekit-engineer](https://claudekit.cc). Free and MIT licensed.

## Quick Start

```bash
npm create meowkit@latest
```

That's it. The CLI auto-detects your stack (Node.js, Python, Swift, Go, monorepo), asks a few questions, and generates a `.claude/` directory with everything configured.

### CLI Flags

```bash
npm create meowkit@latest -- --dry-run      # Preview without writing
npm create meowkit@latest -- --force        # Overwrite existing .claude/
npm create meowkit@latest -- --mode strict  # Skip prompts, set mode directly
npm create meowkit@latest -- --no-memory    # Disable cross-session memory
```

### Runtime Commands

```bash
npx meowkit doctor     # Check your environment
npx meowkit validate   # Verify .claude/ structure
npx meowkit budget     # View token usage report
npx meowkit memory     # View/clear session memory
npx meowkit upgrade    # Update to latest version
```

## What It Does

MeowKit installs a `.claude/` directory that Claude Code reads automatically at session start. It contains agents, skills, commands, hooks, modes, rules, and a memory system that together enforce a structured development workflow.

### The Two Gates

Every non-trivial change passes through two human approval gates:

| Gate       | When           | What it blocks                         |
| ---------- | -------------- | -------------------------------------- |
| **Gate 1** | After planning | No code written until plan is approved |
| **Gate 2** | After review   | No shipping until review passes        |

These are hard stops. No `--skip-gates` flag exists. The agent cannot self-approve.

### Model Routing

MeowKit declares complexity before every task:

| Tier     | Examples                     | Model    |
| -------- | ---------------------------- | -------- |
| Trivial  | Rename, typo, format         | Cheapest |
| Standard | Feature, bug fix, tests      | Default  |
| Complex  | Architecture, security, auth | Best     |

## Workflow

```
TASK RECEIVED
     |
     v
 PHASE 0 — ORIENT
 Read memory, load relevant skills, route model tier
     |
     v
 PHASE 1 — PLAN                          [Gate 1]
 Challenge premises, product + engineering lens
 Human approval required
     |
     v
 PHASE 2 — TEST RED
 Write failing tests first (enforced by hook)
     |
     v
 PHASE 3 — BUILD GREEN
 Implement until tests pass
 Security scan on every file write
     |
     v
 PHASE 4 — REVIEW                        [Gate 2]
 5-dimension structural audit + Python validation
 Human approval required
     |
     v
 PHASE 5 — SHIP
 Pre-ship checks, conventional commit, PR, verify CI
     |
     v
 PHASE 6 — REFLECT
 Capture learnings, update docs, close task
```

## Commands

### Core

| Command           | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `/meow [task]`    | Entry point — classifies task and routes to the right agent  |
| `/cook [feature]` | Full pipeline: plan, test, build, review, ship               |
| `/fix [bug]`      | Auto-detect complexity, route to appropriate fix strategy    |
| `/plan [feature]` | Premise challenge + structured two-lens plan                 |
| `/review`         | 5-dimension structural audit with written verdict            |
| `/ship`           | Pre-checks, conventional commit, PR, CI verify, rollback doc |

### Quality

| Command     | Description                                       |
| ----------- | ------------------------------------------------- |
| `/test`     | TDD enforcement — write or run tests              |
| `/audit`    | Full security scan across all platforms           |
| `/validate` | Run deterministic Python checks (outside the LLM) |

### Architecture

| Command             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `/arch new [title]` | Generate Architecture Decision Record           |
| `/arch list`        | List all ADRs with status                       |
| `/design [system]`  | System design consultation (docs only, no code) |

### Documentation

| Command      | Description                                           |
| ------------ | ----------------------------------------------------- |
| `/docs:init` | Scan codebase, generate documentation skeleton        |
| `/docs:sync` | Diff-aware update of affected docs after feature work |

### Operations

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `/canary`               | Staged deployment with monitoring        |
| `/retro`                | Sprint retrospective with trend tracking |
| `/budget`               | Token cost tracking report               |
| `/spawn [agent] [task]` | Launch parallel agent session            |

## Skills

MeowKit ships 42 skills across two categories:

### Sourced Skills (22)

Best-in-class skills selected from open-source repos, scored on clarity, reusability, agent empowerment, task-size coverage, and production evidence.

| Skill                 | Source          | What it does                                            |
| --------------------- | --------------- | ------------------------------------------------------- |
| careful               | gstack          | Safety guardrails for destructive commands              |
| ship                  | gstack          | Full ship pipeline: merge, test, version, PR, verify    |
| freeze                | gstack          | Directory-scoped edit restriction                       |
| review                | gstack          | Structural PR review (SQL safety, LLM trust boundaries) |
| investigate           | gstack          | Root cause debugging — no fix without understanding     |
| cso                   | gstack          | Security audit (OWASP + STRIDE + supply chain)          |
| browse                | gstack          | Headless browser at 100ms/command                       |
| qa                    | gstack          | Systematic QA with bug fixing                           |
| office-hours          | gstack          | Premise-challenging ideation session                    |
| plan-ceo-review       | gstack          | Product-lens plan review                                |
| plan-eng-review       | gstack          | Engineering-lens plan review                            |
| document-release      | gstack          | Post-ship doc sync                                      |
| retro                 | gstack          | Sprint retrospective                                    |
| cook                  | claudekit       | Single-command feature pipeline                         |
| fix                   | claudekit       | Auto-detect bug complexity and route                    |
| clean-code            | antigravity-kit | Pragmatic coding standards (SRP, DRY, KISS)             |
| lint-and-validate     | antigravity-kit | Auto-run linters after every change                     |
| vulnerability-scanner | antigravity-kit | OWASP 2025 + threat modeling                            |
| agent-detector        | aura-frog       | Auto-route tasks to right agent + model                 |
| lazy-agent-loader     | aura-frog       | On-demand agent loading for token savings               |
| workflow-orchestrator | aura-frog       | 5-phase TDD with token budgets                          |
| session-continuation  | aura-frog       | Workflow state persistence across sessions              |

Full attribution: [`.claude/skills/SKILLS_ATTRIBUTION.md`](.claude/skills/SKILLS_ATTRIBUTION.md)

### Original Skills (20)

MeowKit-native skills for planning, development, testing, review, shipping, documentation, and memory.

## Architecture

```
.claude/
├── agents/          10 specialist agents with exclusive ownership
├── skills/          42 skills (22 sourced + 20 original)
├── commands/        18 slash commands across 6 categories
├── hooks/           5 POSIX shell hooks (security scan, TDD gate, etc.)
├── modes/           7 behavioral modes (default → cost-saver)
├── memory/          Cross-session persistence (patterns, lessons, cost log)
├── scripts/         4 Python validators (no external dependencies)
└── rules/           4 rule files (TDD, security, naming, gates)

CLAUDE.md            Entry point — Claude Code reads this automatically
.meowkit.config.json Project-specific configuration
```

### Agent Roster

| Agent        | Owns                   | Activated                  |
| ------------ | ---------------------- | -------------------------- |
| orchestrator | Routing decisions      | Every task (Phase 0)       |
| planner      | `tasks/plans/`         | Phase 1                    |
| architect    | `docs/architecture/`   | Schema, API, infra changes |
| developer    | `src/`, `lib/`, `app/` | Phase 3                    |
| tester       | Test files             | Phase 2                    |
| reviewer     | `tasks/reviews/`       | Phase 4                    |
| security     | Security rules         | Phase 2, 4, every write    |
| shipper      | Release tags, deploy   | Phase 5                    |
| documenter   | `docs/`                | Phase 6                    |
| analyst      | `.claude/memory/`      | Phase 0, 6                 |

No two agents modify the same file type.

### Modes

| Mode       | Use for                    | Gates          | Security      |
| ---------- | -------------------------- | -------------- | ------------- |
| default    | Most work                  | Both           | Full          |
| strict     | Production, auth, payments | Both (no WARN) | Every file    |
| fast       | Prototypes, internal tools | Gate 1 only    | BLOCK only    |
| architect  | Design sessions            | N/A            | N/A           |
| audit      | Security reviews           | N/A            | Comprehensive |
| document   | Doc sprints                | N/A            | N/A           |
| cost-saver | High-volume routine        | Gate 1         | BLOCK only    |

### Security

Non-negotiable. Runs at Phase 2, Phase 4, and via `post-write` hook on every file write.

Blocked patterns (agent stops and asks human):

- Hardcoded secrets in source
- `any` type in TypeScript
- SQL with string interpolation
- `localStorage` for auth tokens
- `v-html` with user content
- Disabled Row Level Security
- Controllers without auth guards
- `UserDefaults` for sensitive data (Swift)

Platform-specific checklists: NestJS, Vue 3, Swift/iOS, Supabase.

### Memory System

| File                   | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `memory/lessons.md`    | Human-readable session learnings         |
| `memory/patterns.json` | Machine-readable patterns with frequency |
| `memory/cost-log.json` | Token usage per task                     |
| `memory/decisions.md`  | Architecture decision log                |

Every session reads `lessons.md` at start and updates it at end. After 10 sessions, the analyst agent proposes `CLAUDE.md` updates from accumulated patterns.

## Requirements

- Node.js 20+
- Python 3.9+ (for validation scripts, no extra packages)
- Git

## License

MIT

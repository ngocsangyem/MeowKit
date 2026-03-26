<p align="center">
  <img src="assets/banner/meowkit_banner.png" alt="MeowKit Banner" width="100%" />
</p>

<h1 align="center">MeowKit</h1>

<p align="center">
  <strong>AI agent toolkit for Claude Code</strong><br>
  30 skills &middot; 13 agents &middot; 18 commands &middot; 7 modes &middot; 10 rules &middot; 6 hooks &middot; 4-layer security
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#what-it-does">What It Does</a> &middot;
  <a href="#commands">Commands</a> &middot;
  <a href="#workflow">Workflow</a> &middot;
  <a href="#agents">Agents</a> &middot;
  <a href="#skills">Skills</a> &middot;
  <a href="#architecture">Architecture</a>
</p>

---

## Why MeowKit

AI coding tools are powerful but undirected. Without structure, they skip tests, ignore security, and ship untested code. MeowKit fixes this by giving your AI agent:

- **Hard gates** that block shipping without a plan and a passing review
- **TDD enforcement** that requires failing tests before implementation
- **Security scans** on every file write, not just at review time
- **Prompt injection defense** across 4 layers (input boundary, instruction anchoring, context isolation, output validation)
- **Cost-aware model routing** so trivial tasks don't burn your best model
- **Cross-session memory** that learns from corrections and accumulates patterns
- **Context-engineered agents** with required context declarations, failure behaviors, and ambiguity resolution

Built by synthesizing the best patterns from [gstack](https://github.com/garrytan/gstack), [antigravity-kit](https://github.com/vudovn/antigravity-kit), [aura-frog](https://github.com/nguyenthienthanh/aura-frog), and [claudekit-engineer](https://claudekit.cc). Free and MIT licensed.

## Quick Start

```bash
npm create meowkit@latest
```

The CLI auto-detects your stack (Node.js, Python, Swift, Go, monorepo), asks a few questions, and generates a `.claude/` directory with everything configured.

### CLI Flags

```bash
npm create meowkit@latest -- --dry-run      # Preview without writing
npm create meowkit@latest -- --force        # Overwrite existing .claude/
npm create meowkit@latest -- --mode strict  # Skip prompts, set mode directly
npm create meowkit@latest -- --no-memory    # Disable cross-session memory
```

### Runtime Commands

```bash
npx meowkit doctor     # Check environment (Node, Python, Git, hooks, scripts)
npx meowkit validate   # Verify .claude/ structure integrity
npx meowkit budget     # View token usage report
npx meowkit memory     # View/clear session memory
npx meowkit upgrade    # Update to latest version
```

## What It Does

MeowKit installs a `.claude/` directory that Claude Code reads automatically at session start. It contains agents, skills, commands, hooks, modes, rules, scripts, and a memory system that together enforce a structured development workflow.

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

### Plan Templates

All non-trivial tasks (> 30 min OR > 3 files) require a plan file before implementation.

| Template           | Use when                         |
| ------------------ | -------------------------------- |
| `plan-template.md` | Standard features, multi-phase   |
| `plan-quick.md`    | Small tasks (< 5 files, < 2 hr) |
| `plan-phase.md`    | Individual phase of larger plan  |

The `meow:plan-creator` skill auto-selects the right template based on task scope.

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
 Security pre-check on plan + architecture
     |
     v
 PHASE 3 — BUILD GREEN
 Implement until tests pass
 Security scan on every file write (post-write hook)
     |
     v
 PHASE 4 — REVIEW                        [Gate 2]
 5-dimension structural audit + Python validation
 Human approval required
     |
     v
 PHASE 5 — SHIP
 Pre-ship checks, conventional commit, PR, verify CI
 Rollback documentation for every ship
     |
     v
 PHASE 6 — REFLECT
 Capture learnings, update docs, failure journals, close task
```

## Commands

All commands use the `meow:` namespace prefix.

### Core

| Command                 | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `/meow:meow [task]`    | Entry point — classifies task and routes to the right agent  |
| `/meow:cook [feature]` | Full pipeline: plan, test, build, review, ship               |
| `/meow:fix [bug]`      | Auto-detect complexity, route to appropriate fix strategy    |
| `/meow:plan [feature]` | Premise challenge + structured two-lens plan                 |
| `/meow:review`         | 5-dimension structural audit with written verdict            |
| `/meow:ship`           | Pre-checks, conventional commit, PR, CI verify, rollback doc |

### Quality

| Command          | Description                                       |
| ---------------- | ------------------------------------------------- |
| `/meow:test`     | TDD enforcement — write or run tests              |
| `/meow:audit`    | Full security scan across all platforms            |
| `/meow:validate` | Run deterministic Python checks (outside the LLM) |

### Architecture

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `/meow:arch [action]`  | Generate, list, or analyze ADRs                 |
| `/meow:design [system]`| System design consultation (docs only, no code) |

### Documentation

| Command           | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `/meow:docs-init` | Scan codebase, generate documentation skeleton        |
| `/meow:docs-sync` | Diff-aware update of affected docs after feature work |

### Operations

| Command                       | Description                              |
| ----------------------------- | ---------------------------------------- |
| `/meow:canary`                | Staged deployment with monitoring        |
| `/meow:retro`                 | Sprint retrospective with trend tracking |
| `/meow:budget`                | Token cost tracking report               |
| `/meow:spawn [agent] [task]`  | Launch parallel agent session            |

## Agents

MeowKit includes 13 specialist agents, each following the [Claude Code subagent spec](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sub-agents) with YAML frontmatter, explicit tool lists, and system prompt bodies.

Every agent includes context-engineered sections:
- **Required Context** — what to load before invoking (just-in-time, not upfront)
- **Failure Behavior** — explicit escalation path when blocked (no silent failures)
- **Ambiguity Resolution** — protocol for unclear inputs (HIGH-priority agents)

| Agent          | Role                                          | Owns                   | Phase           | Model   |
| -------------- | --------------------------------------------- | ---------------------- | --------------- | ------- |
| orchestrator   | Task router, complexity classification        | Routing decisions      | 0 (Orient)      | inherit |
| planner        | Two-lens planning, Gate 1 enforcement         | `tasks/plans/`         | 1 (Plan)        | inherit |
| brainstormer   | Solution evaluation, trade-off analysis       | —                      | 1 (Plan)        | inherit |
| researcher     | Technology research, library evaluation       | —                      | 0, 1, 4         | haiku   |
| architect      | ADR generation, system design review          | `docs/architecture/`   | 1 (Plan)        | opus    |
| tester         | TDD red/green/refactor phases                 | Test files             | 2 (Test RED)    | inherit |
| security       | Security audit, BLOCK verdicts                | Security rules         | 2, 4            | inherit |
| developer      | Implementation (TDD), self-healing            | `src/`, `lib/`, `app/` | 3 (Build GREEN) | inherit |
| reviewer       | 5-dimension structural audit, Gate 2          | `tasks/reviews/`       | 4 (Review)      | inherit |
| shipper        | Ship pipeline, conventional commits, PR       | Release tags, deploy   | 5 (Ship)        | haiku   |
| documenter     | Living docs, changelogs, API doc sync         | `docs/`                | 6 (Reflect)     | haiku   |
| analyst        | Cost tracking, pattern extraction, lessons    | `.claude/memory/`      | 0, 6            | haiku   |
| journal-writer | Failure documentation, root cause analysis    | `docs/journal/`        | 6, escalations  | haiku   |

No two agents modify the same file type. Conflicts escalate to human.

Full index: [`.claude/agents/AGENTS_INDEX.md`](.claude/agents/AGENTS_INDEX.md)

## Skills

All skills use the `meow:` namespace prefix. MeowKit ships 30 skills across two categories:

### Sourced Skills (22)

Best-in-class skills selected from open-source repos, scored on clarity, reusability, agent empowerment, and production evidence.

| Skill                    | Source          | What it does                                            |
| ------------------------ | --------------- | ------------------------------------------------------- |
| `meow:careful`           | gstack          | Safety guardrails for destructive commands               |
| `meow:ship`              | gstack          | Full ship pipeline: merge, test, version, PR, verify     |
| `meow:freeze`            | gstack          | Directory-scoped edit restriction                        |
| `meow:review`            | gstack          | Structural PR review (SQL safety, LLM trust boundaries)  |
| `meow:investigate`       | gstack          | Root cause debugging — no fix without understanding      |
| `meow:cso`               | gstack          | Security audit (OWASP + STRIDE + supply chain)           |
| `meow:browse`            | gstack          | Headless browser at 100ms/command                        |
| `meow:qa`                | gstack          | Systematic QA with bug fixing                            |
| `meow:office-hours`      | gstack          | Premise-challenging ideation session                     |
| `meow:plan-ceo-review`   | gstack          | Product-lens plan review                                 |
| `meow:plan-eng-review`   | gstack          | Engineering-lens plan review                             |
| `meow:document-release`  | gstack          | Post-ship doc sync                                       |
| `meow:retro`             | gstack          | Sprint retrospective                                     |
| `meow:cook`              | claudekit       | Single-command feature pipeline                          |
| `meow:fix`               | claudekit       | Auto-detect bug complexity and route                     |
| `meow:clean-code`        | antigravity-kit | Pragmatic coding standards (SRP, DRY, KISS)              |
| `meow:lint-and-validate` | antigravity-kit | Auto-run linters after every change                      |
| `meow:vulnerability-scanner` | antigravity-kit | OWASP 2025 + threat modeling                         |
| `meow:agent-detector`    | aura-frog       | Auto-route tasks to right agent + model                  |
| `meow:lazy-agent-loader` | aura-frog       | On-demand agent loading for token savings                |
| `meow:workflow-orchestrator` | aura-frog   | 5-phase TDD with token budgets                           |
| `meow:session-continuation`  | aura-frog   | Workflow state persistence across sessions               |

### Original Skills (8)

MeowKit-native skills:

| Skill                        | What it does                                       |
| ---------------------------- | -------------------------------------------------- |
| `meow:plan-creator`          | Auto-selects plan template by task scope           |
| `meow:skill-template-secure` | Secure skill template with injection defense       |
| `meow:development`           | Code patterns, skill loading, TDD enforcement      |
| `meow:documentation`         | API sync, changelog gen, living docs               |
| `meow:memory`                | Cost tracking, pattern extraction, session capture |
| `meow:planning`              | ADR generation, plan templates, premise challenge  |
| `meow:shipping`              | Canary deploy, rollback protocol, ship pipeline    |
| `meow:testing`               | Red-green-refactor, validation scripts, visual QA  |

Full attribution: [`.claude/skills/SKILLS_ATTRIBUTION.md`](.claude/skills/SKILLS_ATTRIBUTION.md)

## Architecture

```
.claude/
├── agents/          13 specialist agents (sub-agents.md compliant)
├── skills/          30 skills with meow: namespace
├── commands/        18 slash commands across 6 categories
├── hooks/           6 POSIX shell hooks
├── modes/           7 behavioral modes (default → cost-saver)
├── memory/          Cross-session persistence (patterns, lessons, cost log)
├── scripts/         6 Python validators (stdlib only, no pip deps)
└── rules/           10 rule files + RULES_INDEX.md

CLAUDE.md            Entry point — Claude reads this at session start
.meowkit.config.json Project-specific configuration
tasks/templates/     Plan templates (plan-template, plan-quick, plan-phase)
```

### Rules

| Rule file                   | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| `security-rules.md`         | Blocked patterns: secrets, `any`, SQL injection, XSS  |
| `injection-rules.md`        | 10 prompt injection defense rules (DATA vs INSTRUCTIONS) |
| `gate-rules.md`             | Gate 1 + Gate 2 hard stops                            |
| `tdd-rules.md`              | TDD enforcement (7 rules)                             |
| `naming-rules.md`           | Per-platform naming conventions                       |
| `development-rules.md`      | File management, code quality, pre-commit, git safety |
| `orchestration-rules.md`    | Subagent delegation, file ownership                   |
| `context-ordering-rules.md` | Long content first, context before constraint         |
| `model-selection-rules.md`  | Task type → model tier routing                        |
| `output-format-rules.md`    | Response structure: what changed, why, file refs      |

### Hooks

| Hook                | When it runs          | What it does                                |
| ------------------- | --------------------- | ------------------------------------------- |
| `pre-task-check.sh` | Before any command    | Prompt injection pattern detection (PASS/WARN/BLOCK) |
| `pre-implement.sh`  | Before implementation | Blocks if no failing test exists (TDD gate) |
| `post-write.sh`     | After every file write | Security scan + destructive command detection |
| `pre-ship.sh`       | Before shipping       | Full test + lint + typecheck                |
| `cost-meter.sh`     | Per task              | Token usage tracking                        |
| `post-session.sh`   | Session end           | Capture patterns to memory                  |

### Scripts

| Script               | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `validate.py`        | Comprehensive security scan (NestJS, Vue, Swift, SQL) |
| `security-scan.py`   | Git-aware focused security scan                      |
| `checklist.py`       | Pre-ship checklist (tests, security, lint, types)    |
| `injection-audit.py` | Post-task prompt injection detection                 |
| `validate-docs.py`   | Documentation accuracy validation                    |
| `cost-report.py`     | Cost analysis with monthly aggregation               |

All scripts: Python 3.9+, stdlib only, zero pip dependencies.

### Security

4-layer prompt injection defense:

| Layer | Name                  | Implementation              |
| ----- | --------------------- | --------------------------- |
| L1    | Input Boundary        | `injection-rules.md`        |
| L2    | Instruction Anchoring | CLAUDE.md + skill templates |
| L3    | Context Isolation     | `pre-task-check.sh`         |
| L4    | Output Validation     | `injection-audit.py`        |

Plus platform-specific security scans on every file write (NestJS, Vue, Swift, Supabase) and destructive command detection for shell scripts.

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

### Memory System

| File                   | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `memory/lessons.md`    | Human-readable session learnings         |
| `memory/patterns.json` | Machine-readable patterns with frequency |
| `memory/cost-log.json` | Token usage per task                     |
| `memory/decisions.md`  | Architecture decision log                |
| `memory/security-log.md` | Prompt injection audit findings        |

Every session reads `lessons.md` at start and updates it at end. After 10 sessions, the analyst agent proposes `CLAUDE.md` updates from accumulated patterns.

## Requirements

- Node.js 20+
- Python 3.9+ (for validation scripts — stdlib only, no pip installs)
- Git

Run `npx meowkit doctor` to verify your environment.

## License

MIT

# MeowKit Architecture

> Grounded architecture model derived from actual file analysis. Every claim cites source files.
> Last verified: 2026-04-13

## System Overview

MeowKit is a prompt-engineering framework that extends Claude Code with structured workflows, quality gates, memory persistence, and 70+ domain skills. It operates through three mechanisms:

1. **Rules** (`.claude/rules/*.md`) — behavioral instructions loaded into every session
2. **Hooks** (`.claude/hooks/*.sh`, `.cjs`) — shell/Node scripts triggered by Claude Code events
3. **Skills** (`.claude/skills/meow:*/SKILL.md`) — context-loaded domain expertise activated by user intent

There is no executable runtime. MeowKit is a set of files that shape LLM behavior through prompt engineering, preventive hooks, and structured file conventions.

## Component Inventory (Verified)

| Component | Count | Location | Source |
|---|---|---|---|
| Core agents | 16 | `.claude/agents/*.md` | RT-A inventory |
| Active skills | 74 | `.claude/skills/meow:*` | RT-A inventory |
| Deprecated skills | 3 | (debug, documentation, shipping) | RT-A |
| Step-file skills | 5 | plan-creator, review, evaluate, harness, trace-analyze | RT-A |
| Skills with internal agents | 3 | jira (3), confluence (2), planning-engine (2) | RT-A |
| Hook scripts | 14 active | `.claude/hooks/` + `settings.json` | RT-A |
| Dispatch handlers | 9 active | `.claude/hooks/handlers/` + `handlers.json` | RT-A |
| Slash commands | 20 | `.claude/commands/meow/` | RT-A |
| Rules files | 16 | `.claude/rules/` | RT-A |
| Memory files | 8 active | `.claude/memory/` | RT-B |

## Execution Flow

### What Happens When a User Types a Message

```
1. [UserPromptSubmit] hooks fire (every message):
   ├── tdd-flag-detector.sh — checks for --tdd flag
   ├── conversation-summary-cache.sh — injects cached summary (≤4KB)
   └── dispatch.cjs → memory-loader.cjs — injects filtered memories (≤4KB)
                     → immediate-capture-handler.cjs — captures ##prefix messages

2. [Skill Matching] Claude Code matches user intent against SKILL.md descriptions
   ├── meow:agent-detector (autoInvoke: true) — classifies every message
   ├── meow:workflow-orchestrator (autoInvoke: true) — routes complex features
   └── Other skills — matched by description field keywords

3. [Agent Routing] Orchestrator assigns to specialist agent per phase
   ├── Phase 0: Orient (orchestrator) — load context, detect tier
   ├── Phase 1: Plan (planner) — scope-adaptive planning
   │   └── GATE 1: gate-enforcement.sh blocks Edit|Write pre-approval
   ├── Phase 2: Test (tester) — optional unless --tdd
   ├── Phase 3: Build (developer) — implementation
   ├── Phase 4: Review (reviewer + evaluator) — structural + behavioral
   │   └── GATE 2: behavioral (reviewer verdict required)
   ├── Phase 5: Ship (shipper + git-manager) — PR + deploy
   └── Phase 6: Reflect (documenter + analyst) — capture learnings

4. [Edit/Write] PreToolUse hooks fire:
   ├── gate-enforcement.sh — blocks source writes before Gate 1
   └── privacy-block.sh — blocks sensitive file reads

5. [PostToolUse Edit|Write] hooks fire:
   ├── post-write.sh — security scan
   ├── build-verify.cjs — checks compilation
   ├── loop-detection.cjs — detects repeated failures
   └── budget-tracker.cjs — tracks cost

6. [Stop] hooks fire:
   ├── pre-completion-check.sh — validates work
   ├── post-session.sh — NEEDS_CAPTURE marker + cost + model detection
   ├── conversation-summary-cache.sh — background Haiku summarization
   └── checkpoint-writer.cjs — persists state
```

Source: `.claude/settings.json` hook registrations, `.claude/hooks/handlers.json`

### Gate Enforcement

| Gate | Mechanism | Location | Bypass |
|---|---|---|---|
| Gate 1 | **Hook-based (preventive)** | `gate-enforcement.sh` on PreToolUse Edit\|Write | `/meow:fix` simple, scale-routing one-shot |
| Gate 2 | **Behavioral** | Reviewer verdict required before shipper | None |
| Active Verification | **Script-based** | `validate-verdict.sh` checks evidence/ dir | None |
| Contract | **File-based** | Contract file must exist for FULL density | MEOWKIT_HARNESS_MODE=LEAN |

Source: `.claude/rules/gate-rules.md`, `.claude/hooks/gate-enforcement.sh`

## Agent Roster (16 Core Agents)

| Agent | Model | Phase | Role |
|---|---|---|---|
| orchestrator | inherit | 0 | Task router, model tier detection |
| planner | inherit | 1 | Scope-adaptive planning, Gate 1 |
| architect | opus | 1 | ADRs, system design |
| researcher | haiku | 0, 1 | Technology research |
| brainstormer | inherit | 1 | Trade-off analysis |
| tester | inherit | 2 | Test writing |
| developer | inherit | 3 | Implementation |
| ui-ux-designer | inherit | 3 | Design systems |
| security | inherit | 2, 4 | Audit, BLOCK verdicts |
| reviewer | inherit | 4 | Structural code audit, Gate 2 |
| evaluator | inherit | 4 | Behavioral verification (running build) |
| shipper | haiku | 5 | Deploy pipeline |
| git-manager | haiku | 5 | Git operations |
| documenter | haiku | 6 | Living docs |
| analyst | haiku | 0, 6 | Cost tracking, patterns |
| journal-writer | haiku | 6 | Failure documentation |

Source: `.claude/agents/*.md` frontmatter

### Skill-Scoped Agents (7)

| Skill | Agent | Role |
|---|---|---|
| meow:jira | jira-evaluator, jira-estimator, jira-analyst | Ticket intelligence |
| meow:confluence | confluence-reader, spec-analyzer | Spec analysis |
| meow:planning-engine | tech-analyzer, planning-reporter | Sprint planning |

Source: `.claude/skills/meow:{jira,confluence,planning-engine}/agents/`

## Context & Memory System

### Memory Files (Actual State)

| File | Writer | Reader | Auto-loaded? | Format |
|---|---|---|---|---|
| `lessons.md` | post-session.sh, immediate-capture-handler.cjs | memory-loader.cjs | Yes (every turn) | YAML frontmatter blocks |
| `patterns.json` | immediate-capture-handler.cjs | memory-loader.cjs | Yes (every turn) | JSON array |
| `cost-log.json` | post-session.sh | meow:memory skill | No (manual) | JSON array (currently empty) |
| `decisions.md` | Manual | Manual | No | Freeform markdown |
| `security-log.md` | Manual / injection-audit.py | Manual | No | Log format |
| `conversation-summary.md` | conversation-summary-cache.sh | conversation-summary-cache.sh | Yes (every turn) | YAML + markdown |
| `quick-notes.md` | immediate-capture-handler.cjs | Not auto-loaded | No | Freeform list |
| `trace-log.jsonl` | append-trace.sh | meow:trace-analyze | No (manual) | JSONL |

Source: RT-B memory flow analysis

### Context Injection (Per Turn)

Every `UserPromptSubmit` injects up to ~8KB:
- **Memory** (≤4KB): 60% critical entries, 40% domain-matched. Filtered by staleness (6mo), keyword match, per-entry cap (3000 critical, 800 standard).
- **Summary** (≤4KB): Cached conversation summary from previous Stop event.
- **SessionStart** (once): project-context.md, directory tree, readiness score.

Source: `.claude/hooks/handlers/memory-loader.cjs`, `conversation-summary-cache.sh`

### Known Issues (from RT-B)

1. `preferences.md` — documented but never created (phantom feature)
2. NEEDS_CAPTURE markers — null dates treated as stale by memory-filter.cjs
3. `cost-log.json` — empty in practice (budget-state.json not generated)
4. Memory-loader — fires every turn (not once per session as docs imply)

## Harness (Autonomous Build Pipeline)

The harness (`meow:harness`) is a 7-step pipeline for green-field product builds. It implements the generator/evaluator architecture with adaptive scaffolding density.

```
Step 0: Tier Detection → MINIMAL | FULL | LEAN
Step 1: Plan → meow:plan-creator --product-level → Gate 1
Step 2: Contract → meow:sprint-contract (conditional)
Step 3: Generate → developer agent builds
Step 4: Evaluate → evaluator grades RUNNING build (evidence required)
Step 5: Ship or Iterate → PASS/FAIL/escalate (max 3 rounds)
Step 6: Run Report → audit trail
```

| Density | Model | Contract | Iterations |
|---|---|---|---|
| MINIMAL (Haiku) | Cheapest | Skip | Skip → meow:cook |
| FULL (Sonnet, Opus 4.5) | Default/Best | Required | 1-3 rounds |
| LEAN (Opus 4.6+) | Best | Optional (<5 ACs) | 0-1 rounds |

Source: `.claude/skills/meow:harness/SKILL.md`, `.claude/rules/harness-rules.md`

## Design Principles (Derived from System)

1. **Rules as behavioral enforcement** — `.claude/rules/*.md` shape LLM behavior. 16 rule files, loaded at priority order (security > injection > gates > everything else).

2. **Hooks as preventive enforcement** — Shell/Node scripts intercept Claude Code events BEFORE they execute. Gate 1 is hook-enforced; most other quality controls are behavioral.

3. **Skills as context injection** — SKILL.md files are loaded into the prompt when matched. They're not code — they're instructions + references + scripts.

4. **Human gates at every boundary** — Gate 1 (plan) and Gate 2 (review) require explicit typed human approval. No auto-approve in any mode for Gate 2.

5. **Generator ≠ Evaluator** — Separate agents, separate contexts. Self-evaluation forbidden. Evaluator must drive the running build (active verification).

6. **Memory as persistent context** — Learnings persist across sessions via `.claude/memory/`. Injected per-turn (not per-session) at ~4KB budget.

7. **Adaptive density** — Scaffolding scales inversely with model capability. Over-scaffolding capable models degrades output (dead-weight thesis).

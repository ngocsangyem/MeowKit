# MeowKit Full Red-Team Audit Plan

**Created:** 2026-03-31
**Status:** In Progress
**Mode:** --hard (sequential deep-dive, red team per batch)
**Scope:** ALL 15 agents, 60 skills, 9 hooks, 14 rules (98 items)
**Effort:** Multi-session (~8-12 hours across 11 batches)
**Risk:** Low (audit only, no code changes until fix plan approved)

---

## Overview

Full adversarial audit of every MeowKit component. Each batch is analyzed by a dedicated red-team reviewer that traces execution paths, validates agent/skill references, checks for broken handoffs, and identifies inconsistencies.

**Rules governing this audit:**
- `docs/research/sub-agents.md` — Claude Code subagent patterns
- `docs/research/lessons-build-skill.md` — Skill design best practices
- `docs/research/effective-context-engineering-for-ai-agents.md` — Context optimization
- `docs/research/context-engineering-guide.md` — Context management patterns

## Audit Checklist Per Item

Every agent/skill/hook/rule is checked against:

1. **Reference integrity** — Does it reference files/skills/agents that exist?
2. **Handoff correctness** — Does it hand off to the right next agent/phase?
3. **Schema consistency** — Do data formats match between producer and consumer?
4. **Context efficiency** — Does it load only what's needed? Token-wasteful patterns?
5. **Behavioral compliance** — Does it follow MeowKit's rules (gates, TDD, security)?
6. **Error handling** — What happens when things go wrong? Graceful degradation?
7. **Documentation accuracy** — Do VitePress docs match actual SKILL.md/agent.md behavior?

---

## Batches

| Batch | Scope | Items | Status |
|-------|-------|-------|--------|
| 1 | Core Pipeline (meow:cook + orchestration) | 5 | Pending |
| 2 | Planning & Validation | 7 | Pending |
| 3 | Testing & Building | 6 | Pending |
| 4 | Review & Security | 7 | Pending |
| 5 | Ship & Reflect | 8 | Pending |
| 6 | Fix & Debug | 5 | Pending |
| 7 | Browser & QA | 6 | Pending |
| 8 | Architecture & Collaboration | 9 | Pending |
| 9 | Meta & Infrastructure Skills | 9 | Pending |
| 10 | Frontend & Templates | 7 | Pending |
| 11 | Hooks & Rules | 23 | Pending |

---

## Batch Details

### Batch 1: Core Pipeline
**Priority:** P0 — if this is broken, everything is broken

| Item | Type | File |
|------|------|------|
| orchestrator | agent | `.claude/agents/orchestrator.md` |
| analyst | agent | `.claude/agents/analyst.md` |
| meow:cook | skill | `.claude/skills/meow:cook/SKILL.md` + references/ |
| meow:agent-detector | skill | `.claude/skills/meow:agent-detector/` |
| meow:lazy-agent-loader | skill | `.claude/skills/meow:lazy-agent-loader/` |

**Focus:** Phase 0 → Phase 6 flow, gate enforcement, memory read/write, model routing, agent dispatch.

### Batch 2: Planning & Validation
**Priority:** P0 — Gate 1 depends on this

| Item | Type |
|------|------|
| planner | agent |
| meow:plan-creator | skill |
| meow:validate-plan | skill |
| meow:office-hours | skill |
| meow:plan-ceo-review | skill |
| meow:plan-eng-review | skill |
| meow:workflow-orchestrator | skill |

**Focus:** Plan file creation, Gate 1 enforcement, bead decomposition, validation dimensions.

### Batch 3: Testing & Building
**Priority:** P0 — TDD enforcement depends on this

| Item | Type |
|------|------|
| tester | agent |
| developer | agent |
| meow:testing | skill |
| meow:development | skill |
| meow:lint-and-validate | skill |
| meow:nyquist | skill |

**Focus:** TDD flow (failing test → implementation → pass), bead processing, pre-implement hook, self-heal loop.

### Batch 4: Review & Security
**Priority:** P1 — Gate 2 depends on this

| Item | Type |
|------|------|
| reviewer | agent |
| security | agent |
| meow:review | skill (step-file) |
| meow:elicit | skill |
| meow:scout | skill |
| meow:cso | skill |
| meow:vulnerability-scanner | skill |

**Focus:** 5-dimension review, step-file execution, scout→review→elicit chain, security audit flow.

### Batch 5: Ship & Reflect
**Priority:** P1 — memory capture + shipping

| Item | Type |
|------|------|
| shipper | agent |
| documenter | agent |
| git-manager | agent |
| journal-writer | agent |
| meow:ship | skill |
| meow:shipping | skill |
| meow:documentation | skill |
| meow:document-release | skill |

**Focus:** Ship flow, commit conventions, PR creation, docs sync, memory capture enforcement, Phase 6 subagent spawning.

### Batch 6: Fix & Debug
**Priority:** P1 — meow:fix is heavily used

| Item | Type |
|------|------|
| meow:fix | skill |
| meow:debug | skill |
| meow:investigate | skill |
| meow:sequential-thinking | skill |
| meow:session-continuation | skill |

**Focus:** Fix routing (quick/standard/deep), root cause analysis, session handoff, Gate 1 bypass conditions.

### Batch 7: Browser & QA
**Priority:** P2

| Item | Type |
|------|------|
| meow:browse | skill |
| meow:agent-browser | skill |
| meow:playwright-cli | skill |
| meow:qa | skill |
| meow:qa-manual | skill |
| meow:multimodal | skill |

**Focus:** Browser automation, QA workflows, screenshot verification, Gemini API integration.

### Batch 8: Architecture & Collaboration
**Priority:** P2

| Item | Type |
|------|------|
| architect | agent |
| brainstormer | agent |
| researcher | agent |
| ui-ux-designer | agent |
| meow:party | skill |
| meow:worktree | skill |
| meow:task-queue | skill |
| meow:team-config | skill |
| meow:brainstorming | skill |

**Focus:** Multi-agent coordination, party mode, parallel execution, worktree isolation.

### Batch 9: Meta & Infrastructure Skills
**Priority:** P2

| Item | Type |
|------|------|
| meow:bootstrap | skill |
| meow:project-context | skill |
| meow:project-organization | skill |
| meow:scale-routing | skill |
| meow:skill-creator | skill |
| meow:skill-template-secure | skill |
| meow:help | skill |
| meow:freeze | skill |
| meow:careful | skill |

**Focus:** Project scaffolding, domain routing CSV, skill creation compliance, help navigation.

### Batch 10: Frontend & Reference Skills
**Priority:** P3

| Item | Type |
|------|------|
| meow:typescript | skill |
| meow:vue | skill |
| meow:angular | skill |
| meow:react-patterns | skill |
| meow:frontend-design | skill |
| meow:ui-design-system | skill |
| meow:clean-code / meow:simplify | skills |

**Focus:** Stack-specific patterns, component conventions, reference accuracy.

### Batch 11: Hooks & Rules
**Priority:** P1 — enforcement layer

**Hooks (9):**
| Hook | Event |
|------|-------|
| `post-session.sh` | Stop |
| `post-write.sh` | PostToolUse (Edit/Write) |
| `pre-implement.sh` | PreToolUse |
| `pre-ship.sh` | PreToolUse |
| `pre-task-check.sh` | PreToolUse |
| `gate-enforcement.sh` | PreToolUse |
| `privacy-block.sh` | PreToolUse |
| `project-context-loader.sh` | SessionStart |
| `cost-meter.sh` | PostToolUse |

**Rules (14):**
All `.claude/rules/*.md` files — verify each rule is enforceable, not contradicted, and referenced correctly.

---

## Execution Protocol

1. Each batch gets a dedicated red-team subagent
2. Subagent reads ALL files in the batch scope
3. Subagent traces execution paths end-to-end
4. Subagent produces findings classified as: CRITICAL / MODERATE / MINOR
5. Findings saved to `plans/reports/red-team-batch-{N}-*.md`
6. After all batches: synthesize findings into fix plan

## Fix Plan Criteria

After audit completes, create a fix plan only for:
- **CRITICAL:** Must fix before next release
- **MODERATE:** Should fix, schedule for next sprint
- **MINOR:** Note for future, no immediate action

---

## Progress Tracking

| Batch | Started | Completed | Findings |
|-------|---------|-----------|----------|
| 1 | — | — | — |
| 2 | — | — | — |
| 3 | — | — | — |
| 4 | — | — | — |
| 5 | — | — | — |
| 6 | — | — | — |
| 7 | — | — | — |
| 8 | — | — | — |
| 9 | — | — | — |
| 10 | — | — | — |
| 11 | — | — | — |

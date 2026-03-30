---
title: Changelog
description: MeowKit release history and changes.
---

# Changelog

## 1.1.0 (2026-03-30) — The Reasoning Depth Release

Focused upgrade: deeper review reasoning, resumable builds, and systematic coverage mapping. Inspired by comparative analysis of BMAD-METHOD, ClaudeKit-Engineer, Khuym Skills, and Get-Shit-Done. Theme: **improve execution reliability and reasoning quality without adding architectural complexity**.

### New Skills

- **`meow:elicit`** — Structured second-pass reasoning after review or analysis. 8 named methods (pre-mortem, inversion, red team, Socratic, first principles, constraint removal, stakeholder mapping, analogical). Auto-suggests method based on context. Optional, user-triggered. *(Source: BMAD Advanced Elicitation)*
- **`meow:validate-plan`** — 8-dimension plan quality validation (scope, acceptance criteria, dependencies, risks, architecture, test strategy, security, effort). Runs after Gate 1, before Phase 2. Auto for COMPLEX tasks, optional for STANDARD. *(Source: Khuym validation phase)*
- **`meow:nyquist`** — Test-to-requirement coverage mapping. Reads plan acceptance criteria + test files, produces gap report showing untested requirements. Named after sampling theorem — sufficient coverage prevents missed requirements. *(Source: GSD nyquist-auditor)*

### Enhanced Review Pipeline

- **Scout integration** — `meow:review` now recommends running `meow:scout` before review for complex changes (3+ files). Scouts dependents, data flow, async races, state mutations. Makes review targeted.
- **Elicitation hook** — After review verdict, users can run `meow:elicit` for deeper analysis through a named reasoning method. Appends to verdict without changing it.
- **New gotcha** — "Skipping scout on large diffs" added to review gotchas section.

### Execution Resilience

- **Beads pattern** — COMPLEX tasks (5+ files) decompose into atomic, resumable work units called beads. Each bead has acceptance criteria, file ownership, and estimated size (~150 lines). Progress tracked in `session-state/build-progress.json`. Interrupted builds resume from last completed bead. Each bead gets atomic git commit. *(Source: Khuym beads + GSD atomic commits)*
- **Bead template** — `tasks/templates/bead-template.md` for plan decomposition.
- **Planner bead decomposition** — Planner auto-decomposes COMPLEX tasks into beads.
- **Developer bead processing** — Developer processes beads sequentially with resume logic.

### Agent System

- **Subagent Status Protocol** — All subagents now report structured status: DONE, DONE_WITH_CONCERNS, BLOCKED, NEEDS_CONTEXT. Controller handling rules for each status. Added as Rule 5 in output-format-rules.md. *(Source: ClaudeKit-Engineer)*
- **Sub-agent type classification** — Support agents now have `subagent_type` in frontmatter: advisory (brainstormer, researcher, ui-ux-designer), utility (git-manager), escalation (journal-writer).
- **AGENTS_INDEX.md** — Added Type column (Core/Support), added ui-ux-designer entry, added Agent Types section.
- **SKILLS_INDEX.md** — New centralized skill registry with all 60 skills organized by phase, with owner, type, and architecture columns.

### Orchestration

- **Delegation checklist** — Pre-delegation checklist added to orchestration-rules.md: work context, plan reference, file ownership, acceptance criteria, constraints. Template + anti-patterns table. *(Source: ClaudeKit-Engineer context isolation)*

### Documentation

- **Enforcement mechanism matrix** — RULES_INDEX.md now shows: rule → mechanism (behavioral/hook/data) → override possible → exception.
- **Quick-start guide** — "Which skill do I need?" table added to agent-skill-architecture guide.
- **Updated Mermaid diagrams** — Skill activation diagram updated with new skills (validate-plan, nyquist, elicit, scout).
- **VitePress reference pages** — 3 new skill pages (elicit, validate-plan, nyquist) with Mermaid diagrams. 9 existing pages updated (agents index, reviewer, planner, developer, whats-new, workflow-phases, skills index, architecture guide).

### Deferred to v1.1.1

- Wave-based parallelization (orchestrator state machine design needed)
- Conditional Gate 3 for high-risk domains
- Step-file decomposition for plan-creator and cook
- Memory scoping by agent role
- Party mode formal specification

---

## 1.0.0 (2026-03-30) — The Disciplined Velocity Release

The biggest MeowKit update yet. 13 new capabilities inspired by deep analysis of BMAD-METHOD and ClaudeKit-Engineer. Theme: **scale throughput while maintaining absolute discipline**.

### Intelligence & Routing

- **Scale-Adaptive Intelligence** — Domain-based complexity routing at Phase 0 via `meow:scale-routing`. CSV-driven: fintech, healthcare, IoT domains auto-force COMPLEX tier. User-extensible CSV for project-specific domains.
- **Planning Depth Per Mode** — All 7 modes declare researcher count: `strict`/`architect` run 2 parallel researchers with competing approaches; `default`/`audit` run 1; `fast`/`cost-saver`/`document` skip research.
- **Navigation Help** — `/meow:help` scans project state (plans, reviews, tests, git) and recommends the next pipeline step. No guessing.

### Quality & Review

- **Multi-Layer Adversarial Review** — `meow:review` now runs 3 parallel reviewers (Blind Hunter, Edge Case Hunter, Criteria Auditor) with post-review triage. Catches 2-3x more bugs than single-pass review.
- **Anti-Rationalization Hardening** — Agents cannot downgrade complexity, minimize tests, skip security, or dismiss WARN verdicts without 3-part justification.
- **Project Context System** — `docs/project-context.md` is the agent "constitution". All agents load it at session start. Eliminates context drift.

### Collaboration & Parallelism

- **Party Mode** — `/meow:party "topic"` spawns 2-4 agents to debate architecture decisions with forced synthesis. Discussion only — no code changes during party.
- **Parallel Execution & Teams** — COMPLEX tasks with independent subtasks run up to 3 parallel agents with git worktree isolation. Integration test required after merge.

### Architecture & Enforcement

- **Step-File Architecture** — Complex skills decompose into JIT-loaded step files. Token-efficient, auditable, resumable. First skill: `meow:review` (4 steps).
- **Hook-Based Enforcement** — 3 shell hooks upgrade behavioral rules to preventive: `privacy-block.sh` (blocks sensitive reads), `gate-enforcement.sh` (blocks writes before Gate 1), `project-context-loader.sh` (auto-loads context).

### New Rules

- `scale-adaptive-rules.md` — domain routing, CSV override, Gate 1 one-shot bypass
- `step-file-rules.md` — JIT loading, no-skip, state persistence
- `parallel-execution-rules.md` — worktree isolation, max 3 agents, integration gate

### New Skills

- `meow:scale-routing` — domain-to-complexity CSV routing
- `meow:project-context` — generate/update agent constitution
- `meow:party` — multi-agent deliberation sessions
- `meow:worktree` — git worktree lifecycle management
- `meow:task-queue` — task claiming with ownership enforcement
- `meow:help` — pipeline navigation assistant
- `meow:debug` — structured debugging: reproduce → isolate → root cause → fix → verify
- `meow:simplify` — post-implementation complexity reduction (between Build and Review)
- `meow:team-config` — parallel agent team setup with ownership maps and worktrees

### Breaking changes

None. All additions are backward-compatible.

## Pre-1.0 (2026-03-29)

All pre-1.0 changes are consolidated into the 1.0.0 release above.

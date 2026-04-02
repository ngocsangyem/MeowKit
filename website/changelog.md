---
title: Changelog
description: MeowKit release history and changes.
---

# Changelog

## 1.3.4 (2026-04-02) — Hook path resolution fix

### Bug Fixes

- **all hooks** — use `$CLAUDE_PROJECT_DIR` for absolute paths in settings.json and CWD guard in all 8 scripts; fixes "No such file or directory" when CWD differs from project root

---

## 1.3.3 (2026-04-02) — The Hook Safety Release

### Bug Fixes

- **cost-meter.sh** — always exited 1 because settings.json passes no arguments; now exits 0 for missing args
- **post-write.sh** — exited 1 on empty/missing file path; now exits 0 (matches PreToolUse safety fallback pattern)
- **pre-task-check.sh** — used `exit 2` for WARN findings; Claude Code treats non-zero as error; now exits 0

---

## 1.3.2 (2026-04-01) — The Plan Quality Release

Complete redesign of `meow:plan-creator` to match/exceed ck-plan across 15 dimensions.

### Features

- **Step-file architecture** — SKILL.md (thin entry) + workflow.md + 6 step files. JIT loading.
- **Multi-file phase output** — plan.md overview (≤80 lines) + phase-XX files (12-section template each)
- **Scope challenge** — Trivial → exit, simple → fast, complex → hard. User chooses EXPANSION/HOLD/REDUCTION.
- **Plan red team** — 2 adversarial personas (Assumption Destroyer + Scope Critic) review plans before validation (hard mode)
- **Research integration** — Bounded (2 researchers, 5 calls each), findings cited in phase Key Insights, links verified
- **Sync-back** — `.plan-state.json` checkpoint enables cross-session resume
- **Critical-step tasks** — `[CRITICAL]`/`[HIGH]` todo items get dedicated Claude Tasks
- **Richer frontmatter** — description, tags, issue, blockedBy/blocks fields

### Changed

- `meow:plan-creator` SKILL.md rewritten as thin entry (v1.3.2)
- `validate-plan.py` validates multi-file plans (plan.md + phase-XX files against 12-section template)
- `planner.md` agent references step-file workflow and multi-file output
- `assets/plan-template.md` enriched with description, tags, issue, blockedBy/blocks
- `references/task-management.md` documents sync-back protocol
- `references/phase-template.md` added (12-section enforced template)
- `references/validation-questions.md` added (5-category question framework)

---

## 1.3.1 (2026-03-31) — The Red Team Depth Release

Hybrid adversarial persona system for `meow:review`.

### Features

- **Scope gate** — step-01 classifies diffs as minimal (≤3 files, ≤50 lines, no security, domain≠high) or full. Minimal runs Blind Hunter only.
- **Hybrid persona system** — Phase B: 4 adversarial persona subagents (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope Complexity Critic) run after base reviewers, informed by Phase A findings. 2-at-a-time batching.
- **Forced-finding protocol** — zero findings triggers 1 re-analysis with "look harder" prompt. Prevents rubber-stamp approvals.
- **4-level artifact verification** — Exists, Substantive, Wired, Data Flowing checks in verdict step. Catches hollow implementations, stubs, orphaned exports.
- **Red team overview guide** — `docs/guides/red-team-overview.md` documents the full system.
- **Memory patterns** — 3 red-team patterns added to `patterns.json` (scope-gate, forced-finding, hybrid-persona).

### Changed

- `meow:review` bumped to v1.2.0 (SKILL.md)
- `workflow.md` updated with Phase B step (step-02b), variable table, flow diagram
- `step-04-verdict.md` includes artifact verification section and Phase B reviewer sources
- `reviewer.md` agent updated with hybrid architecture description
- `AGENTS_INDEX.md` reviewer entry updated with persona capabilities

---

## 1.3.0 (2026-03-31) — The Integration Integrity Release

Full red-team audit: 98 components, 11 batches, 43 criticals found, 42 fixed.

### Critical Fixes

- **Hooks enforcement restored** — `gate-enforcement.sh` and `privacy-block.sh` were completely non-functional (argument mismatch). Fixed argument passing; now all 9 hooks registered and working.
- **Agent naming standardized** — 5 phantom `subagent_type` values in Task() calls mapped to real agents
- **7-phase model everywhere** — `workflow-orchestrator` migrated from 5-phase to 7-phase, Gate 2 no longer bypassable
- **Path consistency** — plan files, memory, ADRs, scripts all use canonical full paths
- **Verdict taxonomy unified** — PASS/WARN/FAIL everywhere, review dimensions aligned (Correctness/Maintainability/Performance/Security/Coverage)
- **Python venv enforced** — all scripts use `.claude/skills/.venv/bin/python3`, SessionStart warns if missing
- **pre-ship.sh guarded** — no longer runs test suite on every Bash call, only on git commit/push
- **Security BLOCK → FAIL** — security agent BLOCK verdict now automatically fails Gate 2 Security dimension

### Infrastructure

- Created `tasks/plans/`, `tasks/reviews/`, `docs/architecture/adr/`, `session-state/` directories
- Created missing templates: party prompts (agent-selector, synthesis), team-config ownership map
- Created `meow:fix/references/gotchas.md` (7 anti-patterns)
- Fixed `meow:development/references/skill-loader.md` — all 13+ broken paths corrected
- Fixed mock guidance contradiction in tester agent (unit tests may mock, integration tests must not)

### Documentation

- **`docs/contribution-rules.md`** — 10-section rules from audit findings with pre-merge checklist
- 11 detailed audit reports in `plans/reports/red-team-*`
- Honest documentation: meow:careful now states 8/30 patterns are hook-enforced (was claiming all 30)

---

## 1.2.1 (2026-03-31)

- **fix:** `meow:cook` Phase 6 (Reflect) now spawns a dedicated subagent for `meow:memory` session-capture. Previously memory write was an inline bullet point that could be skipped if session was interrupted. Now enforced as MUST-spawn, matching project-manager and docs-manager.

---

## 1.2.0 (2026-03-31) — The Memory Activation Release

Fixed the dormant memory system and enriched it with cross-framework insights from 6 agent frameworks (Khuym, GSD, Superpowers, gstack, CKE, BMAD). Theme: **activate the memory pipeline and enrich the learning format**.

### Memory Capture Pipeline

- **Fixed Stop hook** — `post-session.sh` now writes structured `NEEDS_CAPTURE` markers instead of invisible HTML comment placeholders
- **Retroactive capture** — Phase 0 processes pending markers from previous sessions (max 3 markers, 2-min budget), reconstructing learnings from `git log`
- **Live capture** — Phase 5 captures non-obvious decisions, corrections, and rejected approaches before shipping. Preserves WHY decisions were made (retroactive can only recover WHAT)

### Enriched Learning Format

- **3-category extraction** — Session learnings captured as patterns, decisions, or failures (inspired by Khuym compounding's 3-agent analysis)
- **New `patterns.json` fields** — `category` (pattern/decision/failure), `severity` (critical/standard), `applicable_when` (condition sentence). All optional, backward compatible
- **Stronger promotion criteria** — Patterns promoted to CLAUDE.md only when: frequency ≥ 3, severity = critical OR frequency ≥ 5, generalizable, saves ≥ 30 min. Human approval still required

### Consolidation

- **Consolidation rubric** — New reference with 4-branch classification: clear match (auto-merge), ambiguous (ask user), no match (create new), no durable signal (skip). Inspired by Khuym dream skill
- **Manual invocation** — Run when memory reaches thresholds: 20+ sessions, 50+ patterns, 500+ cost entries

### Documentation

- **`docs/memory-system.md`** — Comprehensive guide covering architecture, activation, session capture, pattern promotion, consolidation, schema reference, FAQ, limitations, migration
- **VitePress updates** — Rewrote memory-system guide, updated workflow-phases (Phase 0 + 5 + 6), updated analyst agent, updated memory skill reference
- **Cross-framework research** — 6 frameworks analyzed. Claude Code dream confirmed in binary (v2.1.83) but NOT officially documented — deferred for MeowKit

### Deferred to v1.3+

- `meow:dream` background consolidation (memory empty — nothing to consolidate yet)
- Git-as-memory-log pattern from CKE
- L3-L5 layered memory (vector DB) from CKE
- Automatic cross-machine memory sync

---

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

## 0.1.2 (2026-03-29)

- Interactive version selection when running `npm create meowkit@latest`
- git-manager agent for commit/push workflows
- Confirmation step before Gemini API key input

## 0.1.1 (2026-03-29)

- Exclude runtime dirs (session-state, memory, logs) from release zip and git tracking

## 0.1.0 (2026-03-29)

- Initial pre-release of MeowKit agent toolkit
- Core skill set (cook, fix, ship, review, memory, testing)
- Sequential thinking and fix diagnosis references
- prepare-release-assets script for GitHub Release packaging

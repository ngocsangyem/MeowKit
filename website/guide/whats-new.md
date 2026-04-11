---
title: What's New
description: "MeowKit release notes — latest features, improvements, and changes."
persona: A
---

# What's New

Release notes for each MeowKit version.

## Releases

### v2.3.7 — meow:chom (2026-04-12)

New `meow:chom` skill — copy-cat, replicate, or adapt features from external systems, repos, apps, or ideas into any project. 6-phase workflow (Recon → Map → Analyze → Challenge → Decision → Handoff) with hard gate, 7 challenge questions (Necessity, Stack Fit, Data Model, Dependency Cost, Effort vs Value, Blast Radius, Maintenance Burden), smart input routing (git clone for repos, web-to-markdown for URLs, multimodal for screenshots), risk scoring, and two modes (`--analyze`, `--compare`). General-purpose — works for any project, not just MeowKit.

### v2.3.6

Remove unused files

### v2.3.5 — CEO Review Layered Verification (2026-04-11)

Redesigns `meow:plan-ceo-review` as a layered verification pipeline: pre-screen gate (placeholder scan, coverage mapping), two-lens evaluation (Intent Alignment + Execution Credibility with PASS/FAIL anchors), severity tiers (BLOCKER/HIGH-LEVERAGE/POLISH), adversarial necessity per section, and append-only verdict output. Integration: plan-creator auto-suggests CEO review, harness suggests for product builds. Red-team reviewed with all 7 FAILs resolved.

### v2.3.4 — Centralized Dotenv Loading (2026-04-11)

Adds `.claude/.env` file support for all hooks and handlers. Shared `lib/load-dotenv.sh` sourced by 11 shell hooks; inline parser in `dispatch.cjs` for 8 Node.js handlers. No external dependencies. Shell exports always take precedence. Includes `.env.example` template with all 19 env vars. Release script decoupled from CLI package builds.

### v2.3.3 — The Wiring Integrity Release (2026-04-11)

5-agent parallel red-team audit of the full MeowKit harness. Fixed 7 critical breakpoints: Gate 2 NON-NEGOTIABLE violation in fast/cost-saver modes, TDD sentinel cross-session persistence, memory system silently dead on default profile, phantom agent dispatch in cook, system-wide wrong memory paths, model-detector silent failure, and missing `meowkit.config.json`. Plus 12 high-severity fixes (budget thresholds, 6 missing agents in CLAUDE.md, 8 orphaned skills indexed, HOOKS_INDEX gaps, phantom command refs, `/harness` command created) and 30 medium/low cleanup items.

### v2.3.2 — The Agent-Skills Integration Release (2026-04-11)

Integrates correctness patterns from Anthropic's agent-skills system. Adds `core-behaviors.md` (6 mandatory operating behaviors + 10 failure modes), per-skill failure catalogs for cook/plan-creator/review, phase composition contracts in CLAUDE.md, and lifecycle routing table for skill discovery via meow:help.

### [v2.3.1 — The Plan Creator Intelligence Release](/guide/whats-new/v2.3.1) (2026-04-11)

Plan-creator's biggest upgrade since v1.3.2. 4-persona red team (Security Adversary + Failure Mode Analyst), `--deep` mode with per-phase scouting, `--tdd` composable flag, standalone subcommands (`red-team`, `validate`, `archive`), enhanced validation framework with detection keywords, memory capture at Gate 1, solution design checklist. Plus ecosystem sync: 18 downstream files updated — cook passes `--deep`/`--tdd` to plan-creator, review/evaluator load `red-team-findings.md`, help lists subcommands, harness offers `--deep` for FULL density.

### [v2.3.0 — The Hook Dispatch Release](/guide/whats-new/v2.3.0) (2026-04-11)

Node.js hook dispatch system with 8 handler modules (model detection, budget tracking, checkpoint/resume, memory filtering, build verify, loop detection), cook `--verify`/`--strict` verification flags, review skeptic anchoring, structured memory with domain filtering, and tool output limits. TDD enforcement now opt-in.

### [v2.2.0 — Generator/Evaluator Harness](/guide/whats-new/v2.2.0) (2026-04-08)

Autonomous multi-hour green-field build pipeline with adaptive density, middleware layer, trace-driven meta-loop, and Phase 9 conversation summary cache.

### [v1.4.0 — The Plan Intelligence Release](/guide/whats-new/v1.4.0) (2026-04-03)

Dedicated plan red-team with CK-style adjudication, plan-specific personas, and new workflow modes.

- **Red-team extraction:** Monolithic step-04 split into steps 04-07; dedicated `step-05-red-team.md` with 7-field findings, agent adjudication, 3-option user review
- **Plan-specific personas:** 2 new personas (Assumption Destroyer + Scope Critic) adapted for plan review, not code review
- **Dynamic persona scaling:** 1-3 phases=2 personas, 4-5=3, 6+=4 (phase-count thresholds)
- **Fast-mode workflow:** Separate `workflow-fast.md` for compact path (00→03→04→07→08)
- **--parallel mode:** File ownership matrix, Execution Strategy section, parallel group hydration
- **--two mode:** 2 competing approaches + trade-off matrix; user selects before red-team
- **Auditable findings:** Red Team Review section in plan.md with disposition table

### v1.3.4 — Hook path resolution fix (2026-04-02)

- **all hooks** — use `$CLAUDE_PROJECT_DIR` for absolute paths in settings.json and CWD guard in all 8 scripts; fixes "No such file or directory" when CWD differs from project root

### v1.3.3 — The Hook Safety Release (2026-04-02)

- **cost-meter.sh** — always exited 1 (no args passed from settings.json); now exits 0
- **post-write.sh** — exited 1 on empty/missing file path; now exits 0
- **pre-task-check.sh** — used `exit 2` for warnings; now exits 0

### [v1.3.2 — The Plan Quality Release](/guide/whats-new/v1.3.2)

Complete redesign of `meow:plan-creator` driven by red-team comparison with ClaudeKit-Engineer's `ck-plan`.

- **Step-file architecture:** JIT-loaded steps replace monolithic SKILL.md
- **Multi-file output:** plan.md overview (≤80 lines) + phase-XX files (12-section template)
- **Scope challenge:** Trivial → exit, simple → fast, complex → hard + user scope input (EXPANSION/HOLD/REDUCTION)
- **Plan red team:** 2 adversarial personas review plans before validation (hard mode)
- **Research integration:** Bounded researchers, findings cited in phase Key Insights, verified links
- **Sync-back:** `.plan-state.json` checkpoint for cross-session resume
- **Critical-step tasks:** `[CRITICAL]`/`[HIGH]` todo items get own Claude Tasks

### [v1.3.1 — The Red Team Depth Release](/guide/whats-new/v1.3.1)

Hybrid adversarial persona system for `meow:review` v1.2.0.

- **Hybrid Phase A+B:** Base 3 reviewers unchanged + 4 adversarial persona passes as separate findings-informed subagents
- **Scope gate:** Minimal/full classification — trivial diffs skip personas and verification
- **Forced-finding:** Zero findings triggers re-analysis once, prevents rubber-stamp approvals
- **4-level artifact verification:** Exists → Substantive → Wired → Data Flowing in verdict step
- **Red team guide:** `docs/guides/red-team-overview.md` — end-to-end system documentation

### [v1.3.0 — The Integration Integrity Release](/guide/whats-new/v1.3.0)

Full red-team audit of 98 components (15 agents, 60 skills, 9 hooks, 14 rules).

- **42 critical fixes**: hooks, paths, agent names, phase model, verdicts, venv
- **Hooks actually enforced**: gate-enforcement + privacy-block were non-functional since v1.0.0
- **Contribution rules**: `docs/contribution-rules.md` — pre-merge checklist from audit findings
- **11 audit reports**: detailed per-batch findings in `plans/reports/`

### [v1.2.0 — The Memory Activation Release](/guide/whats-new/v1.2.0)

Fixed the dormant memory system and enriched it with cross-framework insights.

- **Session capture pipeline fixed:** Stop hook → NEEDS_CAPTURE markers → Phase 0 retroactive capture
- **3-category extraction:** Learnings captured as patterns, decisions, or failures (from Khuym compounding)
- **Enriched schema:** New `category`, `severity`, `applicable_when` fields in patterns.json
- **Consolidation rubric:** 4-branch classification (clear match/ambiguous/no match/no durable signal)
- **Stronger promotion:** Severity + ≥30 min savings required alongside frequency ≥ 3
- **Comprehensive docs:** New `memory-system.md` guide + updated VitePress pages

### [v1.1.0 — The Reasoning Depth Release](/guide/whats-new/v1.1.0)

Deeper review reasoning, resumable builds, and systematic coverage mapping.

- **3 new skills:** `meow:elicit` (structured second-pass reasoning), `meow:validate-plan` (8-dimension plan validation), `meow:nyquist` (test-to-requirement coverage mapping)
- **Enhanced review pipeline:** Scout integration + elicitation hook
- **Beads pattern:** Atomic, resumable work units for COMPLEX builds
- **Subagent Status Protocol:** DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT
- **SKILLS_INDEX.md:** Centralized registry of 60+ skills

### [v1.0.0 — The Disciplined Velocity Release](/guide/whats-new/v1.0.0)

Initial release. 13 capabilities across intelligence, quality, collaboration, and architecture.

- **Scale-adaptive routing:** Domain-based complexity detection at Phase 0
- **Hook enforcement:** Preventive shell hooks upgrade behavioral rules
- **Adversarial review:** 3 parallel reviewers with triage
- **Party mode:** Multi-agent deliberation for architecture decisions
- **Step-file architecture:** JIT-loaded steps with resumability
- **Parallel execution:** Up to 3 agents in isolated worktrees

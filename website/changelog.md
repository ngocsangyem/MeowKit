---
title: Changelog
description: MeowKit release history and changes.
---

# Changelog

## 2.3.7 (2026-04-12) — The Copy-Cat Release

New `meow:chom` skill for analyzing and replicating features from external systems, repos, apps, or ideas into any project.

### Features

- **meow:chom skill** — 6-phase workflow: Recon → Map → Analyze → Challenge (HARD GATE) → Decision → Handoff
- **Smart input routing** — auto-detects git URLs (clone + scout), web URLs (web-to-markdown/browse), local paths, freeform text (researcher WebSearch), screenshots (multimodal vision)
- **7 challenge questions** — Necessity, Stack Fit, Data Model, Dependency Cost, Effort vs Value, Blast Radius, Maintenance Burden
- **Risk scoring** — 0-2 proceed, 3-4 resolve first, 5+ reject. Hard gate between Challenge and Decision
- **Two modes** — `--analyze` (full workflow → Replication Spec) and `--compare` (analysis only → Comparison Report)
- **General-purpose** — works for any project (SaaS, mobile, CLI), not just MeowKit

### Files

- `.claude/skills/meow:chom/SKILL.md` — skill definition (119 lines)
- `.claude/skills/meow:chom/references/challenge-framework.md` — 7-question framework with risk scoring and decision matrix

## 2.3.6 (2026-04-11)

Remove unused files

## 2.3.5 (2026-04-11) — CEO Review Layered Verification

Redesigns `meow:plan-ceo-review` from single-pass deep review to layered verification pipeline. Strengthens decision quality without changing the 4-mode system.

### Features

- **Pre-screen gate (Layer 0-1)** — mode-aware placeholder scan, structural completeness check, requirements coverage mapping. Returns for amendment, never rejects.
- **Two-lens evaluation (Layer 3)** — Intent Alignment (right problem?) + Execution Credibility (buildable?). Each grades PASS/WARN/FAIL. Any FAIL → NEEDS REVISION.
- **Severity tiers** — all findings classified BLOCKER / HIGH-LEVERAGE / POLISH. Verdict: blockers > 0 → NEEDS REVISION.
- **Adversarial necessity** — each section must surface ≥1 finding or document evidence why clean. Prevents rubber-stamping.
- **Append-only output** — `## CEO Review` block appended to plan.md (never overwrites). All modes write review record.
- **Merged Failure Analysis** — Error & Rescue Map + Failure Modes Registry combined into single table with severity column.

### Integration

- **plan-creator step-08** — auto-suggests CEO review after plan creation (gated by `planning_mode`)
- **harness step-01** — suggests CEO review after product spec (NOT auto-run — CEO review is interactive)
- **SKILLS_INDEX** — description updated with layered verification

### Documentation

- Updated website skill page with pipeline diagram and verdict format
- 2 new reference files: `pre-screen.md`, `two-lens-evaluation.md`
- Red-team reviewed (RT-A: 4 FAILs, RT-B: 5 FAILs — all resolved in v2)

## 2.3.4 (2026-04-11) — Centralized Dotenv Loading

Adds project-level `.claude/.env` support so all hooks and handlers can read `MEOWKIT_*` env vars without polluting shell profiles. Red-team verified.

### Features

- **Shared dotenv loader** — `lib/load-dotenv.sh` sourced by all 11 shell hooks; no `eval`, uses `printenv` for safe key checking
- **Node.js dotenv** — inline parser in `dispatch.cjs` loads `.claude/.env` for all 8 `.cjs` handlers (zero external dependencies)
- **`.env.example` template** — all 19 documented env vars with categories (Core, Harness, Summary, Memory, Hook Controls)
- **Precedence rule** — shell `export` always wins over `.env` values (no-override semantics)

### Architecture

Each Claude Code hook runs as a **separate subprocess** — env vars exported in one hook are invisible to siblings. The fix: every hook independently sources the shared `lib/load-dotenv.sh` at startup. Node.js handlers go through `dispatch.cjs` which parses `.env` before dispatching.

### Documentation

- Updated `website/reference/configuration.md` with `.env` file section, setup instructions, and security notes
- Updated env vars reference with all 19 vars across 5 categories

### Release Script

- **Removed** CLI package builds from `release.sh` — harness releases no longer trigger CLI package builds
- Build step replaced with JSON config validation (settings.json, handlers.json, metadata.json)

## 2.3.3 (2026-04-11) — The Wiring Integrity Release

5-agent parallel red-team audit of the full MeowKit harness (agents, skills, commands, hooks). Fixed 7 critical breakpoints, 12 high-severity issues, and 30 medium/low cleanup items across 25+ files.

### Critical Fixes

- **Gate 2 NON-NEGOTIABLE violation** — `fast.md` and `cost-saver.md` modes auto-approved Gate 2 without human confirmation; now require explicit human approval (WARNs auto-acknowledged)
- **TDD sentinel persistence** — `--tdd` flag wrote sentinel to `.claude/session-state/` but session reset cleared `session-state/` at project root (different dirs); sentinel now cleared on new session
- **Memory system dead by default** — `post-session.sh` exited on `standard` profile, disabling memory capture, cost tracking, and trace records; now runs by default, opts out only on `fast`
- **Phantom agent dispatch** — `meow:cook` referenced 4 nonexistent agents (`fullstack-developer`, `code-reviewer`, `project-manager`, `docs-manager`); remapped to `developer`, `reviewer`, `documenter`
- **Memory path wrong system-wide** — CLAUDE.md + 19 skills referenced `memory/` instead of `.claude/memory/`; all paths corrected
- **Model detector silent failure** — `model-detector.cjs` guard on `ctx.hook_event_name` silently killed detection when field absent; guard removed (dispatch routing is authoritative)
- **Config file missing** — `meowkit.config.json` referenced by 4+ consumers but never existed; created with version + features object

### High-Severity Fixes

- **Budget thresholds** — code defaults $10/$25, docs said $30/$100; aligned to $30/$100, implemented `MEOWKIT_BUDGET_CAP` override
- **CLAUDE.md agents table** — added 6 missing agents (evaluator, brainstormer, researcher, journal-writer, ui-ux-designer, git-manager)
- **8 orphaned skills** — api-design, build-fix, database, decision-framework, figma, intake, jira, verify added to SKILLS_INDEX.md
- **HOOKS_INDEX.md** — documented 6 Node.js handlers + 5 state files that were invisible
- **4 phantom skill refs in commands** — `/arch`, `/audit`, `/canary`, `/ship` referenced nonexistent skills; fixed to actual skill names
- **ADR path conflict** — `/arch` command wrote to `docs/adrs/` but architect agent wrote to `docs/architecture/adr/`; unified to canonical path
- **`/harness` command** — created missing slash command for primary green-field build entry point
- **step-file-rules.md** — listed 2 step-file skills; updated to 5 (added evaluate, harness, trace-analyze)
- **TURN_GAP default** — harness-rules.md said `:-5`, code was `:-30`; docs aligned to code

### Medium/Low Cleanup

- AGENTS_INDEX counts 15→16, Failure Behavior 10→13
- SKILLS_INDEX: party dual-owner, docs-finder primary consumer note, skill-creator+worktree moved to Phase 0
- Removed deprecated `meow:documentation` reference from docs-init
- Fixed duplicate `source:` frontmatter typo in project-organization + skill-creator
- Fixed `meow:playwright-cli` missing `meow:` prefix in name field
- Fixed `meow:help` referencing `/meow:plan-creator` instead of `/meow:plan`
- Added SUPERSEDED markers to replaced shell hooks
- Fixed skill-creator bare `python3` → venv path
- RULES_INDEX: reclassified pre-implement.sh from "Hook" to "Manual Script"
- HOOKS_INDEX: privacy-block.sh 3rd matcher (Bash) documented, SubagentStart/Stop explained

### Audit Reports

5 parallel red-team reports at `plans/260411-1906-meowkit-wiring-red-team-audit/reports/`:

- RT1: Hooks & settings wiring (2C, 4H, 5M, 5L)
- RT2: Agents & phase routing (1C, 4H, 6M, 4L)
- RT3: Skills Phase 0-2 + cross-cutting (1F, 7W)
- RT4: Skills Phase 3-6 + security (4F, 9W)
- RT5: Cross-system integrity & memory (8H, 7M, 5L)

## 2.3.2 (2026-04-11) — The Agent-Skills Integration Release

Integrates correctness patterns from Anthropic's agent-skills system: 6 core operating behaviors, per-skill failure catalogs, phase composition contracts, and lifecycle-aware skill routing.

### Features

- **core-behaviors.md** — 6 mandatory operating behaviors (Surface Assumptions, Manage Confusion, Push Back, Enforce Simplicity, Scope Discipline, Verify Don't Assume) + 10 failure modes, loaded via CLAUDE.md preamble
- **failure catalogs** — per-skill Common Rationalizations + Red Flags for meow:cook, meow:plan-creator, meow:review; merged entries into meow:fix gotchas.md
- **phase composition contracts** — embedded in CLAUDE.md; documents expects/produces/breaks-if-missing per phase
- **lifecycle routing table** — task signal → phase → skill mapping in meow:agent-detector references; surfaced via meow:help

### Documentation

- Updated rules-index.md with core-behaviors.md entry (priority 6)
- Updated RULES_INDEX.md numbering (16 → 17 rules)
- Updated what's-new index

## 2.3.1 (2026-04-11) — The Plan Creator Intelligence Release

Plan-creator's biggest upgrade since v1.3.2. 4-persona red team, `--deep` mode, `--tdd` composable flag, standalone subcommands, and enhanced validation framework.

### Features

- **4-persona red team** — Security Adversary + Failure Mode Analyst added; phase-count scaling (1-3=2, 4-5=3, 6+=4)
- **red-team findings file** — separate `red-team-findings.md` with full 7-field detail, linked from plan.md summary
- **`--deep` mode** — hard pipeline + per-phase scouting with file inventory + dependency maps per phase
- **`--tdd` composable flag** — combines with any mode; injects Tests Before/Refactor/Tests After/Regression Gate into phase files
- **standalone red-team** — `/meow:plan red-team {path}` runs adversarial review on existing plans
- **standalone validate** — `/meow:plan validate {path}` runs critical question interview on existing plans
- **plan archive** — `/meow:plan archive` scans completed plans, optionally captures learnings, archives or deletes
- **enhanced validation framework** — detection keywords per category, 2-4 option format, section mapping, recording rules
- **memory capture at Gate 1** — planning decisions persisted to `lessons.md` after approval
- **solution design checklist** — 5-dimension trade-off analysis reference for Architecture/Risk sections

### Bug Fixes

- **step-03 duplicate section label** — `3i` appeared twice (Parallel + Two-Approach); renamed to `3i`/`3j`
- **phase-template wrong step reference** — hydration reference said step-05 instead of step-08
- **step-08 incomplete schema** — `.plan-state.json` missing `deep` and `product-level` as valid `planning_mode` values

### Ecosystem Sync

- **planner agent** — all 6 modes, --tdd composable, 3 subcommands, red-team-findings.md output
- **orchestrator agent** — --deep in Planning Depth table with auto-trigger conditions
- **reviewer + evaluator agents** — red-team-findings.md in Required Context
- **meow:cook** — --deep/--tdd passthrough to plan-creator; red-team-findings.md loaded at Phase 4 for reviewer
- **meow:review** — red-team-findings.md as supplementary context in step-01
- **meow:help** — 3 standalone subcommands listed
- **meow:harness** — --deep for FULL density tier
- **meow:validate-plan** — deduplication note vs plan-creator's enhanced validation
- **meow:plan-ceo-review + ** — red-team-findings.md context loading
- **meow:trace-analyze + bootstrap** — --deep mentioned for multi-module/5+ dir tasks
- **CLAUDE.md** — planner description updated, modes/subcommands line added
- **tdd-rules.md** — plan-creator --tdd composable integration note
- **gate-1-approval.md** — --deep row in cook-command table
- **SKILLS_INDEX.md** — plan-creator v1.5.0 description, 5 step-file skills in footer

### Documentation

- Updated plan-creator skill reference page with new flags, subcommands, red-team system diagram
- Created what's-new page for v2.3.1
- Updated RELEASING.md history table

## 2.3.0 (2026-04-11) — The Hook Dispatch Release

Node.js hook dispatch system with 8 handler modules, cook verification flags, review skeptic anchoring, structured memory filtering, and tool output limits. TDD enforcement now opt-in.

### Features

- **Node.js hook dispatcher** — central `dispatch.cjs` with `handlers.json` registry; parses stdin once, routes to 8 handlers across 4 lifecycle events
- **model-detector handler** — auto-detects model tier + density from SessionStart stdin `model` field; replaces `MEOWKIT_MODEL_HINT` as primary source
- **orientation-ritual handler** — resumes from checkpoint on session resume
- **build-verify handler** — compile/lint after file edits, cached by file hash (ported from shell to Node.js)
- **loop-detection handler** — warns at 4 edits, escalates at 8 (ported from shell to Node.js)
- **budget-tracker handler** — token cost estimation with $10 warn / $25 block session-level thresholds
- **auto-checkpoint handler** — crash-recovery every 20 tool calls + phase transition detection
- **memory-loader handler** — domain-filtered memory from structured lessons.md, budget-capped 4000 chars
- **checkpoint-writer handler** — sequenced checkpoint with git state + budget snapshot on Stop
- **cook --verify** — advisory browser check after review (~$1)
- **cook --strict** — full meow:evaluate after review; FAIL blocks ship (~$2-5)
- **cook --no-strict** — suppress auto-strict trigger
- **auto-strict (Rule 7)** — scale-routing level=high auto-enables --strict in cook
- **review skeptic anchoring** — re-anchor prompt injected per adversarial persona dispatch
- **structured memory** — lessons.md YAML frontmatter with two-phase domain-filtered loading
- **tool output limits** — Glob head_limit=50, Grep head_limit=20, Read offset+limit for >500 lines
- **TDD now opt-in** — via `--tdd` flag or `MEOWKIT_TDD=1`; default mode skips RED-phase gate

### Infrastructure

- **parse-stdin.cjs** — shared stdin JSON parser with path normalization
- **shared-state.cjs** — atomic JSON persistence (tmp+rename)
- **checkpoint-utils.cjs** — shared git + sequence utilities
- **memory-migrator.cjs** — migration script for legacy lessons.md to YAML frontmatter

## 2.2.2 (2026-04-10) — Homoglyph Detection Refinement

### Changed

- **meow:web-to-markdown** — `injection_detect.py` homoglyph detection now flags only mixed-script tokens (e.g., Latin + Cyrillic within a single word) instead of consecutive foreign characters. Reduces false positives on legitimate multilingual content while still catching homoglyph spoofing attempts.

## 2.2.1 (2026-04-10) — Bug Fix

### Fixed

- **meow:web-to-markdown** — `robots_cache.py` `_fetch_robots_txt()` raised `UnboundLocalError` when fetching robots.txt. A function-local `import urllib.request` shadowed the module-level `urllib.robotparser` binding, breaking `rp = urllib.robotparser.RobotFileParser()` on line 151. Hoisted `import urllib.request` to module-level imports.

## 2.2.0 (2026-04-08) — Generator/Evaluator Harness

Largest architectural addition since 1.0.0. Autonomous multi-hour build pipeline, adaptive scaffolding density per model tier, middleware layer, trace-driven meta-loop, and a conversation summary cache — without loosening any hard gates. Thesis: keep the discipline, prune the dead weight, add the harness.

### New Skills

- **meow:harness** — autonomous green-field build pipeline with generator/evaluator split, adaptive density, 3-round iteration loop, budget tracking ($30 warn / $100 block / user cap)
- **meow:sprint-contract** — file-based sprint contract negotiated between generator and evaluator before source edits begin; enforced by `gate-enforcement.sh` in FULL density
- **meow:rubric** — weighted rubric loader; reads `.claude/rubrics/`, validates weights sum to 1.0, emits criteria to evaluator
- **meow:evaluate** — behavioral grader with active verification; skeptic persona, drives running build, rejects static-analysis-only verdicts
- **meow:trace-analyze** — scatter-gather trace log analyzer; reads `.claude/memory/trace-log.jsonl`, feeds meta-improvement loop with mandatory HITL gate
- **meow:benchmark** — canary suite (quick 5-task / full 6-task tiers) for dead-weight audit baselines on model upgrades

### New Agent

- **evaluator** — skeptic persona distinct from reviewer. Drives running build, re-anchors persona per criterion, propagates FAIL verdicts hard (any rubric FAIL = overall FAIL). Self-evaluation forbidden — always runs in fresh context

### New Slash Command

- **/meow:summary** — conversation summary cache inspector. `--status` health check, `--force` re-summarize, `--clear` reset

### New Rules (2)

- **harness-rules.md** — 11 rules for generator/evaluator discipline: planner stays product-level, hard separation, sprint contract per density tier, 3-round iteration cap, adaptive density, budget thresholds, dead-weight audit mandate on model upgrade, active verification hard gate, skeptic persona reload per criterion, gates not bypassed by density override, context caching via conversation summary
- **rubric-rules.md** — 10 rules for calibration: ≥1 PASS + ≥1 FAIL anchor per rubric, weights sum to 1.0, hard-fail propagates, balanced anchor counts, alternating order (position bias), drift check on model upgrade, anti-slop anti-patterns fixed, frontend-app preset pruned to 4 rubrics, user-extensible, rubrics are DATA not INSTRUCTIONS

### New Middleware Hooks (4) + JSON-on-stdin Migration

- **post-write-build-verify.sh** — runs compile/lint on write events; blocks doom loops from propagating broken state
- **post-write-loop-detection.sh** — detects file-churn patterns (same file edited 3+ times), logs to trace store, escalates on doom-loop threshold
- **pre-completion-check.sh** — hard Stop gate; verifies active verification evidence before allowing DONE declaration; rejects bare PASS verdicts via `{"decision":"block"}` JSON
- **conversation-summary-cache.sh** — dual-event hook (Stop summarizes, UserPromptSubmit injects); Haiku-powered, secret-scrubbed, nohup background worker, throttled by size/turns/growth; writes human-editable `.claude/memory/conversation-summary.md`
- **JSON-on-stdin migration** — all 10 existing hooks migrated via shared `lib/read-hook-input.sh`. Legacy `$1` fallback preserved. Shared `lib/secret-scrub.sh` extracted

### Adaptive Density

Dead-weight thesis: every scaffold encodes an assumption about what the model cannot do; measuring is the only way to know if it's load-bearing or friction. Density auto-selected per model tier:

| Tier     | Model     | Density | What runs                                         |
| -------- | --------- | ------- | ------------------------------------------------- |
| TRIVIAL  | Haiku     | MINIMAL | Short-circuits to meow:cook                       |
| STANDARD | Sonnet    | FULL    | Contract + 1–3 iterations + context resets        |
| COMPLEX  | Opus 4.5  | FULL    | Same as Sonnet                                    |
| COMPLEX  | Opus 4.6+ | LEAN    | Single-session, contract optional, 0–1 iterations |

Override: `MEOWKIT_HARNESS_MODE=MINIMAL|FULL|LEAN`. Density never bypasses gates. Auto-detection requires `export MEOWKIT_MODEL_HINT=opus-4-6` — Claude Code does not export model env vars to hooks.

### New Infrastructure

- **Trace & memory:** `.claude/memory/trace-log.jsonl`, `.claude/memory/conversation-summary.md`
- **Rubric library:** 7 calibrated rubrics (`product-depth`, `functionality`, `design-quality`, `originality`, `code-quality`, `craft`, `ux-usability`), composition presets, gold-standard calibration set
- **Contracts & runs:** `tasks/contracts/{date}-{slug}-sprint-{N}.md`, `tasks/harness-runs/{run-id}/run.md`
- **Registry docs:** `docs/trigger-registry.md` (hook→event mapping), `docs/dead-weight-audit.md` (post-upgrade playbook), `docs/harness-runbook.md` (operational guide)
- **Hook library:** `lib/read-hook-input.sh`, `lib/secret-scrub.sh`

### New Architecture Guides

- `guide/harness-architecture` — generator/evaluator split, sprint contract lifecycle, iteration loop, density selection
- `guide/adaptive-density` — dead-weight thesis, per-tier matrix, auto-detection, override, audit
- `guide/rubric-library` — weighted rubrics, anchor balance, drift detection, composition presets
- `guide/middleware-layer` — Phase 7 hooks, Phase 9 conversation cache, throttle params, opt-out, secret-scrub pipeline
- `guide/trace-and-benchmark` — scatter-gather trace model, quick/full benchmark tiers, meta-improvement loop

### Breaking Changes

- **Hook convention migration** — hooks now read JSON on stdin via `lib/read-hook-input.sh` instead of positional `$1`. Legacy fallback preserved for existing hooks; custom hooks should migrate for forward compatibility
- **No CLI, agent, or skill syntax changes. No gates loosened.**

### Migration Notes

- `export MEOWKIT_MODEL_HINT=opus-4-6` in your shell profile if on Opus 4.6 — enables LEAN density auto-detection. Without it, Opus 4.6 users silently get FULL
- Try `/meow:harness "build me a <thing>"` for your next green-field build — handles tier selection, contract, and evaluator grading automatically
- Run `/meow:summary --status` after your first long session to verify the conversation cache is healthy
- Read the Harness Architecture guide before your first harness run — the generator/evaluator split is non-obvious and the iteration loop has a 3-round cap before human escalation

### meow:web-to-markdown skill (added 2026-04-09)

New skill for fetching arbitrary URLs as clean markdown. Slots in below `meow:docs-finder` (Context7/chub/WebSearch) as the **tier-4 fallback** for blog posts, RFCs, GitHub issues, and vendor pages not in any curated index. Built with security defenses suitable for entering untrusted external content into the agent context.

#### New Skill

- **meow:web-to-markdown** — static-by-default URL → clean markdown with SSRF guard, 6-pass injection scanner, DATA boundary wrap, fetch persistence with manifest, robots.txt cache, per-domain throttle, honest User-Agent. Optional Playwright via opt-in three-layer gate.

#### mewkit CLI

- **Schema-driven `system-deps` registry** (`packages/mewkit/src/lib/system-deps-registry.ts`) — refactored hardcoded ffmpeg/imagemagick install paths into a typed registry with allowlist enforcement. Skills declare `optional_system_deps` in their SKILL.md HTML comment; CLI parses and validates against the registry. Unknown keys → rejected. **No skill can pip-install arbitrary packages.**
- **`detectCommands: string[]`** — new optional field for multi-binary detection (e.g. ImageMagick 7+ uses `magick`, older uses `convert`). Generalized from a hardcoded special case.
- **`mewkit doctor`** — generic registry loop replaces hardcoded checks. Playwright entry has a dedicated two-probe `doctorCheck` (import + `playwright install --dry-run chromium` → reports `OK / MISSING_PACKAGE / MISSING_BINARY`).
- **`mewkit init` + `setup --system-deps`** — flat list prompt; FFmpeg / ImageMagick / Playwright + Chromium iterated from registry insertion order, default unchecked.

#### docs-finder integration

- **Tier-4 fallback** — `meow:docs-finder` invokes web-to-markdown after Context7 / chub / WebSearch all return empty or off-target results
- **`--wtm-approve` flag** — promotes web-to-markdown to **tier-1** (skips other tiers entirely; for known-untrusted-but-needed URLs)
- **`--wtm-accept-risk` cross-skill delegation gate** — mandatory flag for any skill delegating a fetch. Without it, the call falls back to curated sources

#### Hook fix (framework-wide impact)

- **`privacy-block.sh` exit code corrected** — was using `exit 1` (non-blocking per Claude Code hooks docs). Changed to `exit 2` so the hook actually blocks. Block messages moved stdout → stderr (Claude Code feeds stderr to model on exit 2). **NOTE:** Other meowkit hooks (`gate-enforcement.sh`, `pre-task-check.sh`, `pre-ship.sh`) likely have the same `exit 1` pattern — escalated as separate audit work.

#### Deferred to v2.2.0 follow-up

- **Programmatic `--approve` injection-bypass flag** — currently no programmatic recovery from injection HARD_STOP; manual user inspection of `.quarantined` file is the only path. Per-call `--approve` flag (with audit trail) deferred.
- DNS TOCTOU / rebinding mitigation (single-resolve-by-IP)
- PSL-based eTLD+1 redirect check
- Auto-cleanup TTL for `.claude/cache/web-fetches/`
- File-size modularization for files exceeding 200L (setup.ts 444L, doctor.ts 384L, fetch_as_markdown.py 415L)

## 2.1.0 (2026-04-04)

Custom statusline, dependency management, SEO, and mewkit CLI improvements.

### Custom Statusline

- **`.claude/statusline.cjs`** — 5-line ANSI status bar for Claude Code: model+tier, context usage bar with `/clear` warning at 60%/80%, active plan+phase tracking, 5h/weekly rate limits with reset countdown, token usage breakdown
- **Smart update permissions** — `mewkit init` auto-sets executable on `.cjs` files
- **Settings merge** — preserves new top-level keys (like `statusLine`) during updates

### Dependency Management

- **Install prompt during init** — asks "Install Python skill dependencies?" after project description (default: no). Installs into `.claude/skills/.venv` only
- **Per-skill requirements.txt** — walks `skills/*/scripts/requirements.txt`, merges and deduplicates with input validation
- **`mewkit setup --only=deps`** — manual re-run with smart skip (verifies already-installed)
- **`mewkit doctor` pip check** — verifies installed pip packages against expected skill dependencies
- **Security** — package name validation, path traversal prevention, 120s pip timeout, `execFileSync` array args

### mewkit CLI

- **Version picker** — shows top 4 versions + "Enter version manually..." option
- **Cross-platform Python detection** — `where` on Windows, `py` launcher support

### SEO

- Sitemap generation, robots.txt, OG/Twitter meta tags, canonical URLs

## 2.0.0 (2026-04-04) — The Leverage Release

Extracted high-leverage patterns from ECC's 38-agent ecosystem. 5 new skills, 17 reference merges, hook profiling, naming cleanup, rule relaxations.

### New Skills

- **meow:decision-framework** — operational decision architecture: classify→rules→score→escalate→communicate. 5 references + 3 domain examples (returns triage, billing ops, incident response)
- **meow:verify** — unified verification: build→lint→test→type-check→coverage in sequence. Fail-fast. Auto-detects 5 project types (JS/TS, Python, Go, Ruby, Rust)
- **meow:api-design** — REST/GraphQL patterns: resource naming, HTTP methods, status codes, pagination, versioning, rate limiting, error formats
- **meow:build-fix** — build error triage: detect language from error output, load fix references, classify fixability (auto-fix/suggest/report), chain into meow:verify. Max 3 attempts then escalate
- **meow:database** — schema design, migration patterns, query optimization. PostgreSQL primary, general patterns transferable

### Reference Merges (17 files across 10 skills)

- **meow:investigate** — `rca-method-selection.md` (5 Whys/Ishikawa/8D/Fault Tree), `rca-anti-patterns.md` ("human error" is never root cause)
- **meow:plan-creator** — `ops-metrics-design.md`, `cold-start-context-brief.md`, `plan-mutation-protocol.md`, `worked-example-stripe-billing.md`
- **meow:qa** — `browser-qa-checklist.md` (4-phase: smoke→interaction→visual→accessibility)
- **meow:agent-detector** — `token-budget-levels.md` (25/50/75/100% depth, auto-detected from user signals)
- **meow:office-hours** — `product-lens-modes.md` (Founder Review + User Journey Audit)
- **meow:typescript** — `review-checklist.md` (prioritized: CRITICAL security→HIGH types/async→MEDIUM React/perf)
- **meow:cook** — `loop-safety-protocol.md` (stall detection, cost drift, escalation triggers)
- **meow:review** — `iterative-evaluation-protocol.md` (max 3 passes for payments/auth/security)
- **meow:frontend-design** — `anti-slop-directives.md` (avoid generic gradients, default themes, AI-generated SVG)
- **meow:testing** — `e2e-best-practices.md` (Agent Browser preference, POM, flaky quarantine, metrics)

### Workflow Improvements

- **Hook runtime profiling** — `MEOW_HOOK_PROFILE` env var: `strict` (all), `standard` (default, skip cost/session), `fast` (gate + privacy only). Safety-critical hooks never skip.
- **Naming cleanup** — meow:shipping→meow:ship, meow:documentation→meow:document-release, meow:debug→meow:investigate. Redirects in place for 2 releases.
- **Mandatory simplification** — meow:cook now requires meow:simplify between Phase 3 (Build) and Phase 4 (Review)
- **Proactive learning** — new `learning-observer.sh` PostToolUse hook detects churn patterns, feeds into retroactive capture

### Rule Changes

- **MICRO-TASK TDD exemption** — non-production code <30 lines exempt from TDD if classified MICRO-TASK by orchestrator. Distinct from TRIVIAL (cosmetic-only)
- **Staged parallel mode** — alternative to strict zero-overlap: overlapping files handled sequentially, non-overlapping in parallel
- **Memory capture enhancement** — budget 2min→5min, markers 3→5, CRITICAL/SECURITY markers always processed, `--capture-all` flag

### Jira + Figma Integration

- **meow:jira** (new skill) — Jira execution via Atlassian MCP: 8 operation categories (create, search, read, update, transition, link, sprint, batch), 4-tier safety framework (safe/low/medium/high), 50+ JQL templates, custom field discovery, sprint management. Raw ticket detection guard refuses unstructured input and redirects to meow:intake.
- **meow:figma** (new skill) — Figma design analysis via Figma MCP: 3 modes (analyze/implement/tokens), 7-step Figma→code workflow, design token extraction (CSS/Tailwind/JSON), 39 API rules. Consolidated from 7 external Figma skills. Fallback: PNG export + multimodal when no Figma MCP.
- **meow:intake enhanced** — Jira metadata extraction + Figma link detection when MCPs available. Completeness scoring enhanced for Jira fields. Structured handoff to meow:jira for execution.

### Task Routing & Integration

- **meow:scale-routing enhanced** — 4-layer detection (CSV + task content + context + confidence scoring), 8 task type classifications, optional product-areas.yaml
- **meow:intake** (new skill) — tool-agnostic ticket/PRD analysis with 8-dimension completeness scoring, media fallback chain (FFmpeg→Gemini→Claude Read), injection defense, structured output. Works with Atlassian MCP, Linear, GitHub CLI, or manual paste
- **mewkit CLI** — `npx mewkit init` now prompts for optional system deps (FFmpeg, ImageMagick). `npx mewkit setup --system-deps` for deferred install. `npx mewkit doctor` reports status

### Documentation

- New guide: `docs/guides/business-workflow-patterns.md` — explains all adapted patterns and trigger points
- RULES_INDEX.md updated with v2.0 annotations for tdd-rules.md and parallel-execution-rules.md

## 1.4.0 (2026-04-03) — The Plan Intelligence Release

Dedicated plan red-team with CK-style adjudication, plan-specific personas, and new workflow modes.

### Features

- **Plan red-team extraction** — monolithic step-04 split into steps 04-07; dedicated `step-05-red-team.md` with 7-field findings (Severity/Location/Flaw/Failure Scenario/Evidence/Suggested Fix/Category), agent adjudication (Accept/Reject + rationale), 3-option user review gate (Apply all / Review each / Reject all), deduplication, severity sorting, 15-finding cap
- **Plan-specific personas** — 2 new personas in `prompts/personas/`: plan-assumption-destroyer (unvalidated scale, dependency, team, infrastructure, timeline, integration assumptions) and plan-scope-complexity-critic (YAGNI violations, over-phasing, scope creep, premature abstraction). Reference `[PHASE:SECTION]` not `[FILE:LINE]`. Security + Failure personas gated on A/B test
- **Dynamic persona scaling** — phase-count thresholds: 1-3 phases=2 personas, 4-5=3, 6+=4
- **Red Team Review section** — auditable finding table with dispositions written to plan.md after red-team completes
- **Fast-mode workflow** — separate `workflow-fast.md` for compact path (step-00 → step-03 → step-04 → step-07 → step-08). Skips research, scout, red-team, interview
- **--parallel mode** — file ownership matrix in plan.md `## Execution Strategy`, parallel group task hydration (no `addBlockedBy` within groups), max 3 groups
- **--two mode** — 2 competing approach files + trade-off matrix; user selects approach at step-04 before red-team reviews selected only

### Changed

- `meow:plan-creator` workflow expanded from 6 steps (00-05) to 9 steps (00-08)
- `meow:plan-creator` SKILL.md bumped to v1.4.0 with --parallel/--two in arguments table
- `.plan-state.json` schema bumped to v1.1 with optional `parallel_groups` and `selected_approach` fields
- `step-file-rules.md` now lists `meow:plan-creator` as step-file enabled (was only `meow:review`)
- 6 new gotchas in `references/gotchas.md`
- 2 new reference files: `parallel-mode.md`, `two-approach-mode.md`

## 1.3.4 (2026-04-02) — Hook path resolution fix

### Bug Fixes

- **all hooks** — use `$CLAUDE_PROJECT_DIR` for absolute paths in settings.json and CWD guard in all 8 scripts; fixes "No such file or directory" when CWD differs from project root

## 1.3.3 (2026-04-02) — The Hook Safety Release

### Bug Fixes

- **cost-meter.sh** — always exited 1 because settings.json passes no arguments; now exits 0 for missing args
- **post-write.sh** — exited 1 on empty/missing file path; now exits 0 (matches PreToolUse safety fallback pattern)
- **pre-task-check.sh** — used `exit 2` for WARN findings; Claude Code treats non-zero as error; now exits 0

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

## 1.2.1 (2026-03-31)

- **fix:** `meow:cook` Phase 6 (Reflect) now spawns a dedicated subagent for `meow:memory` session-capture. Previously memory write was an inline bullet point that could be skipped if session was interrupted. Now enforced as MUST-spawn, matching project-manager and docs-manager.

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

## 1.1.0 (2026-03-30) — The Reasoning Depth Release

Focused upgrade: deeper review reasoning, resumable builds, and systematic coverage mapping. Inspired by comparative analysis of BMAD-METHOD, ClaudeKit-Engineer, Khuym Skills, and Get-Shit-Done. Theme: **improve execution reliability and reasoning quality without adding architectural complexity**.

### New Skills

- **`meow:elicit`** — Structured second-pass reasoning after review or analysis. 8 named methods (pre-mortem, inversion, red team, Socratic, first principles, constraint removal, stakeholder mapping, analogical). Auto-suggests method based on context. Optional, user-triggered. _(Source: BMAD Advanced Elicitation)_
- **`meow:validate-plan`** — 8-dimension plan quality validation (scope, acceptance criteria, dependencies, risks, architecture, test strategy, security, effort). Runs after Gate 1, before Phase 2. Auto for COMPLEX tasks, optional for STANDARD. _(Source: Khuym validation phase)_
- **`meow:nyquist`** — Test-to-requirement coverage mapping. Reads plan acceptance criteria + test files, produces gap report showing untested requirements. Named after sampling theorem — sufficient coverage prevents missed requirements. _(Source: GSD nyquist-auditor)_

### Enhanced Review Pipeline

- **Scout integration** — `meow:review` now recommends running `meow:scout` before review for complex changes (3+ files). Scouts dependents, data flow, async races, state mutations. Makes review targeted.
- **Elicitation hook** — After review verdict, users can run `meow:elicit` for deeper analysis through a named reasoning method. Appends to verdict without changing it.
- **New gotcha** — "Skipping scout on large diffs" added to review gotchas section.

### Execution Resilience

- **Beads pattern** — COMPLEX tasks (5+ files) decompose into atomic, resumable work units called beads. Each bead has acceptance criteria, file ownership, and estimated size (~150 lines). Progress tracked in `session-state/build-progress.json`. Interrupted builds resume from last completed bead. Each bead gets atomic git commit. _(Source: Khuym beads + GSD atomic commits)_
- **Bead template** — `tasks/templates/bead-template.md` for plan decomposition.
- **Planner bead decomposition** — Planner auto-decomposes COMPLEX tasks into beads.
- **Developer bead processing** — Developer processes beads sequentially with resume logic.

### Agent System

- **Subagent Status Protocol** — All subagents now report structured status: DONE, DONE*WITH_CONCERNS, BLOCKED, NEEDS_CONTEXT. Controller handling rules for each status. Added as Rule 5 in output-format-rules.md. *(Source: ClaudeKit-Engineer)\_
- **Sub-agent type classification** — Support agents now have `subagent_type` in frontmatter: advisory (brainstormer, researcher, ui-ux-designer), utility (git-manager), escalation (journal-writer).
- **AGENTS_INDEX.md** — Added Type column (Core/Support), added ui-ux-designer entry, added Agent Types section.
- **SKILLS_INDEX.md** — New centralized skill registry with all 60 skills organized by phase, with owner, type, and architecture columns.

### Orchestration

- **Delegation checklist** — Pre-delegation checklist added to orchestration-rules.md: work context, plan reference, file ownership, acceptance criteria, constraints. Template + anti-patterns table. _(Source: ClaudeKit-Engineer context isolation)_

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

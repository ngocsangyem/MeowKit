---
title: What's New
description: "MeowKit release notes — latest features, improvements, and changes."
persona: A
---

# What's New

Release notes for each MeowKit version. Each entry is a 1–2 sentence summary; full per-release detail lives in the [Changelog](/changelog). Major releases also have a dedicated page (linked from the title).

To upgrade: `npx mewkit upgrade`. Fresh install: `npx mewkit init`.

## Releases

### v2.5.1 — meow:henshin (2026-04-20)

New cross-cutting skill `meow:henshin` — planning front door for wrapping existing code as agent-consumable surfaces. Adapted from `claudekit-engineer/agentize` (tier 2). Produces a **Transformation Spec** (CLI + MCP + companion skill shape) and hands off to `meow:plan-creator` → `meow:cook`. Does not build, scaffold, or publish on its own.

- 6-phase workflow: discover → inventory → capability map → HARD GATE (package name / license / ownership) → spec write → handoff.
- Boundary vs `meow:chom`: henshin is **outbound** (local code → agent surfaces); chom is **inbound** (external repo → local project). No semantic overlap.
- Writes an architectural decision record to `.claude/memory/architecture-decisions.md` with `##decision:` prefix.
- 5 references under 200 lines: `agent-centric-design`, `auth-resolution-chain`, `mcp-transports`, `monorepo-layout`, `challenge-framework`.
- Triggers on `agentize`, `henshin`, `expose as MCP`, `wrap as CLI`, `publish to npm`, `make LLM-accessible`.

### v2.5.0 — The Native Fit Release (2026-04-19)

Installed skills stop branding themselves as MeowKit and start reading like the project's own workflow — ~70 user-facing phrases rewritten across 50+ files while real infrastructure (binaries, env vars, CLI commands) stays intact. Ships the 64-skill audit cleanup: mechanical path fixes, seven collision-cluster disambiguations, memory persistence for `meow:evaluate` / `meow:benchmark` / `meow:party`, dual-orchestrator arbitration rule, and a documented frontmatter schema. [Full notes →](/guide/whats-new/v2.5.0)

- **Brand reframing** — "MeowKit's workflow" → "this workflow", "Help MeowKit get better!" → "Help improve this workflow!", `MeowKit` / `AI-assisted` table columns, and dozens of similar edits. Real `meowkit-*` binaries, `MEOWKIT_*` env vars, `npx mewkit` CLI commands, and frontmatter `source:` fields untouched.
- **Memory writes added to evaluate / benchmark / party** — verdicts, baselines, and architectural decisions now persist across sessions (`review-patterns.md`, `cost-log.json`, `decisions.md`).
- **Dual-orchestrator arbitration rule** added to `CLAUDE.md` — explicit `/meow:cook` invocation wins; `meow:workflow-orchestrator` defers. No more duplicate Gate 1 enforcement.
- **Frontmatter schema documented** — `preamble-tier`, `user-invocable`, `phase`, `trust_level`, `injection_risk` are first-class fields with defined semantics. Twenty-one skills were using `preamble-tier: 3` without a schema.
- **Collision clusters resolved** — agent-browser vs playwright-cli, intake vs jira, cook vs harness, simplify vs clean-code, docs-init vs project-context, lint-and-validate vs verify, validate-plan vs sprint-contract.
- **Citation hygiene** — `OWASP Top 10:2025` (no such release) relabeled; stale `57 font pairings` count fixed to `73`; invented BMAD pivot statistic removed; preview model IDs now carry staleness warnings.
- **`meow:workflow-orchestrator`** no longer fires on bare `"implement"` — use compound triggers (`"implement feature"`, `"build feature"`, `"complex task"`).

### v2.4.6 — meow:ship Cleanup + Design Review Checklist (2026-04-19)

`meow:ship` drops unused Codex (OpenAI CLI) integration, fixes broken bash in the preamble, and removes phantom slash-command references. `meow:review` gains a lite design-review checklist — source-level pattern detection for frontend diffs, adapted from gstack with additions from claudekit-engineer and everything-claude-code.

- New `meow:review/design-checklist.md` — six categories (AI Slop, Typography, Spacing, Interaction States, DESIGN.md Violations, Strategic Omissions) with `[HIGH]` / `[MEDIUM]` / `[LOW]` confidence tiers for grep-actionable pattern detection.
- `meow:ship` large-diff review is now Claude-only: 2 passes (structured + adversarial subagent) replacing the prior 4-pass cross-model scheme that depended on an uninstalled CLI.
- Phantom skill refs cleaned — `/qa-only`, `/plan-design-review`, `/design-review` removed from `meow:ship`; `design-review-lite` fake-skill log tag renamed to honest `"source":"ship-design-check"`; two preamble bash syntax errors fixed.

### v2.4.5 — The Thinking Skills Release (2026-04-19)

New `meow:problem-solving` skill with seven strategic-unsticking techniques, plus three diagnostic framework references added to `meow:sequential-thinking`. Clear boundary: problem-solving for "stuck on approach", sequential-thinking for "stuck on cause". [Full notes →](/guide/whats-new/v2.4.5)

- `meow:problem-solving` — simplification cascades, collision-zone thinking, meta-pattern recognition, inversion, scale game, first principles, via negativa; dispatch table routes by stuck-symptom with explicit reroute to sequential-thinking for debugging.
- `meow:sequential-thinking` gains `five-whys-plus.md` (bias guards), `scientific-method.md` (falsifiable prediction), `kepner-tregoe.md` (IS/IS-NOT matrix) — core workflow unchanged.
- Curation over absorption — audit of 39 third-party thinking frameworks landed only five; the rest stayed out by design.

### v2.4.4 — Deprecated Skill Cleanup + Brand Refresh (2026-04-19)

Three deprecated skills removed permanently. Brand assets wired into VitePress. Vercel routing fix for direct URL access.

- Removed `meow:debug`, `meow:documentation`, `meow:shipping` (superseded since v2.0.0). Dead references across skill registries, sidebar, and architecture docs cleaned up.
- Animated SVG logo + SVG favicon + regenerated raster variants + `/meow|` OG card wired into VitePress; site title hidden (logo carries the brand).
- Fixed direct URL access on Vercel (`cleanUrls: true` in `vercel.json`), homepage hero image hardcoded to `logo.png`, broken README image ref, and stale favicon cache.

### v2.4.3 — Brainstorming v2 (2026-04-18)

`meow:brainstorming` rewritten with discovery protocol, scope assessment, anti-bias pivot, and 3 new techniques (analogical-thinking, scamper, perspective-shift).

### v2.4.2 — Memory Fix (2026-04-18)

Closes the second red-team round on the memory subsystem and corrects three published-doc inaccuracies introduced during the v2.4.1 rewrite.

- Lock-acquisition uses exponential backoff + jitter — eliminates 20–40% concurrent-write drop rate.
- Shell-side secret scrubber matches JS-side patterns (Stripe keys, DB URLs); macOS BSD `sed` portability fix.
- `findMemoryDir` no longer walks into a parent project — closes data-loss risk on `mewkit memory --clear` from a nested dir.
- Auto-memory docs corrected: `memory/` directory (not `MEMORY.md` file), explicit 200-line / 25 KB cap, subagent isolation documented, and `.claude/memory/` clarified as machine-local (gitignored — not team-shared).

### v2.4.1 — Memory Simplification + Red-Team Hardening (2026-04-18)

Deletes the auto-inject memory pipeline and replaces it with on-demand topic-file reads per consumer skill. Closes all 15 findings from the memory red-team audit; most close by deletion.

- Topic-file layout: `fixes.md/json`, `review-patterns.md/json`, `architecture-decisions.md/json`, `security-notes.md` replace the `lessons.md` + `patterns.json` monolith.
- Atomic capture writes (temp-rename for all JSON), per-target-file lock derivation eliminates the dual-lock race.
- 16-pattern secret scrubber wired into the capture path — leaked secrets no longer re-enter future session context.
- `.claude/memory/*` is now gitignored — machine-local by default; downstream installs no longer inherit the dev team's learnings.

### [v2.4.0 — The Agent Constitution Release](/guide/whats-new/v2.4.0) (2026-04-18)

`docs/project-context.md` becomes the single source of truth for every agent — a 286-line constitution loaded at SessionStart by all 16 agents. Full audit cycle: 64 findings, 61 resolved, 0 regressions.

- New `meow:project-context init` command writes a TODO-filled skeleton from `templates/skeleton.md`.
- New SessionStart hook `ensure-skills-venv.sh` — idempotent bootstrap of `.claude/skills/.venv`.
- 12 SKILL.md files got real domain-specific Gotchas; 7 gate-owning skills wired to `gate-rules.md`.

### v2.3.12 — External Codebase Packing + chom v2 Rigor (2026-04-17)

New `meow:pack` skill exports an external repo as a single AI-friendly file (markdown/xml/json) via `repomix`. `meow:chom` refactored to v2 with 4 user-explicit modes (`--compare` / `--copy` / `--improve` / `--port`), speed flags, and a non-bypassable HARD GATE.

### v2.3.11 — Env Var Handling Hardening (2026-04-14)

Adopts Claude Code's native `settings.json` `env` field for team-shared defaults. Three-layer precedence: shell export > `.claude/.env` > `settings.json`. Parser fixes for quoted-with-`#` values, indented keys, and dangerous-key blocking (PATH, LD_PRELOAD, IFS, etc.).

### v2.3.10 — Jira Ticket Intelligence + Confluence & Sprint Planning (2026-04-13)

Three new capabilities for ticket workflows:

- `meow:jira` adds `evaluate` (complexity assessment), `estimate` (story points), and `analyze` (RCA) commands.
- New `meow:confluence` skill — fetches Confluence pages as markdown with gap detection (`[MISSING]` / `[VAGUE]` / `[AMBIGUOUS]` tags).
- New `meow:planning-engine` skill — codebase-aware tech review + sprint planning with deterministic dependency-graph and capacity-binning scripts.

### v2.3.9 — Memory System Hardening (2026-04-12)

Memory loader split into 3 focused modules. 4 critical security/correctness fixes (tag escape, budget split, YAML validation, per-entry caps).

- New `##decision:` / `##pattern:` / `##note:` immediate-capture prefixes auto-route to typed memory files.
- Opt-in anchored summarization (`MEOWKIT_SUMMARY_MODE=merge`) preserves earlier context across compressions.
- New `.claude/memory/preferences.md` for team-shared preferences.
- Agent readiness banner — 5-point score (CLAUDE.md, project-context, test, lint, typecheck) at session start.

### v2.3.8 — Multimodal Resilience, MiniMax & Provider Fallback (2026-04-12)

Major overhaul of `meow:multimodal` — multi-provider generation with intelligent Gemini → MiniMax → OpenRouter fallback.

- MiniMax integration: image (`image-01`), video (Hailuo 2.3, async polling), TTS (`speech-2.8-hd`, 332 voices), music (`music-2.6`).
- Document → Markdown converter with batch mode.
- `MEOWKIT_` env namespace with backward-compat fallback. API key rotation (`MEOWKIT_GEMINI_API_KEY_2/3/4`) for 4× free-tier throughput.

### v2.3.7 — meow:chom (2026-04-12)

New `meow:chom` skill — copy-cat, replicate, or adapt features from external systems. 6-phase workflow with HARD GATE before Decision; 7 challenge questions; risk scoring (0–2 proceed, 3–4 resolve first, 5+ reject).

### v2.3.6 (2026-04-11)

Removed unused files.

### v2.3.5 — CEO Review Layered Verification (2026-04-11)

Redesigns `meow:plan-ceo-review` as a layered verification pipeline. Pre-screen gate (placeholder scan, coverage mapping), two-lens evaluation (Intent Alignment + Execution Credibility), severity tiers (BLOCKER / HIGH-LEVERAGE / POLISH), append-only verdict output.

### v2.3.4 — Centralized Dotenv Loading (2026-04-11)

`.claude/.env` support for all hooks and handlers. Shared `lib/load-dotenv.sh` sourced by 11 shell hooks; inline parser in `dispatch.cjs` for 8 Node.js handlers. Zero external dependencies. Shell exports always take precedence.

### v2.3.3 — The Wiring Integrity Release (2026-04-11)

5-agent parallel red-team audit fixed 7 critical breakpoints — Gate 2 NON-NEGOTIABLE violation in fast/cost-saver modes, TDD sentinel cross-session persistence, memory system silently dead on default profile, phantom agent dispatch in cook, system-wide wrong memory paths, model-detector silent failure, and missing `meowkit.config.json`. Plus 12 high-severity fixes.

### v2.3.2 — The Agent-Skills Integration Release (2026-04-11)

Integrates correctness patterns from Anthropic's agent-skills system: `core-behaviors.md` (6 mandatory operating behaviors + 10 failure modes), per-skill failure catalogs for cook/plan-creator/review, phase composition contracts in CLAUDE.md, and lifecycle routing table.

### [v2.3.1 — The Plan Creator Intelligence Release](/guide/whats-new/v2.3.1) (2026-04-11)

Plan-creator's biggest upgrade since v1.3.2.

- 4-persona red team (Security Adversary + Failure Mode Analyst added).
- New `--deep` mode (per-phase scouting + dependency maps) and `--tdd` composable flag.
- 3 standalone subcommands: `red-team {path}`, `validate {path}`, `archive`.

### [v2.3.0 — The Hook Dispatch Release](/guide/whats-new/v2.3.0) (2026-04-11)

Node.js hook dispatch system with 8 handler modules — model detection, budget tracking, checkpoint/resume, memory filtering, build-verify, loop-detection. Cook gains `--verify` (advisory) and `--strict` (full evaluate, FAIL blocks ship). TDD enforcement now opt-in via `--tdd` or `MEOWKIT_TDD=1`.

### [v2.2.0 — Generator/Evaluator Harness](/guide/whats-new/v2.2.0) (2026-04-08)

Largest architectural addition since 1.0.0. Autonomous multi-hour green-field build pipeline with adaptive density per model tier, middleware layer, and conversation summary cache.

- 6 new harness skills (`harness`, `sprint-contract`, `rubric`, `evaluate`, `trace-analyze`, `benchmark`) + 1 fetch skill (`web-to-markdown`).
- New `evaluator` agent (skeptic persona, runs in fresh context).
- Adaptive density auto-selected per model tier — Opus 4.6+ runs LEAN; Haiku short-circuits to MINIMAL.

### [v1.4.0 — The Plan Intelligence Release](/guide/whats-new/v1.4.0) (2026-04-03)

Dedicated plan red-team with adjudication, plan-specific personas, and new workflow modes (`--parallel`, `--two`, fast).

### v1.3.4 — Hook path resolution fix (2026-04-02)

All hooks use `$CLAUDE_PROJECT_DIR` for absolute paths and CWD guard. Fixes "No such file or directory" when CWD differs from project root.

### v1.3.3 — The Hook Safety Release (2026-04-02)

Three hooks (`cost-meter.sh`, `post-write.sh`, `pre-task-check.sh`) wrongly exited non-zero on no-op or warn cases — Claude Code treats non-zero as error. All now exit 0 in those cases.

### [v1.3.2 — The Plan Quality Release](/guide/whats-new/v1.3.2) (2026-04-01)

Complete redesign of `meow:plan-creator`. Step-file architecture (JIT-loaded), multi-file phase output, scope challenge (trivial/simple/complex), 2-persona plan red team, bounded research, and `.plan-state.json` cross-session resume.

### [v1.3.1 — The Red Team Depth Release](/guide/whats-new/v1.3.1) (2026-03-31)

Hybrid adversarial persona system for `meow:review`. Phase B adds 4 persona subagents (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope Complexity Critic) informed by Phase A findings. Forced-finding protocol prevents rubber-stamping; 4-level artifact verification catches hollow implementations.

### [v1.3.0 — The Integration Integrity Release](/guide/whats-new/v1.3.0) (2026-03-31)

Full red-team audit of 98 components (15 agents, 60 skills, 9 hooks, 14 rules). 42 critical fixes — including hook enforcement (`gate-enforcement.sh` + `privacy-block.sh` were non-functional since v1.0.0), agent naming, 7-phase model migration, path consistency, and Python venv enforcement.

### v1.2.1 (2026-03-31)

`meow:cook` Phase 6 (Reflect) now spawns a dedicated subagent for `meow:memory` capture — previously was an inline bullet that could be skipped on session interruption.

### [v1.2.0 — The Memory Activation Release](/guide/whats-new/v1.2.0) (2026-03-31)

Fixed the dormant memory system and enriched it with cross-framework insights.

- Session capture pipeline fixed: Stop hook → `NEEDS_CAPTURE` markers → Phase 0 retroactive capture.
- 3-category extraction: patterns, decisions, or failures.
- Enriched `patterns.json` schema (`category`, `severity`, `applicable_when`) — backward compatible.
- Consolidation rubric — 4-branch classification (clear match / ambiguous / no match / no signal).

### [v1.1.0 — The Reasoning Depth Release](/guide/whats-new/v1.1.0) (2026-03-30)

Deeper review reasoning, resumable builds, and systematic coverage mapping.

- 3 new skills: `meow:elicit` (8 named reasoning methods), `meow:validate-plan` (8-dimension validation), `meow:nyquist` (test-to-requirement coverage mapping).
- Beads pattern — atomic, resumable work units for COMPLEX builds.
- Subagent Status Protocol — DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT.

### [v1.0.0 — The Disciplined Velocity Release](/guide/whats-new/v1.0.0) (2026-03-30)

The biggest MeowKit update yet. 13 capabilities across intelligence, quality, collaboration, and architecture.

- Scale-adaptive routing — domain-based complexity detection at Phase 0.
- Hook-based enforcement — preventive shell hooks upgrade behavioral rules.
- Multi-layer adversarial review — 3 parallel reviewers with triage.
- Party mode — multi-agent deliberation for architecture decisions.
- Step-file architecture — JIT-loaded steps with resumability.

### v0.1.x (2026-03-29)

Initial pre-release of MeowKit agent toolkit. Core skill set (`cook`, `fix`, `ship`, `review`, `memory`, `testing`), interactive version selection in `npm create meowkit@latest`, and runtime-dir exclusion from release zip.

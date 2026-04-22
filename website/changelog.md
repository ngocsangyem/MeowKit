---
title: Changelog
description: MeowKit release history and changes.
outline: [2, 3]
---

# Changelog

## Upgrade

```bash
npx mewkit upgrade
```

Fresh install: `npx mewkit init`. See [Releasing](https://github.com/ngocsangyem/MeowKit/blob/main/RELEASING.md) for the full release process. Section schema: each version uses only the relevant sections from `Highlights`, `New Skills`, `New Agents`, `New Commands`, `CLI`, `Features`, `Improvements`, `Removals`, `Bug Fixes`, `Beta`.

---

## 2.6.1 (2026-04-22) — The project-manager Release

### Highlights

New 17th core agent `project-manager` — a cross-workflow delivery tracker that aggregates plan, test, review, contract, and cost state into an evidence-based status report classified as done / in progress / blocked / not started. Ships the new `/meow:status` slash command, a new `post-phase-delegation.md` rule, and a new `pm-status-template.md` report schema. Five orchestration skills (`meow:cook`, `meow:harness`, `meow:workflow-orchestrator`, `meow:fix` complex path, `meow:worktree`) now cite the rule to delegate post-phase. Opt-out via `MEOWKIT_PM_AUTO=off`.

### New Agents

- `project-manager` — cross-workflow delivery tracker (haiku tier). Reads plan + verdicts + contracts + cost-log + git log; writes status reports co-located inside each plan dir at `{plan-dir}/status-reports/{YYMMDD}-status.md`. Backward-looking ("what's done, what's blocked") — complement, not replacement, for `meow:help` which remains forward-looking ("what's next").

### New Commands

- `/meow:status` — foreground entry point for `project-manager`. Resolves the active plan (prompts if multiple), delegates to the agent, prints the report path.

### Features

- New rule `post-phase-delegation.md` — 7-rule charter defining PM fire points, invocation form, skip conditions, orchestrator disambiguation, and the no-hook-dispatch safety property.
- New report template `tasks/templates/pm-status-template.md` — follows planner's template convention; schema edits happen in one file, not inside the agent body.
- New env var `MEOWKIT_PM_AUTO=off` — disables all silent PM fires from orchestration skills. `/meow:status` still works regardless.
- `meow:agent-detector` gains a `Delivery Status` intent (keywords: status / progress / what's done / what's blocked / delivery tracking) routing to `project-manager`, explicitly distinct from `meow:help`'s forward-looking navigation intent.

### Improvements

- Status reports are co-located with the plan they describe. Archive moves them together. No central `tasks/status-reports/` dir; each plan lazily creates its own subdir on first write.
- Harness iteration cap escalation (`step-05`) now surfaces current delivery state BEFORE the `AskUserQuestion` escalation — user sees what's done and what's blocked before deciding ship / abort.
- Parallel-execution Rule 5 appends: after the integration test passes, PM emits a merge report summarizing what each parallel branch contributed.
- Agent count: 16 → 17. Architecture `§2` counts, `§6` roster, AGENTS_INDEX, CLAUDE.md, and agent-detector routing data all synchronized.

### Bug Fixes

- `docs/meowkit-architecture.md` mermaid subgraph caption "Key Agents (16)" updated to (17); slash-commands count bumped 20 → 21.

---

## 2.6.0 (2026-04-22) — The Skills Compliance Release

### Highlights

A 7-agent audit of all 77 `meow:*` skills against Anthropic's Skill-authoring best practices, Lessons-from-building-Claude-Code, and MeowKit's own `skill-authoring-rules.md`. Ships ~220 edits across description fields, frontmatter, reference integrity, scripts, and grounding. Zero new skills, zero breaking changes, measurably cleaner routing. [Full notes →](/guide/whats-new/v2.6.0)

### Improvements

- All skill descriptions normalized to Anthropic third-person format — `meow:cook`, `meow:fix`, `meow:agent-detector`, `meow:session-continuation` rewritten out of imperative/greedy mood that cannibalized sibling routing.
- Five overlap clusters disambiguated with explicit `NOT for X (see meow:Y)` clauses — bug-fix (fix / investigate / build-fix), pipeline (cook / workflow-orchestrator / harness), browser (browse / playwright-cli / agent-browser / qa-manual), code-quality (review / clean-code / simplify / evaluate), planning (plan-creator / planning-engine). Twenty additional skills got focused exclusion clauses where latent overlap existed.
- `meow:agent-browser` 8 inter-ref cross-links flattened and `authentication.md ↔ session-management.md` circular reference broken — all 9 reference files remain directly linked one level deep from `SKILL.md`.
- New `step-file-rules.md` Rule 6 — step-file skills (`meow:review`, `meow:trace-analyze`, `meow:plan-creator`, `meow:harness`, `meow:evaluate`) formally allowed to chain `SKILL.md → step-NN.md → references/X.md` provided each step file opens with a Contents TOC.
- Seven skills that reference `.claude/skills/...` paths directly gained a `> Path convention:` note declaring `$CLAUDE_PROJECT_DIR` as the assumed cwd — `meow:rubric`, `meow:multimodal`, `meow:skill-creator`, `meow:intake`, `meow:llms`, `meow:investigate`, `meow:jira`.
- MCP prerequisite hardening for `meow:jira`, `meow:confluence`, `meow:planning-engine` — server-key assumption (`.mcp.json` key `atlassian`) documented via Gotchas without hardcoding prefixes, preserving install portability.
- Twenty-two skills renamed their trigger section to canonical `## When to Use` — previously fragmented across "When to Invoke", "When to Activate", "Trigger Conditions".
- 115 reference files over 100 lines auto-gained a `## Contents` Table of Contents via idempotent generator, safe to re-run on future drift. Original audit counted 25; actual was 116 (4.6× under-count, largely from `meow:angular`).
- Frontmatter normalization — `preamble-tier: 4` → `3` on `meow:qa` / `meow:review` / `meow:ship` (valid range is 1-3). Dead `autoInvoke` and `priority` fields deleted from four skills after grep-confirming zero readers in hooks, scripts, or CLI. `sources` → `source` singular unified across seven skills. `meow:chom` `injection_risk` bumped `low → medium` since it replicates external code into the project.
- `meow:skill-creator` compliance — now has its own `## Gotchas` section, 500-line cap matches authoritative Rule 3 (was 150), emitted template includes mandatory `## Gotchas` header so every future scaffold inherits Rule 1 compliance. `scripts/validate-skill.py` gained check 8/8 for Gotchas header presence and auto-passes step-file skills.

### Bug Fixes

- `meow:lint-and-validate` was **undiscoverable** — malformed YAML frontmatter had an unquoted colon in `Triggers onKeywords:` which corrupted parsing. Description now wraps cleanly in double quotes.
- Empty Python venv — `.claude/skills/.venv/` existed but `pip` was half-installed with no RECORD file and no `bin/pip` symlink, so all seven Python-backed skills crashed on first import. Bootstrapped via `get-pip.py --ignore-installed --no-deps`, then `npx mewkit setup --only=deps` installed the nine required packages. `npx mewkit doctor` now reports 13 PASS / 1 WARN (optional Playwright only).
- `meow:rubric/scripts/validate-rubric.sh --help` no longer crashes on macOS — added `-h`/`--help` case before arg dispatcher, which previously fell through to `basename "--help"` triggering a BSD `illegal option` error.
- Replaced non-existent `debugger` agent reference in `meow:cook`'s Phase-3 dispatch table with `developer` via `meow:investigate` — `.claude/agents/` never had a `debugger.md`.
- `<HARD-GATE>` decorative tags in `meow:cook` and `meow:fix` bodies replaced with `**HARD GATE**` bold markdown — grep against `hooks/`, `scripts/`, and the CLI confirmed zero consumers of the tag format.
- Phantom `research-01` citations removed from `meow:evaluate` (4 locations) — no such research file exists; constraints now cite Anthropic harness research honestly or declare themselves as heuristics.
- Phantom `research-02` citations removed from `meow:rubric/references/calibration-guide.md` (2), `meow:sprint-contract/SKILL.md`, `meow:sprint-contract/references/bdd-to-ac-mapping.md` (2), and `.claude/rubrics/schema.md` — same non-existence.
- `meow:multimodal` "332 system voices" unsourced count corrected to "300+ (see provider catalog)" with the MiniMax URL attached.
- `meow:react-patterns` unverifiable "45+ rules across 8 priority categories from Vercel Engineering" attribution rephrased to "curated rules drawn from framework docs and production practice".
- `meow:ui-design-system` CSV counts corrected — `colors.csv` 161 → 160, `ux-guidelines.csv` 99 → 98 (matches actual row counts).
- `meow:vulnerability-scanner` dropped time-anchored "2025 threat landscape" tagline.
- `meow:multimodal/scripts/minimax_api_client.py` magic numbers `poll_interval=10` and `max_wait=600` now carry derivation comments. `media_optimizer.py` `tokens_per_sec = 100 / 263` constants sourced to `ai.google.dev/pricing`.
- `meow:multimodal/SKILL.md` — `check_setup.py` gained the bash invocation block every other script in the file already had.
- `meow:scout` 6-agent cap now documented as an intentional exception to `parallel-execution-rules.md` Rule 2 (read-only Explore agents produce no merge-conflict risk).
- `meow:browse` gained a Gotcha for the session-scoped `$B` alias silent-fail mode.
- `meow:problem-solving` unclosed backtick at line 148 fixed.

### Migration Notes

- `npx mewkit upgrade` picks up all description changes. No user action required.
- If any custom hook was reading `autoInvoke` / `priority` frontmatter fields: they were grep-confirmed unread before deletion. If a hook outside the repo tree was silently depending on them, restore them explicitly in the affected skills.
- `preamble-tier: 4` → `3` on `meow:qa` / `meow:review` / `meow:ship` may cause tiny context-ordering shifts. Functionally identical outputs.

---

## 2.5.1 (2026-04-20) — meow:henshin

### Highlights

New cross-cutting skill `meow:henshin` — planning front door for transforming existing code into agent-consumable surfaces (CLI + MCP server + companion skill). Adapted from `claudekit-engineer/agentize` (tier 2). Produces a **Transformation Spec** and hands off to `/meow:plan-creator` → `/meow:cook` for the build. Not a builder on its own.

### New Skills

- `meow:henshin` — 6-phase planning workflow: Discover → Inventory → Capability Map → **HARD GATE** → Spec Write → Handoff. Non-bypassable human approval for package name, license, and ownership (business decisions); `--auto` and `--lean` never skip these. Writes an architectural decision record to `.claude/memory/architecture-decisions.md` with `##decision:` prefix. Ships 5 progressive-disclosure references under 200 lines each (`agent-centric-design`, `auth-resolution-chain`, `mcp-transports`, `monorepo-layout`, `challenge-framework`).
- **Boundary vs `meow:chom`** — henshin is **outbound** (local code → agent surfaces); chom is **inbound** (external repo → local project). No semantic overlap. Paste a GitHub URL into henshin and the Error Recovery section redirects to chom.
- Triggers on `agentize`, `henshin`, `expose as MCP`, `wrap as CLI`, `publish to npm`, `make LLM-accessible`, `turn into agent tool`.

### Bug Fixes

- `meow:henshin/references/mcp-transports.md` — SSE code snippet rewrote to use Express + a per-session transport map. Previous snippet mixed Hono-style `c.res` with a Node.js `ServerResponse` constructor, producing a copy-paste type error in Hono environments, plus a scope leak where a single `t` served multiple clients.
- `meow:henshin/references/monorepo-layout.md` — `commander` dependency bumped from `^12.0.0` to `^14.0.0` (current major).

### Documentation

- New per-skill reference page: [/reference/skills/henshin](/reference/skills/henshin).
- [/guide/agent-skill-architecture](/guide/agent-skill-architecture) — henshin added to the Cross-Cutting Skills and Quick-Start tables.
- [/guide/whats-new](/guide/whats-new) — v2.5.1 entry with workflow summary and boundary rationale.

---

## 2.5.0 (2026-04-19) — The Native Fit Release

### Highlights

Skills stop branding themselves and start reading like the project's own workflow. Roughly 70 user-facing phrases were rewritten across 50+ files so installed kits refer to "the project" / "this workflow" / "the kit" instead of "MeowKit's X", while real infrastructure names (binaries, env vars, CLI commands, frontmatter `source:` fields) stay intact. Ships the full 64-skill audit: mechanical cleanup, reference fixes, boundary disambiguation for seven collision clusters, and architecture wiring for memory persistence and dual-orchestrator arbitration.

### Features

- `meow:evaluate`, `meow:benchmark`, and `meow:party` now persist their outputs across sessions — verdicts to `.claude/memory/review-patterns.md`, baselines to `cost-log.json`, architectural decisions to `decisions.md`. Each writer runs `mkdir -p .claude/memory` first so the append never fails silently.
- `CLAUDE.md` gains an **Orchestrator Entry Point Rule** — explicit `/meow:cook` wins; `meow:workflow-orchestrator` defers for the rest of the session. Ends duplicate Gate 1 enforcement.
- `CLAUDE.md` gains a **Skill Frontmatter Schema** section defining `preamble-tier` (`1 | 2 | 3`), `user-invocable` (`true | false`), `phase` (`0-6 | on-demand`), `trust_level` (`kit-authored | third-party`), and `injection_risk` (`low | medium | high`). Twenty-one skills were already using `preamble-tier: 3` without a documented schema.
- `meow:careful` emits an audit-trail log entry to `.claude/memory/security-log.md` on every warn/override event (timestamp, pattern, severity, command). Log file is auto-initialized with a markdown-table header.

### Improvements

- Installed skills read as the project's own workflow — `MeowKit follows the Boil the Lake principle` → `This workflow follows the Boil the Lake principle`; `Help MeowKit get better!` → `Help improve this workflow!`; table column `MeowKit` → `AI-assisted`; dozens of similar edits. See the [What's New page](/guide/whats-new/v2.5.0) for the full pattern list.
- Seven collision clusters disambiguated — each pair now declares `use when` + `use <other> instead when` at the top of both skills; no more buried routing rules.
- `NOT this skill if:` differentiators added to the reasoning cluster (`meow:elicit`, `meow:brainstorming`, `meow:problem-solving`).
- `meow:workflow-orchestrator` bare `"implement"` trigger replaced with `"implement feature"` — no longer fires `autoInvoke:true` on trivial requests.
- `meow:ship/references/preamble.md` declares a memory-read of `.claude/memory/architecture-decisions.md` at task start. Previously the memory reference existed in frontmatter without a body instruction.
- `meow:review` and `meow:ship` look up plans from `.claude/plans/` and `tasks/plans/` first; `~/.claude/plans/` is retained only as a legacy fallback with an explanatory comment.
- `meow:cook` intent-detection table carries a green-field escalation callout pointing at `meow:harness`.
- `meow:help` documents the `/meow:plan` alias — confirmed via the slash-command router at `.claude/commands/meow/plan.md`.
- `meow:docs-finder` documents Node.js 18+ as a prerequisite for its `.js` scripts and flags unbounded `.claude/memory/docs-cache/` growth in Gotchas.
- `meow:investigate` Process step 4 clarifies the freeze hook is a no-op without an explicit `meow:freeze <target-dir>` invocation.
- `meow:benchmark/SKILL.md` accurately describes `run-canary.sh` as a step-1-of-2 manifest emitter (not a suite runner); `compare-runs.sh` distinguishes `null` scores (PENDING, excluded from averages) from valid `0` scores.
- `meow:jira` description narrowed from CRUD + evaluation to CRUD only — ticket analysis now routes to `meow:intake`.
- `meow:scale-routing` marked `user-invocable: false` — it's a Phase 0 sub-skill, not a user-facing entry point.
- `meow:party` removes `retro` from its triggers with a pointer to `meow:retro` for dedicated retrospectives.
- Six skills gained `phase: on-demand` frontmatter (`chom`, `clean-code`, `docs-finder`, `docs-init`, `lint-and-validate`, `multimodal`); `meow:jira` corrected from `phase: 3` → `phase: on-demand`.
- Antigravity-kit-sourced skills (`clean-code`, `lint-and-validate`) gained `trust_level: third-party` + `injection_risk: low` provenance markers.
- 34 hardcoded `/Users/sangnguyen/Desktop/compare-kit/...` lines stripped from 10 `meow:angular/references/*.md` files — source-import metadata with zero runtime value.

### Removals

- Dead `Codex Review | /codex review` table row removed from 6 shared-protocol tables (`meow:browse`, `meow:document-release`, `meow:investigate`, `meow:office-hours`, `meow:plan-ceo-review`, `meow:retro`) — `/codex review` referenced the OpenAI Codex CLI, not a meowkit skill.
- `claudekit-engineer` provenance prose genericized in body HTML comments, script file headers, and reference attributions. Frontmatter `source: claudekit-engineer` fields are policy-preserved.

### Bug Fixes

- `meow:careful` FLUSHDB severity aligned — `destructive-patterns.md` said HIGH, `check-careful.sh` enforced CRITICAL. Both now say CRITICAL.
- `meow:ui-design-system` — `57 font pairings` count fixed to `73` (CSV has 73 data rows; documented count had drifted 28%).
- `meow:brainstorming` — invented `BMAD's ~10% pivot frequency` statistic removed (no source document existed).
- `meow:vulnerability-scanner` — fabricated `OWASP Top 10:2025` version label relabeled to `OWASP Top 10 (2021 ranking, 2025 threat context)` with a disclaimer. No official 2025 release exists as of April 2026.
- `meow:multimodal` — `gemini-3.1-*` and `veo-3.1-*` preview model IDs now carry a verify-before-deploy warning pointing at the Gemini model docs.
- `meow:scout` and `meow:docs-finder` — `P1-P8` / `P1-P14` citations removed from Anthropic context-engineering-research attributions (neither research doc uses those labels).

### Migration Notes

- `meow:workflow-orchestrator` no longer fires on bare `"implement"` — use compound triggers (`"implement feature"`, `"build feature"`, `"create feature"`, `"complex task"`) or invoke `/meow:cook` explicitly.
- `meow:party` memory write is now mandatory, not optional. Decision records land in `.claude/memory/decisions.md`. If a shell blocks writes to `.claude/memory/`, whitelist the directory before invoking party.
- Upgrade: `npx mewkit upgrade`. Fresh install: `npx mewkit init`. Existing `.claude/memory/` topic files are preserved; new writers `mkdir -p` safely if a parent directory is missing.

---

## 2.4.6 (2026-04-19) — meow:ship Cleanup + Design Review Checklist

### Highlights

`meow:ship` drops its unused Codex (OpenAI CLI) integration, fixes broken bash in the preamble, and removes phantom slash-command references. `meow:review` gains a lite design-review checklist — source-level pattern detection for frontend diffs, adapted from gstack with additions from claudekit-engineer (Strategic Omissions, Fix Priority Order) and everything-claude-code (anti-template patterns).

### Improvements

- `meow:review/design-checklist.md` — new lite design-review reference with six categories (AI Slop Detection, Typography, Spacing & Layout, Interaction States, DESIGN.md Violations, Strategic Omissions) and a three-tier confidence system (`[HIGH]` / `[MEDIUM]` / `[LOW]`) for grep-actionable pattern detection.
- `meow:ship` large-diff adversarial review is now Claude-only — two passes (Claude structured + Claude adversarial subagent) replace the prior four-pass cross-model scheme that depended on an uninstalled external CLI.
- `meow:ship` and `meow:review` Gotchas sections document the scope-gated frontend trigger on the design check and the source-pattern-only limitation (no visual rendering).

### Removals

- Codex (OpenAI CLI) integration removed from `meow:ship` — `codex exec`, `codex review`, and `which codex` guards dropped across five reference files. Claude adversarial subagent was already the runtime fallback.
- Phantom slash-command references removed from `meow:ship` — `/qa-only`, `/plan-design-review`, and `/design-review` (none exist as meowkit skills). The plan-verification step now emits a post-ship reminder to run `/meow:qa` against the deployed build instead of attempting to invoke a missing skill.
- `design-review-lite` as a fake skill-name in the review-log schema — renamed to `"source":"ship-design-check"` so the readiness dashboard no longer pretends a non-existent skill produced the entry.

### Bug Fixes

- `meow:ship/references/preamble.md` — two bash syntax errors fixed (unterminated `$(# comment)` upgrade-check and orphan `for...done` with a comment-eaten `done`). `bash -n` now passes on every code block; prior runs silently failed before any shipping work started.
- `meow:ship/references/plan-completion-audit.md` — the dead `/qa-only` invocation that silently failed every run is replaced with a one-line reminder to run `/meow:qa` against the deployed build.

---

## 2.4.5 (2026-04-19) — The Thinking Skills Release

### Highlights

A new strategic-unsticking skill and three diagnostic frameworks for evidence-based debugging. `meow:problem-solving` ships seven non-default techniques for approach-level stuck-moments — distinct from `meow:sequential-thinking`, which gains five-whys-plus, scientific-method, and kepner-tregoe references for methodology-aware root-cause work.

### New Skills

| Skill                  | Purpose                                                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meow:problem-solving` | Seven non-default techniques for "stuck on approach" — simplification cascades, collision-zone thinking, meta-pattern recognition, inversion, scale game, first principles, via negativa. Explicit boundary reroutes debugging to `meow:sequential-thinking`. |

### Improvements

- `meow:sequential-thinking` gains three diagnostic-framework references — `five-whys-plus.md` (bias guards + stopping criteria), `scientific-method.md` (falsifiable prediction discipline), `kepner-tregoe.md` (IS/IS-NOT matrix for multi-system bugs). Core workflow unchanged; load when a specific methodology fits.
- `SKILLS_INDEX.md` and website skill indexes register the new skill and clarify cross-cutting placement for both thinking skills.

---

## 2.4.4 (2026-04-19) — Deprecated Skill Cleanup + Brand Refresh

### Highlights

Three deprecated skills removed permanently. Brand assets (animated logo, SVG favicon, OG image) wired into VitePress. Vercel routing fix for direct URL access.

### Removals

- `meow:debug` — deprecated since v2.0.0, superseded by `meow:investigate`. Directory removed from `.claude/skills/`.
- `meow:documentation` — deprecated since v2.0.0, superseded by `meow:document-release`. Directory removed.
- `meow:shipping` — deprecated since v2.0.0, superseded by `meow:ship`. Directory removed.
- Dead references in `SKILLS_INDEX.md`, `website/reference/skills/index.md`, `website/reference/skills-index.md`, `website/reference/skills/docs-init.md`, `docs/project-context.md`, and `docs/meowkit-architecture.md` cleaned up.

### Improvements

- Brand assets wired into VitePress — animated SVG logo (`meow-logo-animated.svg`) replaces raster `logo.png`/`logo.webp` in navbar and homepage hero.
- Favicon refreshed — SVG primary (`favicon.svg`) + regenerated multi-resolution `.ico` + `16/32` PNGs + `apple-touch-icon` from the new brand source via ImageMagick.
- OG image swapped to the `/meow|` brand social card (1200×630).
- Site title hidden in navbar (`siteTitle: false`) — the logo carries the brand; no duplicate text.
- Color token system synced with brand source-of-truth (`assets/css/colors_and_type.css`): added `--mk-neutral-200/800/950`, `--mk-accent-soft`, full radius scale (`xs`/`xl`), full shadow set (`card`/`lift`/`glow-strong`/`inset-glow`), and motion easings (`--mk-ease-out` / `--mk-ease-in-out` + `--mk-dur-fast/normal/slow`).
- Changelog reorganized to a strict section schema (`Highlights` / `New Skills` / `Improvements` / `Removals` / `Bug Fixes` / `CLI` / etc.) — removed internal IDs, test counts, audit metadata. Added `npx mewkit upgrade` preamble.
- What's-new index compressed to 1-line headlines + ≤3 bullets per release.
- RELEASING.md step 2 rewritten with the new changelog schema, style rules (DRY), and a patch-vs-minor-vs-major required-section matrix.

### Bug Fixes

- Direct URL access on Vercel (`/changelog`, `/guide/whats-new`) returned 404 — added `cleanUrls: true` and `trailingSlash: false` to `vercel.json`. SPA-navigation from `/` worked; direct requests did not because Vercel served only `/changelog.html` without the rewrite.
- Homepage hero image was hardcoded to `/logo.png` in `index.md` frontmatter, separate from `themeConfig.logo` — the navbar swap didn't propagate. Now `/logo.svg`.
- README hero image pointed at `assets/branding/meowkit-logo-black.png` which never existed — swapped to `assets/branding/meow-logo-dark.svg`.
- Stale favicon issue — browsers auto-request `/favicon.ico` from root regardless of `<link>` order, picking the old raster. Regenerated all raster variants from the new SVG.

---

## 2.4.3 (2026-04-18) — Brainstorming v2: Discovery, Scope, Anti-Bias Pivot

### Highlights

`meow:brainstorming` rewritten with patterns extracted from BMAD-METHOD, ClaudeKit, and the everything-claude-code structural template. Adds discovery protocol, scope assessment, single mid-session anti-bias pivot, and 3 new techniques.

### Features

- Discovery protocol — `AskUserQuestion` capped at 3 questions per batch, targeting binding constraint, success criteria, and ruled-out options.
- Scope assessment — 3+ independently-shippable concerns (heuristic: would each be its own GitHub issue?) → user decomposes before brainstorming proceeds.
- Anti-bias pivot — one mandatory orthogonal-category pivot at idea #4 (midpoint).
- Idea Format Template — every idea carries a mandatory `Novelty` line; idea is dropped as a duplicate if you can't write one.
- Technique selection tiebreaker — explicit order when multiple techniques match.
- Output templates upgraded with audit-trail fields (Discovery Trace, Scope Decision, Technique Selection rationale, pivot record, Category Distribution, scoring risk callouts).

### New References

- `references/techniques/analogical-thinking.md` — cross-domain transfer (forces non-software analogues).
- `references/techniques/scamper.md` — 7-lens checklist for iterating an existing thing.
- `references/techniques/perspective-shift.md` — Six Hats narrowed to dev contexts (on-call SRE, security, future-you, end user).
- `references/anti-rationalization.md` — 4 categories of skip-the-process excuses with counter-arguments.
- `references/edge-cases.md` — 8 documented cases where the obvious brainstorming approach is wrong.

### Improvements

- Process steps reframed from prescriptive script to outcome-oriented list.
- "Hard gate" wording → "Behavioral hard rule" with explicit note that it is not hook-enforced (see `gate-rules.md` for actual gates).
- `references/gotchas.md` expanded from 6 → 12 entries (scope-explosion, question-fatigue, technique-mismatch, semantic-clustering, user-pre-decided, empty-intersection).

---

## 2.4.2 (2026-04-18) — Memory Fix

### Highlights

Closes the second red-team round on the memory subsystem and corrects three published-doc inaccuracies introduced during the v2.4.1 rewrite.

### Bug Fixes

- `acquireLock` now uses exponential backoff + jitter (10ms → 400ms cap, 8 retries). Eliminates the 20–40% concurrent-write drop rate.
- `secret-scrub.sh` DB-URL expression split per-scheme. BSD sed on macOS was rejecting the alternation, aborting the pipeline and discarding any content containing a DB URL.
- Stripe `sk_live_` / `sk_test_` / `rk_` / `pk_` patterns added to `secret-scrub.sh` to match the JS path. Shell paths previously leaked Stripe keys while the capture path redacted them.
- `findMemoryDir` sentinel check now fires at depth=0. Previously the walk could continue into a parent project, causing data loss on `mewkit memory --clear` from a nested dir.
- `appendToQuickNotes` now uses the same per-file lock as the other capture paths. Previously concurrent `##note:` captures could interleave.

### Improvements

- Auto-memory documentation corrected: `memory/` directory (not `MEMORY.md` file), 200-line / 25 KB cap stated explicitly, subagent memory isolation documented, `/memory` (Claude Code) distinguished from `##prefix:` (MeowKit), `.claude/memory/` clarified as machine-local (gitignored — not team-shared).
- Removed contradictory "commit them via git" instruction in memory-system guide.

---

## 2.4.1 (2026-04-18) — Memory Simplification + Red-Team Hardening

### Highlights

Deletes the auto-inject memory pipeline (`memory-loader` + parser + filter + injector) and replaces it with on-demand topic-file reads per consumer skill. Closes all 15 red-team findings (3 critical, 3 high, 9 medium) from the memory audit; most close by deletion.

### Removals

- Auto-inject memory pipeline (`memory-loader.cjs`, `memory-parser.cjs`, `memory-filter.cjs`, `memory-injector.cjs`). `UserPromptSubmit` no longer runs a global memory-injection step.
- Lexical keyword-to-domain match retired with the filter; topic-file retrieval is now an explicit `Read`.
- Commit-message privilege escalation in `post-session.sh` (auto-tagged `NEEDS_CAPTURE CRITICAL` from commit message keywords, bypassing filter budgets).

### Improvements

- Topic-file layout: `fixes.md/json`, `review-patterns.md/json`, `architecture-decisions.md/json`, `security-notes.md` replace the `lessons.md` + `patterns.json` monolith. Each file has a single consumer skill.
- On-demand retrieval: `meow:fix`, `meow:cook`, `meow:plan-creator`, `meow:review` read the relevant topic file via their SKILL.md `Read` step.
- Atomic capture writes: `immediate-capture-handler.cjs` uses temp-rename for all JSON writes; crash mid-write no longer corrupts split files. Dual-lock race on `architecture-decisions.json` eliminated.
- Memory is machine-local by default — `.claude/memory/*` is gitignored; `mewkit setup` scaffolds a blank directory. Downstream installs no longer inherit the MeowKit dev team's learnings.

### Features

- New `lib/secret-scrub.cjs` with 16 regex patterns (Anthropic, OpenAI, Stripe, AWS, GitHub, JWT, DB URL, Bearer tokens, etc.). Wired into the capture path so leaked secrets no longer re-enter future session context.
- Fresh-install guard: handler auto-creates `MEMORY_DIR` on first run. Captures on blank projects no longer silently fail.

### CLI

- `packages/mewkit/src/commands/memory.ts` — `findMemoryDir` exported with project-root sentinel and 5-level depth cap; `clearMemory` writes valid v2.0.0 skeletons; `showStats` / `showSummary` read the three split files.

### Bug Fixes

- `post-session.sh` lock-failure fallthrough — the `acquire_lock ||` branch could still execute the heredoc write. Block removed.
- Stale-lock false-eviction — dual `stat` failure fell back to always-stale. Safe mtime retry pattern replaces it.
- `clearMemory` wrote bare `"[]"` destroying the schema. Now writes proper skeletons per file scope.
- `cost-log.json` writer/spec schema drift fixed; `session_id`, `model`, `cache_write_tokens`, `cache_read_tokens` fields added.
- `cost-log.json` write now uses temp-file + `os.replace` rename for atomicity.
- `SESSION_ID` piped unvalidated into `sed` in `conversation-summary-cache.sh` — format validated against `^[a-f0-9-]{8,36}$` before use.

---

## 2.4.0 (2026-04-18) — The Agent Constitution Release

### Highlights

`docs/project-context.md` becomes the single source of truth for every agent — a 286-line, 11-section "agent constitution" loaded at SessionStart by every agent. Resolves the agent-context-drift issue open since the 260411 audit. Full skill audit cycle: 64 findings, 61 resolved, 0 regressions.

### Features

- `docs/project-context.md` agent constitution (tech stack, conventions, anti-patterns, testing, deployment, memory layout, hook chain). All 16 agents wired identically via `## Required Context`.
- New SessionStart hook `ensure-skills-venv.sh` — idempotent bootstrap that creates `.claude/skills/.venv` if absent. Composes with `npx mewkit setup`.
- `CLAUDE.md` "Commands vs Skills" section documents the 3 valid command patterns (skill-composing, agent-invoking, standalone), preventing false-positive phantom flagging.

### New Commands

- `meow:project-context init` — writes a TODO-filled `docs/project-context.md` skeleton for users starting from scratch. Refuses to overwrite an existing file.

### Improvements

- 12 SKILL.md files got real domain-specific Gotchas sections (5–6 entries each, no generic filler): `vue`, `typescript`, `database`, `build-fix`, `lint-and-validate`, `frontend-design`, `project-organization`, `jira`, `intake`, `figma`, `docs-finder`, `elicit`.
- 7 gate-owning skills gained `gate-rules.md` references: `meow:plan-creator`, `meow:workflow-orchestrator`, `meow:sprint-contract`, `meow:cook`, `meow:ship`, `meow:review`. `meow:cso` gained `security-rules.md`.
- README + CLAUDE.md + project-context.md surface `npx mewkit setup` as the required post-install step.

### Bug Fixes

- Deprecated skills (`meow:debug`, `meow:documentation`, `meow:shipping`) gained `deprecated: true` + `superseded_by:` YAML keys (previously only described in prose, invisible to parsers).
- Phantom skill refs in dispatcher fixed: `meow:plan` → `meow:plan-creator`, `meow:test` → `meow:testing`.
- Silent `python3`-absent skip in `post-session.sh:27` upgraded to a warning.
- Silent-fail on missing `docs/project-context.md` in `meow:plan-creator/step-02` upgraded to explicit warning with graceful fallback.

---

## 2.3.12 (2026-04-17) — External Codebase Packing + chom v2 Rigor

### New Skills

| Skill       | Purpose                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meow:pack` | Wraps `repomix` to export an external repo as a single AI-friendly file (markdown/xml/json/plain). Output at `.claude/packs/{timestamp}-{slug}.{ext}` (gitignored). |

### Features

- `meow:pack --compress` — Tree-sitter signature extraction for API-surface queries (bodies omitted).
- `self-pack-guard.sh` blocks packing the current git root unless `--self` is passed.
- `meow:chom` v2 — 4 user-explicit modes (`--compare` / `--copy` / `--improve` / `--port`) replacing v1's 2-mode scheme.
- `meow:chom` speed flags: `--lean` (skip Phase 1 researcher for freeform inputs) and `--auto` (auto-approve non-HARD-GATE steps).
- `meow:chom` intent detection — keyword hints map to suggested mode flags.
- `meow:chom` explicit Boundary Rules — emits handoff text only, does NOT invoke `plan-creator` / `brainstorming` / `cook` / `sequential-thinking` mid-flow.

### Improvements

- `meow:chom` Phase 4 HARD GATE language hardened — explicitly non-bypassable in all modes including `--lean` / `--auto`.
- chom handoff text enriched with challenge-reds summary + risk score. plan-creator owns adaptation-depth decisions downstream.

### Bug Fixes

- Removed fabricated "Skills cannot call skills" claim from chom SKILL.md (contradicted by `lessons-build-skill.md` §Composing Skills).
- Removed fabricated "40–70% context burn" claim from pack SKILL.md (replaced with honest context-isolation framing).
- Added Error Recovery for empty / unreachable / invalid sources (chom).

---

## 2.3.11 (2026-04-14) — Env Var Handling Hardening

### Highlights

`.claude/settings.json` adopts Claude Code's native `env` field for team-shared defaults. Three-layer precedence: shell export > `.claude/.env` > `settings.json` `env`.

### Features

- Native `env` field in `.claude/settings.json` for 9 control flags (`MEOWKIT_TDD`, `MEOWKIT_BUILD_VERIFY`, `MEOWKIT_LOOP_DETECT`, etc.). `load-dotenv.sh` / `dispatch.cjs` parsers now fallback-only for secrets and per-project overrides.
- `project-context-loader.sh` emits `## MeowKit Config` block at SessionStart so the agent sees active control vars. Gated on new sessions only (not resume/clear/compact).
- `MEOWKIT_HOOK_PROFILE` alias introduced (legacy `MEOW_HOOK_PROFILE` still accepted).

### Bug Fixes

- Quoted values with `#` preserved literally — `MEOWKIT_API_KEY="abc#123"` no longer truncated.
- Inline comments stripped from unquoted values only (`VAR=on  # comment` → `on`).
- Indented keys trimmed (`  MEOWKIT_TDD=1` now loads correctly).
- Dangerous keys blocked (`PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES`, `IFS`, `BASH_ENV`, `ENV`) — prevents env injection via rogue `.env`.
- Key validation against POSIX var name pattern.
- `pre-implement.sh` now loads `.env` via script-relative path fallback when `CLAUDE_PROJECT_DIR` is unset.
- Symlink-safe guard prevents walking into install source when `.claude/` is symlinked.
- CWD mismatch guard added — warns if MeowKit hooks not detected at project root.

---

## 2.3.10 (2026-04-13) — Jira Ticket Intelligence + Confluence & Sprint Planning

### New Skills

| Skill                  | Purpose                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meow:confluence`      | Fetch Confluence pages as markdown + deep requirement analysis (Spec Research Report, gap detection with `[MISSING]` / `[VAGUE]` / `[AMBIGUOUS]` tags, multi-page assembly). |
| `meow:planning-engine` | Codebase-aware tech review + sprint planning with deterministic scripts (`dep-graph.py` cycle detection, `capacity-bin.py` bin-packing). Research-only — no ticket creation. |

### Features

- `meow:jira evaluate` — qualitative complexity assessment (Simple/Medium/Complex with Fibonacci range).
- `meow:jira estimate` — heuristic story point estimation with escalation triggers.
- `meow:jira analyze` — full ticket context analysis with structured RCA output.
- Inconsistency detection — missing AC, vague language, unlinked dependencies, contradictions.
- Injection defense — ticket content wrapped in DATA boundary markers.
- Goal-oriented decision tree replaces operations-centric SKILL.md.
- Add comment / add attachment as inline Tier 2 operations.

### Improvements

- `meow:jira` SKILL.md restructured as thin routing layer (~150 lines).
- `jql-patterns.md` pruned from 50+ to 15 core patterns.
- `sprint-operations.md` and `workflow-transitions.md` pruned (REST details removed).
- Tier 2 batch creates (3+) now require preview + confirmation.
- Partial failure behavior defined for sequential operations.

---

## 2.3.9 (2026-04-12) — Memory System Hardening

### Highlights

Memory loader split into 3 focused modules. 4 critical security/correctness fixes (tag escape, budget split, YAML validation, per-entry caps). Adds `##prefix:` immediate capture, opt-in anchored summarization, and project preferences.

### Features

- `##decision:`, `##pattern:`, `##note:` message prefixes auto-route to typed memory files. Content validated against injection patterns before writing.
- `quick-notes.md` staging area for `##note:` captures.
- `MEOWKIT_SUMMARY_MODE=merge` enables merge-based summarization (preserves earlier context across compressions). Default remains `full-regen`.
- `.claude/memory/preferences.md` — team-shared preferences loaded at SessionStart.
- Agent readiness banner — 5-point score (CLAUDE.md, project-context, test, lint, typecheck) shown at session start. Detects Node.js, Python, Rust, Makefile projects.

### CLI

- `meow:memory --prune` — archives old standard-severity entries to `lessons-archive.md`, recovering injection budget. Critical entries exempt.

### Bug Fixes

- Tag escape — `<memory-data>` wrapper tags in content are escaped before injection, preventing DATA boundary escape.
- Budget split — 60% for critical entries, 40% for domain-filtered. One oversized entry no longer starves all others.
- YAML validation — malformed frontmatter entries rejected with visible `[parse-errors:]` marker instead of silent fallback.
- Per-entry caps — 3000 chars for critical (security findings preserved), 800 for standard.
- mkdir-based atomic locking for all memory file writes (POSIX portable; `flock` doesn't exist on macOS).
- O_EXCL checkpoint sequence lock — prevents TOCTOU race between concurrent checkpoint writers.
- Staleness filter — standard entries >6 months skipped (configurable). Critical entries never expire.
- Pattern expiration — patterns older than 12 months from `lastSeen` auto-expire. Critical/security patterns exempt.
- Cost-log append in `post-session.sh` with 1000-entry cap.
- Shell-to-Python injection eliminated across 6 hook files (single-quoted heredocs replace shell interpolation).
- Domain keyword extraction — 30+ domain keywords (`api`, `auth`, `db`, `sql`, etc.) bypass stop-word filter.

### Environment Variables

| Variable                          | Default    | Purpose                                         |
| --------------------------------- | ---------- | ----------------------------------------------- |
| `MEOWKIT_MEMORY_BUDGET`           | 4000       | Total char budget for memory injection per turn |
| `MEOWKIT_MEMORY_STALENESS_MONTHS` | 6          | Standard entries older than this are skipped    |
| `MEOWKIT_SUMMARY_MODE`            | full-regen | `full-regen` (default) or `merge` (opt-in)      |

---

## 2.3.8 (2026-04-12) — Multimodal Resilience, MiniMax & Provider Fallback

### Highlights

Major overhaul of `meow:multimodal` — multi-provider generation with intelligent Gemini → MiniMax → OpenRouter fallback, MiniMax integration (image, video, TTS, music), document conversion, and `MEOWKIT_` env namespace.

### Features

- MiniMax image generation (`image-01`).
- MiniMax video generation (Hailuo 2.3) with async polling.
- MiniMax text-to-speech (`speech-2.8-hd`, 332 voices, 24 languages).
- MiniMax music generation (`music-2.6`).
- Intelligent provider router auto-selects Gemini/MiniMax/OpenRouter by available API keys; `--provider` flag forces one.
- Document → Markdown converter with batch mode (`document_converter.py`).
- Env-driven provider chains (`MEOWKIT_IMAGE_PROVIDER_CHAIN` etc.).
- OpenRouter fallback for image gen (opt-in via `MEOWKIT_OPENROUTER_FALLBACK_ENABLED=true`).
- API key rotation (`MEOWKIT_GEMINI_API_KEY_2/3/4`) for free-tier throughput (4x).
- Default image model: Nano Banana 2 (`gemini-3.1-flash-image-preview`).
- `--resolution low-res` flag for video analysis (62% token savings).
- Media pre-optimization via ffmpeg (optional, 10–20% savings).
- Cost estimation for video analysis in `--verbose` mode.

### Improvements

- `MEOWKIT_` env var prefix with backward-compat fallback to legacy names.
- `DEFAULT_PROMPTS` request structured JSON output (~50% more token-efficient).
- Output truncation enforced at 6000 chars (CJK-safe).
- `media_resolution` defaults per modality (image=high, pdf=medium, video=low).

---

## 2.3.7 (2026-04-12) — The Copy-Cat Release

### New Skills

| Skill       | Purpose                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meow:chom` | Analyze and replicate features from external systems, repos, apps, or ideas into any project. 6-phase workflow: Recon → Map → Analyze → Challenge (HARD GATE) → Decision → Handoff. |

### Features

- Smart input routing — auto-detects git URLs (clone + scout), web URLs (web-to-markdown), local paths, freeform text (researcher), screenshots (multimodal).
- 7 challenge questions — Necessity, Stack Fit, Data Model, Dependency Cost, Effort vs Value, Blast Radius, Maintenance Burden.
- Risk scoring — 0–2 proceed, 3–4 resolve first, 5+ reject.
- Two modes — `--analyze` (full workflow → Replication Spec) and `--compare` (analysis only → Comparison Report).

---

## 2.3.6 (2026-04-11)

### Removals

- Unused files removed.

---

## 2.3.5 (2026-04-11) — CEO Review Layered Verification

### Highlights

Redesigns `meow:plan-ceo-review` from single-pass deep review to layered verification pipeline. Strengthens decision quality without changing the 4-mode system.

### Features

- Pre-screen gate (Layer 0–1) — mode-aware placeholder scan, structural completeness check, requirements coverage mapping. Returns for amendment, never rejects.
- Two-lens evaluation (Layer 3) — Intent Alignment + Execution Credibility. Each grades PASS/WARN/FAIL. Any FAIL → NEEDS REVISION.
- Severity tiers — all findings classified BLOCKER / HIGH-LEVERAGE / POLISH.
- Adversarial necessity — each section must surface ≥1 finding or document why clean. Prevents rubber-stamping.
- Append-only output — `## CEO Review` block appended to plan.md (never overwrites).
- Merged Failure Analysis — Error & Rescue Map + Failure Modes Registry combined into single table with severity column.

### Improvements

- `plan-creator step-08` auto-suggests CEO review after plan creation (gated by `planning_mode`).
- `harness step-01` suggests CEO review after product spec.

---

## 2.3.4 (2026-04-11) — Centralized Dotenv Loading

### Highlights

Project-level `.claude/.env` support so all hooks and handlers can read `MEOWKIT_*` env vars without polluting shell profiles.

### Features

- Shared dotenv loader `lib/load-dotenv.sh` sourced by all 11 shell hooks; no `eval`, uses `printenv` for safe key checking.
- Inline parser in `dispatch.cjs` loads `.claude/.env` for all 8 `.cjs` handlers (zero external dependencies).
- `.env.example` template with all 19 documented env vars across 5 categories (Core, Harness, Summary, Memory, Hook Controls).
- Precedence: shell `export` always wins over `.env` (no-override semantics).

### Removals

- CLI package builds removed from `release.sh` — harness releases no longer trigger CLI package builds. Build step replaced with JSON config validation (`settings.json`, `handlers.json`, `metadata.json`).

---

## 2.3.3 (2026-04-11) — The Wiring Integrity Release

### Highlights

5-agent parallel red-team audit of the full MeowKit harness. 7 critical breakpoints, 12 high-severity issues, and 30 medium/low cleanup items fixed across 25+ files.

### Bug Fixes

- Gate 2 NON-NEGOTIABLE violation — `fast.md` and `cost-saver.md` modes auto-approved Gate 2 without human confirmation; now require explicit human approval.
- TDD sentinel persistence — `--tdd` flag wrote sentinel to `.claude/session-state/` but session reset cleared `session-state/` at project root (different dirs); sentinel now cleared on new session.
- Memory system dead by default — `post-session.sh` exited on `standard` profile, disabling memory capture, cost tracking, and trace records; now runs by default.
- Phantom agent dispatch — `meow:cook` referenced 4 nonexistent agents; remapped to real agents.
- Memory path wrong system-wide — CLAUDE.md + 19 skills referenced `memory/` instead of `.claude/memory/`; all paths corrected.
- Model detector silent failure — `model-detector.cjs` guard on `ctx.hook_event_name` silently killed detection when field absent.
- Config file missing — `meowkit.config.json` referenced by 4+ consumers but never existed; created with version + features object.
- Budget thresholds — code defaults $10/$25, docs said $30/$100; aligned to $30/$100 with `MEOWKIT_BUDGET_CAP` override.
- 8 orphaned skills (`api-design`, `build-fix`, `database`, `decision-framework`, `figma`, `intake`, `jira`, `verify`) added to skill registry.
- 4 phantom skill refs in commands (`/arch`, `/audit`, `/canary`, `/ship`) fixed to actual skill names.
- ADR path conflict — `/arch` command wrote to `docs/adrs/` but architect agent wrote to `docs/architecture/adr/`; unified.
- TURN_GAP default — `harness-rules.md` said `:-5`, code was `:-30`; docs aligned to code.

### New Commands

- `/harness` — created missing slash command for primary green-field build entry point.

---

## 2.3.2 (2026-04-11) — The Agent-Skills Integration Release

### Highlights

Integrates correctness patterns from Anthropic's agent-skills system: 6 core operating behaviors, per-skill failure catalogs, phase composition contracts, and lifecycle-aware skill routing.

### Features

- `core-behaviors.md` — 6 mandatory operating behaviors (Surface Assumptions, Manage Confusion, Push Back, Enforce Simplicity, Scope Discipline, Verify Don't Assume) + 10 failure modes. Loaded via CLAUDE.md preamble.
- Per-skill failure catalogs — Common Rationalizations + Red Flags for `meow:cook`, `meow:plan-creator`, `meow:review`. Merged entries into `meow:fix` gotchas.
- Phase composition contracts — embedded in CLAUDE.md; documents expects/produces/breaks-if-missing per phase.
- Lifecycle routing table — task signal → phase → skill mapping in `meow:agent-detector`. Surfaced via `meow:help`.

---

## 2.3.1 (2026-04-11) — The Plan Creator Intelligence Release

### Highlights

Plan-creator's biggest upgrade since v1.3.2. 4-persona red team, `--deep` mode, `--tdd` composable flag, standalone subcommands, and enhanced validation framework.

### Features

- 4-persona red team — Security Adversary + Failure Mode Analyst added to existing 2 personas. Phase-count scaling: 1–3 phases = 2 personas, 4–5 = 3, 6+ = 4.
- Separate `red-team-findings.md` file with full 7-field detail, linked from plan.md summary.
- `--deep` mode — hard pipeline + per-phase scouting with file inventory and dependency maps per phase.
- `--tdd` composable flag — combines with any mode; injects Tests Before/Refactor/Tests After/Regression Gate into phase files.
- Memory capture at Gate 1 — planning decisions persisted after approval.
- Solution design checklist — 5-dimension trade-off analysis reference for Architecture/Risk sections.

### New Commands

- `/meow:plan red-team {path}` — runs adversarial review on existing plans.
- `/meow:plan validate {path}` — runs critical question interview on existing plans.
- `/meow:plan archive` — scans completed plans, optionally captures learnings, archives or deletes.

### Bug Fixes

- step-03 duplicate section label — `3i` appeared twice (Parallel + Two-Approach); renamed to `3i`/`3j`.
- phase-template wrong step reference — hydration reference said step-05 instead of step-08.
- step-08 incomplete schema — `.plan-state.json` missing `deep` and `product-level` as valid `planning_mode` values.

---

## 2.3.0 (2026-04-11) — The Hook Dispatch Release

### Highlights

Node.js hook dispatch system with 8 handler modules, cook verification flags, review skeptic anchoring, structured memory filtering, and tool output limits. TDD enforcement is now opt-in.

### Features

- Central `dispatch.cjs` with `handlers.json` registry — parses stdin once, routes to 8 handlers across 4 lifecycle events.
- `model-detector` handler — auto-detects model tier + density from SessionStart stdin `model` field; replaces `MEOWKIT_MODEL_HINT` as primary source.
- `orientation-ritual` handler — resumes from checkpoint on session resume.
- `build-verify` handler — compile/lint after file edits, cached by file hash (ported from shell to Node.js).
- `loop-detection` handler — warns at 4 edits, escalates at 8.
- `budget-tracker` handler — token cost estimation with $10 warn / $25 block session-level thresholds.
- `auto-checkpoint` handler — crash-recovery every 20 tool calls + phase transition detection.
- `checkpoint-writer` handler — sequenced checkpoint with git state + budget snapshot on Stop.
- `cook --verify` — advisory browser check after review (~$1).
- `cook --strict` — full `meow:evaluate` after review; FAIL blocks ship (~$2–5).
- `cook --no-strict` — suppress auto-strict trigger.
- Auto-strict — scale-routing `level=high` auto-enables `--strict` in cook.
- Review skeptic anchoring — re-anchor prompt injected per adversarial persona dispatch.
- Structured memory — `lessons.md` YAML frontmatter with two-phase domain-filtered loading.
- Tool output limits — Glob `head_limit=50`, Grep `head_limit=20`, Read `offset+limit` for >500 lines.

### Improvements

- TDD now opt-in via `--tdd` flag or `MEOWKIT_TDD=1`; default mode skips RED-phase gate.

---

## 2.2.2 (2026-04-10) — Homoglyph Detection Refinement

### Improvements

- `meow:web-to-markdown` `injection_detect.py` homoglyph detection now flags only mixed-script tokens (Latin + Cyrillic within a single word) instead of consecutive foreign characters. Reduces false positives on legitimate multilingual content while still catching homoglyph spoofing.

---

## 2.2.1 (2026-04-10) — Bug Fix

### Bug Fixes

- `meow:web-to-markdown` `robots_cache.py` `_fetch_robots_txt()` raised `UnboundLocalError`. A function-local `import urllib.request` shadowed the module-level `urllib.robotparser` binding, breaking `rp = urllib.robotparser.RobotFileParser()`. Hoisted `import urllib.request` to module-level imports.

---

## 2.2.0 (2026-04-08) — Generator/Evaluator Harness

### Highlights

Largest architectural addition since 1.0.0. Autonomous multi-hour build pipeline, adaptive scaffolding density per model tier, middleware layer, trace-driven meta-loop, and a conversation summary cache — without loosening any hard gates.

### New Skills

| Skill                  | Purpose                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meow:harness`         | Autonomous green-field build pipeline with generator/evaluator split, adaptive density, 3-round iteration loop, budget tracking ($30 warn / $100 block / user cap).                                                     |
| `meow:sprint-contract` | File-based sprint contract negotiated between generator and evaluator before source edits begin. Enforced by `gate-enforcement.sh` in FULL density.                                                                     |
| `meow:rubric`          | Weighted rubric loader; reads `.claude/rubrics/`, validates weights sum to 1.0.                                                                                                                                         |
| `meow:evaluate`        | Behavioral grader with active verification; skeptic persona, drives running build, rejects static-analysis-only verdicts.                                                                                               |
| `meow:trace-analyze`   | Scatter-gather trace log analyzer; reads `.claude/memory/trace-log.jsonl`, feeds meta-improvement loop with mandatory HITL gate.                                                                                        |
| `meow:benchmark`       | Canary suite (quick 5-task / full 6-task tiers) for dead-weight audit baselines on model upgrades.                                                                                                                      |
| `meow:web-to-markdown` | Static-by-default URL → clean markdown with SSRF guard, 6-pass injection scanner, DATA boundary wrap, fetch persistence with manifest, robots.txt cache, per-domain throttle. Tier-4 fallback below `meow:docs-finder`. |

### New Agents

- `evaluator` — skeptic persona distinct from reviewer. Drives running build, re-anchors persona per criterion, propagates FAIL verdicts hard. Self-evaluation forbidden — always runs in fresh context.

### New Commands

- `/meow:summary` — conversation summary cache inspector. `--status` health check, `--force` re-summarize, `--clear` reset.

### Features

- 4 new middleware hooks: `post-write-build-verify.sh`, `post-write-loop-detection.sh`, `pre-completion-check.sh`, `conversation-summary-cache.sh` (Haiku-powered, secret-scrubbed, throttled by size/turns/growth).
- 2 new rules files: `harness-rules.md` (11 rules for generator/evaluator discipline), `rubric-rules.md` (10 rules for calibration).
- Adaptive density auto-selected per model tier (TRIVIAL=MINIMAL, STANDARD=FULL, COMPLEX/Opus 4.5=FULL, COMPLEX/Opus 4.6+=LEAN). Override via `MEOWKIT_HARNESS_MODE`.

### CLI

- Schema-driven `system-deps` registry (`packages/mewkit/src/lib/system-deps-registry.ts`) — replaces hardcoded ffmpeg/imagemagick install paths with a typed registry. Skills declare `optional_system_deps`; CLI parses and validates against the registry.
- `mewkit doctor` — generic registry loop replaces hardcoded checks. Playwright entry has dedicated two-probe `doctorCheck`.
- `mewkit init` + `setup --system-deps` — flat list prompt; FFmpeg / ImageMagick / Playwright + Chromium iterated from registry insertion order.

### Bug Fixes

- `privacy-block.sh` exit code corrected — was using `exit 1` (non-blocking per Claude Code hooks docs). Changed to `exit 2` so the hook actually blocks. Block messages moved stdout → stderr.

### Migration Notes

- `export MEOWKIT_MODEL_HINT=opus-4-6` in your shell profile if on Opus 4.6 — enables LEAN density auto-detection. Without it, Opus 4.6 users silently get FULL density.
- Try `/meow:harness "build me a <thing>"` for your next green-field build.
- Run `/meow:summary --status` after your first long session to verify the conversation cache is healthy.

### Breaking Changes

- Hooks now read JSON on stdin via `lib/read-hook-input.sh` instead of positional `$1`. Legacy fallback preserved for existing hooks; custom hooks should migrate.
- No CLI, agent, or skill syntax changes. No gates loosened.

---

## 2.1.0 (2026-04-04)

### Highlights

Custom statusline, dependency management, SEO, and `mewkit` CLI improvements.

### Features

- `.claude/statusline.cjs` — 5-line ANSI status bar for Claude Code: model+tier, context usage bar with `/clear` warning at 60%/80%, active plan+phase tracking, 5h/weekly rate limits with reset countdown, token usage breakdown.
- Settings merge preserves new top-level keys (like `statusLine`) during updates.
- Sitemap generation, `robots.txt`, OG/Twitter meta tags, canonical URLs.

### CLI

- Install prompt during init — asks "Install Python skill dependencies?" after project description (default: no). Installs into `.claude/skills/.venv` only.
- Per-skill `requirements.txt` — walks `skills/*/scripts/requirements.txt`, merges and deduplicates with input validation.
- `mewkit setup --only=deps` — manual re-run with smart skip (verifies already-installed).
- `mewkit doctor` pip check — verifies installed pip packages against expected skill dependencies.
- Version picker — shows top 4 versions + "Enter version manually..." option.
- Cross-platform Python detection — `where` on Windows, `py` launcher support.
- Security — package name validation, path traversal prevention, 120s pip timeout, `execFileSync` array args.

---

## 2.0.0 (2026-04-04) — The Leverage Release

### Highlights

Extracted high-leverage patterns from ECC's 38-agent ecosystem. 5 new skills, 17 reference merges, hook profiling, naming cleanup.

### New Skills

| Skill                     | Purpose                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meow:decision-framework` | Operational decision architecture: classify → rules → score → escalate → communicate. 5 references + 3 domain examples.                                  |
| `meow:verify`             | Unified verification: build → lint → test → type-check → coverage. Fail-fast. Auto-detects 5 project types (JS/TS, Python, Go, Ruby, Rust).              |
| `meow:api-design`         | REST/GraphQL patterns: resource naming, HTTP methods, status codes, pagination, versioning, rate limiting, error formats.                                |
| `meow:build-fix`          | Build error triage: detect language from error output, classify fixability, chain into `meow:verify`. Max 3 attempts then escalate.                      |
| `meow:database`           | Schema design, migration patterns, query optimization. PostgreSQL primary.                                                                               |
| `meow:jira`               | Jira execution via Atlassian MCP: 8 operation categories, 4-tier safety framework, 50+ JQL templates, sprint management.                                 |
| `meow:figma`              | Figma design analysis via Figma MCP: 3 modes (analyze/implement/tokens), design token extraction (CSS/Tailwind/JSON). Fallback: PNG export + multimodal. |
| `meow:intake`             | Tool-agnostic ticket/PRD analysis with 8-dimension completeness scoring, media fallback chain, injection defense.                                        |

### Features

- 17 reference merges across 10 skills (RCA selection, plan-creator ops/cold-start/mutation, QA browser checklist, agent-detector token budget, office-hours product lens, typescript review checklist, cook loop safety, review iterative protocol, frontend anti-slop, testing E2E best practices).
- Hook runtime profiling — `MEOW_HOOK_PROFILE` env var: `strict` (all), `standard` (default), `fast` (gate + privacy only). Safety-critical hooks never skip.
- Mandatory simplification — `meow:cook` now requires `meow:simplify` between Phase 3 (Build) and Phase 4 (Review).
- Proactive learning — `learning-observer.sh` PostToolUse hook detects churn patterns, feeds into retroactive capture.

### Removals / Renames

- `meow:shipping` → `meow:ship`.
- `meow:documentation` → `meow:document-release`.
- `meow:debug` → `meow:investigate`.
- (Redirects in place for 2 releases.)

### Improvements

- MICRO-TASK TDD exemption — non-production code <30 lines exempt from TDD if classified MICRO-TASK by orchestrator.
- Staged parallel mode — overlapping files handled sequentially, non-overlapping in parallel.
- Memory capture enhancement — budget 2 min → 5 min, markers 3 → 5, CRITICAL/SECURITY markers always processed, `--capture-all` flag.
- `meow:scale-routing` — 4-layer detection (CSV + task content + context + confidence scoring), 8 task type classifications, optional `product-areas.yaml`.

### CLI

- `npx mewkit init` now prompts for optional system deps (FFmpeg, ImageMagick).
- `npx mewkit setup --system-deps` for deferred install.
- `npx mewkit doctor` reports status.

---

## 1.4.0 (2026-04-03) — The Plan Intelligence Release

### Highlights

Dedicated plan red-team with CK-style adjudication, plan-specific personas, and new workflow modes.

### Features

- Plan red-team extraction — monolithic step-04 split into steps 04–07; dedicated `step-05-red-team.md` with 7-field findings (Severity / Location / Flaw / Failure Scenario / Evidence / Suggested Fix / Category).
- Agent adjudication (Accept/Reject + rationale), 3-option user review gate (Apply all / Review each / Reject all), deduplication, severity sorting, 15-finding cap.
- 2 new plan-specific personas: `plan-assumption-destroyer` (unvalidated scale, dependency, team, infrastructure, timeline, integration assumptions) and `plan-scope-complexity-critic` (YAGNI violations, over-phasing, scope creep, premature abstraction).
- Dynamic persona scaling — phase-count thresholds: 1–3 phases = 2 personas, 4–5 = 3, 6+ = 4.
- Red Team Review section — auditable finding table written to plan.md.
- `workflow-fast.md` — compact path (skips research, scout, red-team, interview).
- `--parallel` mode — file ownership matrix in plan.md `## Execution Strategy`, parallel group task hydration, max 3 groups.
- `--two` mode — 2 competing approach files + trade-off matrix; user selects approach at step-04.

### Improvements

- `meow:plan-creator` workflow expanded from 6 steps (00–05) to 9 steps (00–08).
- `.plan-state.json` schema bumped to v1.1 with optional `parallel_groups` and `selected_approach` fields.
- 6 new gotchas and 2 new reference files (`parallel-mode.md`, `two-approach-mode.md`).

---

## 1.3.4 (2026-04-02) — Hook path resolution fix

### Bug Fixes

- All hooks use `$CLAUDE_PROJECT_DIR` for absolute paths in `settings.json` and CWD guard. Fixes "No such file or directory" when CWD differs from project root.

---

## 1.3.3 (2026-04-02) — The Hook Safety Release

### Bug Fixes

- `cost-meter.sh` — always exited 1 because `settings.json` passes no arguments; now exits 0 for missing args.
- `post-write.sh` — exited 1 on empty/missing file path; now exits 0 (matches PreToolUse safety fallback).
- `pre-task-check.sh` — used `exit 2` for WARN findings; Claude Code treats non-zero as error; now exits 0.

---

## 1.3.2 (2026-04-01) — The Plan Quality Release

### Highlights

Complete redesign of `meow:plan-creator` to match/exceed `ck-plan` across 15 dimensions.

### Features

- Step-file architecture — SKILL.md (thin entry) + workflow.md + 6 step files. JIT loading.
- Multi-file phase output — `plan.md` overview (≤80 lines) + `phase-XX` files (12-section template each).
- Scope challenge — Trivial → exit, simple → fast, complex → hard. User chooses EXPANSION / HOLD / REDUCTION.
- Plan red team — 2 adversarial personas (Assumption Destroyer + Scope Critic) review plans before validation (hard mode).
- Research integration — bounded (2 researchers, 5 calls each), findings cited in phase Key Insights.
- Sync-back — `.plan-state.json` checkpoint enables cross-session resume.
- Critical-step tasks — `[CRITICAL]` / `[HIGH]` todo items get dedicated Claude Tasks.
- Richer frontmatter — `description`, `tags`, `issue`, `blockedBy` / `blocks` fields.

---

## 1.3.1 (2026-03-31) — The Red Team Depth Release

### Highlights

Hybrid adversarial persona system for `meow:review`.

### Features

- Scope gate — step-01 classifies diffs as minimal (≤3 files, ≤50 lines, no security, domain ≠ high) or full. Minimal runs Blind Hunter only.
- Hybrid persona system — Phase B: 4 adversarial persona subagents (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope Complexity Critic) run after base reviewers, informed by Phase A findings. 2-at-a-time batching.
- Forced-finding protocol — zero findings triggers 1 re-analysis with "look harder" prompt. Prevents rubber-stamp approvals.
- 4-level artifact verification — Exists, Substantive, Wired, Data Flowing checks in verdict step.

---

## 1.3.0 (2026-03-31) — The Integration Integrity Release

### Highlights

Full red-team audit: 98 components, 11 batches, 43 criticals found, 42 fixed.

### Bug Fixes

- Hooks enforcement restored — `gate-enforcement.sh` and `privacy-block.sh` were completely non-functional (argument mismatch). Fixed argument passing; all 9 hooks now registered and working.
- Agent naming standardized — 5 phantom `subagent_type` values in `Task()` calls mapped to real agents.
- 7-phase model everywhere — `workflow-orchestrator` migrated from 5-phase to 7-phase. Gate 2 no longer bypassable.
- Path consistency — plan files, memory, ADRs, scripts all use canonical full paths.
- Verdict taxonomy unified — PASS/WARN/FAIL everywhere. Review dimensions aligned (Correctness/Maintainability/Performance/Security/Coverage).
- Python venv enforced — all scripts use `.claude/skills/.venv/bin/python3`. SessionStart warns if missing.
- `pre-ship.sh` guarded — no longer runs test suite on every Bash call, only on git commit/push.
- Security BLOCK → FAIL — security agent BLOCK verdict now automatically fails Gate 2 Security dimension.

### Improvements

- Created missing templates: party prompts (agent-selector, synthesis), team-config ownership map.
- Created `meow:fix/references/gotchas.md` (7 anti-patterns).
- Fixed `meow:development/references/skill-loader.md` — all 13+ broken paths corrected.
- Fixed mock guidance contradiction in tester agent (unit tests may mock, integration tests must not).
- Honest documentation: `meow:careful` now states 8/30 patterns are hook-enforced (was claiming all 30).

---

## 1.2.1 (2026-03-31)

### Bug Fixes

- `meow:cook` Phase 6 (Reflect) now spawns a dedicated subagent for `meow:memory` session-capture. Previously memory write was an inline bullet point that could be skipped if session was interrupted. Now enforced as MUST-spawn.

---

## 1.2.0 (2026-03-31) — The Memory Activation Release

### Highlights

Fixed the dormant memory system and enriched it with cross-framework insights from 6 agent frameworks.

### Features

- Memory capture pipeline — `post-session.sh` now writes structured `NEEDS_CAPTURE` markers instead of invisible HTML comment placeholders.
- Retroactive capture — Phase 0 processes pending markers from previous sessions (max 3 markers, 2-min budget).
- Live capture — Phase 5 captures non-obvious decisions, corrections, and rejected approaches before shipping.
- 3-category extraction — patterns, decisions, or failures.
- New `patterns.json` fields — `category`, `severity`, `applicable_when` (all optional, backward compatible).
- Stronger promotion criteria — patterns promoted to CLAUDE.md only when frequency ≥ 3, severity = critical OR frequency ≥ 5, generalizable, saves ≥ 30 min. Human approval still required.
- Consolidation rubric — 4-branch classification (clear match auto-merge / ambiguous ask / no match create new / no signal skip).

---

## 1.1.0 (2026-03-30) — The Reasoning Depth Release

### Highlights

Deeper review reasoning, resumable builds, and systematic coverage mapping. Inspired by comparative analysis of BMAD-METHOD, ClaudeKit-Engineer, Khuym Skills, and Get-Shit-Done.

### New Skills

| Skill                | Purpose                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meow:elicit`        | Structured second-pass reasoning after review or analysis. 8 named methods (pre-mortem, inversion, red team, Socratic, first principles, constraint removal, stakeholder mapping, analogical). |
| `meow:validate-plan` | 8-dimension plan quality validation. Auto for COMPLEX tasks, optional for STANDARD.                                                                                                            |
| `meow:nyquist`       | Test-to-requirement coverage mapping. Reads plan acceptance criteria + test files, produces gap report showing untested requirements.                                                          |

### Features

- `meow:review` now recommends running `meow:scout` before review for complex changes (3+ files).
- After review verdict, users can run `meow:elicit` for deeper analysis through a named reasoning method.
- Beads pattern — COMPLEX tasks (5+ files) decompose into atomic, resumable work units. Each bead has acceptance criteria, file ownership, and ~150 lines size. Progress tracked in `session-state/build-progress.json`. Interrupted builds resume from last completed bead.
- Subagent Status Protocol — all subagents report structured status (DONE, DONE_WITH_CONCERNS, BLOCKED, NEEDS_CONTEXT) with controller handling rules.

### Improvements

- Sub-agent type classification — support agents now have `subagent_type` in frontmatter: advisory (brainstormer, researcher, ui-ux-designer), utility (git-manager), escalation (journal-writer).
- Pre-delegation checklist added to `orchestration-rules.md`: work context, plan reference, file ownership, acceptance criteria, constraints.

---

## 1.0.0 (2026-03-30) — The Disciplined Velocity Release

### Highlights

The biggest MeowKit update yet. 13 new capabilities inspired by deep analysis of BMAD-METHOD and ClaudeKit-Engineer. Theme: scale throughput while maintaining absolute discipline.

### New Skills

| Skill                  | Purpose                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `meow:scale-routing`   | Domain-to-complexity CSV routing. Fintech, healthcare, IoT auto-force COMPLEX tier. User-extensible.                           |
| `meow:project-context` | Generate / update agent constitution.                                                                                          |
| `meow:party`           | Multi-agent deliberation sessions (2–4 agents debate architecture decisions with forced synthesis). Discussion only — no code. |
| `meow:worktree`        | Git worktree lifecycle management.                                                                                             |
| `meow:task-queue`      | Task claiming with ownership enforcement.                                                                                      |
| `meow:help`            | Pipeline navigation assistant.                                                                                                 |
| `meow:debug`           | Structured debugging: reproduce → isolate → root cause → fix → verify.                                                         |
| `meow:simplify`        | Post-implementation complexity reduction (between Build and Review).                                                           |
| `meow:team-config`     | Parallel agent team setup with ownership maps and worktrees.                                                                   |

### Features

- Planning Depth Per Mode — 7 modes declare researcher count: `strict` / `architect` run 2 parallel researchers; `default` / `audit` run 1; `fast` / `cost-saver` / `document` skip research.
- Multi-Layer Adversarial Review — `meow:review` now runs 3 parallel reviewers (Blind Hunter, Edge Case Hunter, Criteria Auditor) with post-review triage. Catches 2–3x more bugs than single-pass review.
- Anti-Rationalization Hardening — agents cannot downgrade complexity, minimize tests, skip security, or dismiss WARN verdicts without 3-part justification.
- Project Context System — `docs/project-context.md` is the agent constitution. All agents load it at session start.
- Parallel Execution & Teams — COMPLEX tasks with independent subtasks run up to 3 parallel agents with git worktree isolation. Integration test required after merge.
- Step-File Architecture — complex skills decompose into JIT-loaded step files. First skill: `meow:review` (4 steps).
- Hook-Based Enforcement — 3 shell hooks upgrade behavioral rules: `privacy-block.sh` (blocks sensitive reads), `gate-enforcement.sh` (blocks writes before Gate 1), `project-context-loader.sh` (auto-loads context).

### Breaking Changes

- None. All additions are backward-compatible.

---

## 0.1.2 (2026-03-29)

### Features

- Interactive version selection when running `npm create meowkit@latest`.
- `git-manager` agent for commit/push workflows.
- Confirmation step before Gemini API key input.

---

## 0.1.1 (2026-03-29)

### Removals

- Excluded runtime dirs (`session-state`, `memory`, `logs`) from release zip and git tracking.

---

## 0.1.0 (2026-03-29)

### Highlights

Initial pre-release of MeowKit agent toolkit.

### Features

- Core skill set (`cook`, `fix`, `ship`, `review`, `memory`, `testing`).
- Sequential thinking and fix diagnosis references.

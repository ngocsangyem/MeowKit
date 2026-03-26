---
name: meow:retro
preamble-tier: 2
version: 2.0.0
description: |
  Weekly engineering retrospective. Analyzes commit history, work patterns,
  and code quality metrics with persistent history and trend tracking.
  Team-aware: breaks down per-person contributions with praise and growth areas.
  Use when asked to "weekly retro", "what did we ship", or "engineering retrospective".
  Proactively suggest at the end of a work week or sprint.
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - AskUserQuestion
source: gstack
author: garrytan (gstack)
---

<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /meow:retro — Weekly Engineering Retrospective

Generates a comprehensive engineering retrospective analyzing commit history, work patterns, and code quality metrics. Team-aware: identifies the user running the command, then analyzes every contributor with per-person praise and growth opportunities. Designed for a senior IC/CTO-level builder using Claude Code as a force multiplier.

## When to Use

- User types `/meow:retro` (with optional arguments: `24h`, `14d`, `30d`, `compare`, `global`)
- End of a work week or sprint
- When asked "what did we ship" or "engineering retrospective"

## Workflow

1. **Run preamble** — initialize session, check upgrades, telemetry prompts. See `references/preamble.md`
2. **Parse arguments** — determine time window, mode (standard/compare/global). See `references/data-gathering.md`
3. **Gather raw data** — fetch origin, run 12 parallel git commands. See `references/data-gathering.md`
4. **Compute metrics** — summary table, per-author leaderboard, backlog health, skill usage, eureka moments. See `references/metrics-computation.md`
5. **Analyze time patterns** — hourly histogram, session detection, commit type breakdown, hotspots, PR sizes, focus score. See `references/metrics-computation.md`
6. **Team member analysis** — per-person stats, praise, growth opportunities. See `references/team-analysis.md`
7. **Trends & streaks** — week-over-week trends, shipping streaks, load/compare history. See `references/trends-history.md`
8. **Save retro snapshot** — persist JSON to `.context/retros/`. See `references/trends-history.md`
9. **Write narrative** — structured output with tweetable summary, all sections. See `references/narrative-output.md`
10. **Run telemetry** — log skill completion. See `references/telemetry.md`

For **compare mode**: See `references/compare-mode.md`
For **global mode** (`/retro global`): Skip steps 3-9, follow `references/global-retro.md` instead.

## Shared Protocols

These apply across all gstack skills:

- **AskUserQuestion format**: See `references/ask-user-question-format.md`
- **Completeness Principle**: See `references/completeness-principle.md`
- **Repo Ownership Mode**: See `references/repo-ownership-mode.md`
- **Search Before Building**: See `references/search-before-building.md`
- **Contributor Mode**: See `references/contributor-mode.md`
- **Completion Status Protocol**: See `references/completion-status-protocol.md`
- **Plan Status Footer**: See `references/plan-status-footer.md`

## Tone & Rules

See `references/tone-and-rules.md`

## References

| File | Contents |
|------|----------|
| `references/preamble.md` | Session initialization, upgrade checks, lake intro, telemetry prompt |
| `references/ask-user-question-format.md` | Standard AskUserQuestion structure (5 rules) |
| `references/completeness-principle.md` | Boil the Lake principle, effort estimation tables |
| `references/repo-ownership-mode.md` | Solo vs collaborative repo behavior |
| `references/search-before-building.md` | Three layers of knowledge, eureka moments |
| `references/contributor-mode.md` | Field report filing for gstack contributors |
| `references/completion-status-protocol.md` | DONE/BLOCKED/NEEDS_CONTEXT status reporting, escalation |
| `references/telemetry.md` | End-of-skill telemetry logging |
| `references/plan-status-footer.md` | Plan mode review report footer |
| `references/data-gathering.md` | Arguments, validation, Step 1 parallel git commands |
| `references/metrics-computation.md` | Steps 2-8: metrics, sessions, hotspots, focus score |
| `references/team-analysis.md` | Step 9: per-person analysis, praise, growth areas |
| `references/trends-history.md` | Steps 10-13: weekly trends, streaks, history, JSON save |
| `references/narrative-output.md` | Step 14: full output structure, section ordering |
| `references/global-retro.md` | Global mode: cross-project retro (Steps 1-9) |
| `references/compare-mode.md` | Compare mode: period-over-period comparison |
| `references/tone-and-rules.md` | Tone guidelines and important rules |

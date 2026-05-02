---
title: "mk:memory"
description: "Session memory toolkit — capture learnings, extract patterns, track costs, and consolidate stale entries. Persists to .claude/memory/ topic files. Activates during Phase 0 (Orient) to load context and Phase 6 (Reflect) to persist it."
---

# mk:memory

Topic-file-scoped session memory. Captures session learnings, extracts patterns for CLAUDE.md promotion, tracks token usage and costs, and consolidates stale entries. Persists to `.claude/memory/` topic files. Activates during Phase 0 (Orient) to load context and Phase 6 (Reflect) to persist it. NOT for weekly-cadence engineering retrospectives (see `mk:retro`); NOT for arbitrary file storage.

## What This Skill Does

- **Session capture** -- extracts patterns, decisions, and failures from each session and writes to topic files (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`) and their parallel JSON files
- **Pattern extraction** -- identifies high-frequency patterns (frequency >= 3) and proposes them as permanent rules for CLAUDE.md, with human approval required
- **Cost tracking** -- logs token usage estimates per task to `cost-log.json`, provides `/mk:budget` reporting with monthly aggregation and all-time totals
- **Consolidation** -- prunes stale standard-severity entries older than 90 days to `lessons-archive.md`, archives old cost data, merges duplicate entries
- **Immediate capture** -- supports real-time tagging during sessions via `##pattern:` and `##decision:` prefixes

## When to Use

- Phase 0 (Orient): load previous session context from topic files and cost log
- Phase 6 (Reflect): capture learnings, patterns, and failures after session closure
- When `analyst` agent tracks costs or extracts patterns
- Manual consolidation when topic files exceed 300 lines or JSON files exceed 50 entries

**NOT for:** weekly engineering retrospectives (use `mk:retro`), arbitrary file storage.

## Core Capabilities

### Topic File System

| Category | Markdown File | JSON File |
|----------|--------------|-----------|
| Bug fix / failure / pattern | `memory/fixes.md` | `memory/fixes.json` |
| Review pattern / architecture insight | `memory/review-patterns.md` | `memory/review-patterns.json` |
| Architectural decision | `memory/architecture-decisions.md` | `memory/architecture-decisions.json` |
| Security finding | `memory/security-notes.md` | -- |

**DO NOT write to `memory/lessons.md`** -- it is an archived stub. Topic files are the active write targets.

### Session Capture (Phase 6, from `references/session-capture.md`)

Mandatory at the end of every session. Three extraction categories:

1. **Patterns** (category: pattern) -- reusable approaches that worked, code patterns, architecture patterns, debugging approaches. Each includes `applicable-when` for future agent guidance.
2. **Decisions** (category: decision) -- technical choices, process choices, scope decisions. Tagged as: `GOOD_CALL`, `BAD_CALL`, `SURPRISE`, or `TRADEOFF`.
3. **Failures** (category: failure / bug-class) -- incorrect assumptions, wrong approaches, blockers. Each includes root cause and a **prevention rule**.

Markdown format for topic file entries:
```markdown
## YYYY-MM-DD -- [Brief description] (status: live-captured, severity: critical|standard)

### What happened
[Description]

### Prevention rule
[Actionable rule for future agents]
```

JSON format for split JSON files (v2.0.0 schema):
```json
{
  "id": "unique-kebab-case-id",
  "type": "failure" | "success",
  "category": "bug-class" | "pattern" | "decision",
  "severity": "critical" | "standard",
  "domain": ["keyword1", "keyword2"],
  "applicable_when": "one sentence -- conditions for future agents",
  "context": "when this pattern applies",
  "pattern": "what to do (or what not to do)",
  "frequency": 1,
  "lastSeen": "YYYY-MM-DD"
}
```

### Immediate Capture (during session)

For quick, crash-resilient capture during the session:
- `##pattern: bug-class <description>` -- auto-writes to `fixes.json`
- `##decision: <description>` -- auto-writes to `architecture-decisions.json`
- `##note: <text>` -- staging in `quick-notes.md` (classified at Reflect)

### Pattern Extraction (from `references/pattern-extraction.md`)

The self-improving loop:
```
Sessions -> session-capture -> topic files
                                    |
                           pattern-extraction
                           reads fixes.json, review-patterns.json, architecture-decisions.json
                                    |
                           Proposed rules -> Human review
                                    |
                           Accepted rules -> CLAUDE.md
                                    |
                           Future sessions follow new rules
                                    |
                           New patterns emerge -> repeat
```

Promotion criteria:
- `frequency >= 3` across multiple sessions
- `severity == "critical"` OR `frequency >= 5`
- Generalizable -- not overly implementation-specific
- Saves >=30 min if known in advance

Requires explicit human approval for each CLAUDE.md change.

### Cost Tracking (from `references/cost-tracking.md`)

**Before every task:** Log estimated complexity tier and model.

| Tier | Description | Estimated Tokens |
|------|-------------|-----------------|
| `trivial` | Single file read/edit, simple question | 1K-5K |
| `standard` | Multi-file change, moderate reasoning | 5K-20K |
| `complex` | Architecture work, large refactor, multi-step research | 20K-100K |
| `intensive` | Full codebase analysis, complex debugging, plan generation | 100K+ |

**After every task:** Append usage to `memory/cost-log.json`.

**`/mk:budget` subcommand** -- displays last N entries, monthly aggregation, all-time totals with tier distribution.

### Consolidation (from `references/consolidation.md`)

Triggered when topic files or JSON files exceed thresholds.

**`--prune` subcommand (grep-based, no parser dependency):**
1. For each topic file: grep for `## ` headings with date pattern `(YYYY-MM-DD, severity: standard)` older than threshold (default: 90 days)
2. Append stale entry blocks to `lessons-archive.md`
3. Rewrite topic file without stale blocks
4. Report: "Archived N entries across M files"

**Exempt from pruning:**
- Entries with `severity: critical` or `severity: security` -- never pruned
- Entries without a parseable date -- kept as-is (safe default)

**JSON file dedup:** When a split JSON file exceeds 50 entries, remove patterns with `lastSeen` > 6 months, merge similar entries (sum frequencies), remove contradicted entries.

**Cost log archiving:** When `cost-log.json` exceeds 500 entries, archive entries older than 90 days to `cost-log-archive-YYYY-MM.json` per month.

**Classification rubric for manual dedup:**
- **Clear Match** -- exactly one existing entry owns the same lesson. Merge.
- **Ambiguous** -- two or more entries have plausible ownership. Ask user. Never auto-merge.
- **No Match** -- no existing entry, signal is durable. Create new entry.
- **No Durable Signal** -- transient, noisy. Skip.

## Arguments

```
/mk:memory                  # Activate memory toolkit (loads references on demand)
/mk:memory --prune          # Prune standard-severity entries older than 90 days
/mk:memory --prune --days 180  # Custom threshold
/mk:memory --prune --dry-run   # Preview what would be archived
/mk:budget                   # Display cost summary (subcommand of mk:memory)
/mk:budget --report          # Full cost report
/mk:budget --alert N         # Alert if monthly tokens exceed N
```

## Usage

```bash
# Session capture (Phase 6)
/mk:memory

# Prune stale entries
/mk:memory --prune

# Check cost budget
/mk:budget
```

## Common Use Cases

- End-of-session capture: extracting what was learned so future sessions benefit
- Pattern promotion: identifying high-frequency patterns across 10+ sessions and proposing CLAUDE.md rules
- Cost monitoring: tracking token usage trends and setting budget alerts
- Memory housekeeping: pruning standard-severity entries older than 90 days
- Debugging history: searching `fixes.md` for past bug-class patterns when hitting a similar issue

## Example Prompt

> /mk:memory
> We just finished a major refactor of the payment module. Capture what we learned about the transaction deadlock pattern — root cause, the fix that worked, and a prevention rule so future sessions can avoid it.

## Pro Tips

- **Stale patterns applied to changed codebase** -- run consolidation when patterns exceed 50 entries; flag patterns with `lastSeen` > 6 months.
- **`cost-log.json` grows unbounded** -- every session appends without pruning. Run consolidation to archive entries older than 90 days.
- **`lessons.md` is archived** -- do not write to it. Write to topic files (fixes.md, architecture-decisions.md, review-patterns.md) instead.
- **Use immediate capture prefixes** during long sessions to save insights before the end-of-session capture runs.
- **Never auto-merge ambiguous entries** during consolidation -- always ask the user.
- **Preserve frequency counts** when merging JSON patterns (sum the frequencies).
- **`severity: critical` for failures** that affect multiple features or would save >=30 min if known in advance; `standard` otherwise.
- **Log every task** including failed/abandoned ones to get accurate cost tracking.

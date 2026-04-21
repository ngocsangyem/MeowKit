# Skill: Topic File Consolidation and Pruning

**Purpose:** Keep topic files lean and high-signal. Prune stale entries, archive old cost data, and merge duplicates when topic files grow large.

## Contents

- [When to Prune](#when-to-prune)
- [Pruning Topic Files (`/meow:memory --prune`)](#pruning-topic-files-meowmemory---prune)
- [Pruning Split JSON Files (Manual)](#pruning-split-json-files-manual)
- [Archiving cost-log.json](#archiving-cost-logjson)
- [Classification Rubric (for manual topic file dedup)](#classification-rubric-for-manual-topic-file-dedup)
  - [Clear Match](#clear-match)
  - [Ambiguous](#ambiguous)
  - [No Match](#no-match)
  - [No Durable Signal](#no-durable-signal)
- [Validation](#validation)
- [Important Rules](#important-rules)


## When to Prune

| File | Threshold | Action |
|------|-----------|--------|
| Any topic `.md` file | > 300 lines | Run `--prune` to archive standard-severity entries older than 90 days |
| Any split `.json` file | > 50 entries | Run `--prune` then consider manual dedup |
| `cost-log.json` | > 500 entries | Archive entries > 90 days old to `cost-log-archive-YYYY-MM.json` |
| `decisions.md` | > 30 entries | Remove decisions superseded by later ones |

---

## Pruning Topic Files (`/meow:memory --prune`)

The `--prune` subcommand uses a **grep-based approach** — no parser dependency.

**Mechanism:**
1. For each topic file (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`): grep for `## ` headings with date pattern `(YYYY-MM-DD, severity: standard)`
2. Compute age from today's date; identify entries older than threshold (default: 90 days)
3. Append stale entry blocks to `.claude/memory/lessons-archive.md`
4. Rewrite topic file without the stale blocks
5. Report: "Archived N entries across M files"

**Exempt from pruning:**
- Entries with `severity: critical` or `severity: security` — never pruned
- Entries without a parseable date — kept as-is (safe default)

**Recovery:** Copy entries from `lessons-archive.md` back to the appropriate topic file.

```
/meow:memory --prune              # default 90-day threshold
/meow:memory --prune --days 180   # custom threshold
/meow:memory --prune --dry-run    # show what would be archived without moving
```

---

## Pruning Split JSON Files (Manual)

When a split JSON file exceeds 50 entries:

1. Read the file
2. For patterns with `lastSeen` > 6 months ago: remove (likely stale)
3. For patterns with similar `applicable_when` + `pattern` text: merge into one entry, sum `frequency`
4. For patterns that contradict current codebase state: remove
5. Verify all entries have required v2.0.0 fields; add defaults if missing

**Do NOT read or modify `patterns.json`** — it is a deprecated stub.

---

## Archiving cost-log.json

When `cost-log.json` exceeds 500 entries:

1. Read all entries
2. Move entries older than 90 days to `cost-log-archive-YYYY-MM.json` (one file per month)
3. Keep rolling 90-day window in `cost-log.json`
4. If archive file exists for a month, append (don't overwrite)

---

## Classification Rubric (for manual topic file dedup)

For each candidate lesson, classify into exactly one branch:

### Clear Match
Choose when ALL are true: exactly one existing entry owns the same durable lesson; the candidate strengthens or corrects it without changing scope.
**Action:** Merge into owner. Update `lastSeen`. Remove contradicted details.

### Ambiguous
Choose when two or more existing entries have plausible ownership.
**Action:** Present options to user — `merge → A`, `merge → B`, `create new`, `skip`. Wait for choice. Do NOT silently guess.

### No Match
No existing entry is a good owner AND the signal is durable.
**Action:** Create new entry with appropriate category/severity/applicable_when.

### No Durable Signal
Transient, noisy, or not reusable (e.g., one-off command output, ephemeral env state).
**Action:** Skip. Write nothing.

---

## Validation

- [ ] No topic file has duplicate `<!-- migrated-id: ... -->` markers for the same ID
- [ ] Split JSON files have no patterns with `lastSeen` > 6 months (after dedup)
- [ ] Split JSON files are valid JSON
- [ ] `cost-log.json` has only entries from the last 90 days
- [ ] Archive files exist for older cost entries
- [ ] No data was lost — only duplicates/stale entries removed
- [ ] `patterns.json` was NOT modified (deprecated stub)

---

## Important Rules

- **Never auto-merge ambiguous entries.** Always ask the user.
- **Never delete the only instance of a lesson.** Only delete duplicates or contradicted entries.
- **Preserve frequency counts** when merging JSON patterns (sum the frequencies).
- **Run validation checks** after every consolidation pass.
- **Log what was changed** — append a summary to `fixes.md` or the relevant topic file:
  ```
  ## Consolidation YYYY-MM-DD (status: live-captured, severity: standard)
  - Patterns merged: N
  - Patterns removed (stale): N
  - Cost entries archived: N
  ```
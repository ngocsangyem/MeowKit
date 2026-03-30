# Skill: Memory Consolidation

**Purpose:** Prune stale entries, merge duplicates, archive old cost data, and keep memory files lean and high-signal.

## When to Use

Invoke manually when memory reaches scale thresholds:

| File | Threshold | Action |
|------|-----------|--------|
| `lessons.md` | > 20 session entries | Merge duplicates, remove contradicted |
| `patterns.json` | > 50 patterns | Prune stale (lastSeen > 6mo), merge similar |
| `cost-log.json` | > 500 entries | Archive entries > 90 days old |
| `decisions.md` | > 30 entries | Remove decisions superseded by later ones |

---

## Classification Rubric

For each candidate lesson or pattern, classify into exactly one branch:

### Clear Match

Choose when ALL are true:
- Exactly one existing entry owns the same durable lesson
- The candidate strengthens or corrects that entry without changing scope
- No competing entry has similar ownership strength

**Action:** Merge into the one owner. Update `lastSeen`. Remove contradicted details.

### Ambiguous

Choose when ANY are true:
- Two or more existing entries have plausible ownership
- The best target cannot be justified confidently
- The lesson overlaps adjacent domains

**Action:** Present options to user:
- `merge → <target entry A>`
- `merge → <target entry B>`
- `create new`
- `skip`

Wait for user choice before writing. Do NOT silently guess.

### No Match

Choose when no existing entry is a good owner AND the signal is durable.

**Action:** Create new entry. Set appropriate fields (category, severity, applicable_when).

### No Durable Signal

Choose when the candidate is transient, noisy, or not reusable. Examples:
- Temporary command output without reusable lesson
- One-off failure details with no general prevention rule
- Ephemeral environment state not expected to recur

**Action:** Skip. Write nothing.

---

## Consolidation Steps

### Step 1: Consolidate lessons.md

1. Read all session entries
2. For entries with similar content (same lesson, different sessions): keep the most recent, delete older duplicates
3. For entries that contradict current codebase state: delete the contradicted entry
4. Convert any remaining relative dates ("yesterday", "last week") to absolute dates
5. Mark consolidated entries with `- Status: consolidated (YYYY-MM-DD)`

### Step 2: Consolidate patterns.json

1. Read all patterns
2. For patterns with `lastSeen` > 6 months ago: remove (likely stale)
3. For patterns with similar `context` + `pattern` text: merge into one, sum frequencies
4. For patterns contradicting current codebase: remove
5. Verify all entries have `category`, `severity`, `applicable_when` — add defaults if missing (`category: "pattern"`, `severity: "standard"`, `applicable_when: ""`)

### Step 3: Archive cost-log.json

1. Read all entries
2. Move entries older than 90 days to `cost-log-archive-YYYY-MM.json`
3. Keep rolling 90-day window in `cost-log.json`
4. If archive file exists for a month, append (don't overwrite)

### Step 4: Consolidate decisions.md

1. Read all decision entries
2. For decisions superseded by later decisions on the same topic: remove the earlier one
3. Keep the most recent decision for each topic

---

## Validation

- [ ] lessons.md has no duplicate lessons across sessions
- [ ] patterns.json has no patterns with lastSeen > 6 months
- [ ] patterns.json is valid JSON
- [ ] cost-log.json has only entries from the last 90 days
- [ ] Archive files exist for older entries
- [ ] decisions.md has no superseded decisions
- [ ] No data was lost (only duplicates/stale entries removed)

---

## Important Rules

- **Never auto-merge ambiguous entries.** Always ask the user.
- **Never delete the only instance of a lesson.** Only delete duplicates or contradicted entries.
- **Preserve frequency counts** when merging patterns (sum the frequencies).
- **Run validation checks** after every consolidation pass.
- **Log what was changed** — append a summary to lessons.md:
  ```
  ## Consolidation YYYY-MM-DD
  - Patterns merged: N
  - Patterns removed (stale): N
  - Lessons merged: N
  - Cost entries archived: N
  ```

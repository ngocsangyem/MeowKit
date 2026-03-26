# Steps 2-8: Metrics Computation

## Step 2: Compute Metrics

Calculate and present these metrics in a summary table:

| Metric | Value |
|--------|-------|
| Commits to main | N |
| Contributors | N |
| PRs merged | N |
| Total insertions | N |
| Total deletions | N |
| Net LOC added | N |
| Test LOC (insertions) | N |
| Test LOC ratio | N% |
| Version range | vX.Y.Z.W -> vX.Y.Z.W |
| Active days | N |
| Detected sessions | N |
| Avg LOC/session-hour | N |
| Greptile signal | N% (Y catches, Z FPs) |
| Test Health | N total tests . M added this period . K regression tests |

Then show a **per-author leaderboard** immediately below:

```
Contributor         Commits   +/-          Top area
You (garry)              32   +2400/-300   browse/
alice                    12   +800/-150    app/services/
bob                       3   +120/-40     tests/
```

Sort by commits descending. The current user (from `git config user.name`) always appears first, labeled "You (name)".

**Greptile signal (if history exists):** Read `.claude/memory/greptile-history.md` (fetched in Step 1, command 8). Filter entries within the retro time window by date. Count entries by type: `fix`, `fp`, `already-fixed`. Compute signal ratio: `(fix + already-fixed) / (fix + already-fixed + fp)`. If no entries exist in the window or the file doesn't exist, skip the Greptile metric row. Skip unparseable lines silently.

**Backlog Health (if TODOS.md exists):** Read `TODOS.md` (fetched in Step 1, command 9). Compute:
- Total open TODOs (exclude items in `## Completed` section)
- P0/P1 count (critical/urgent items)
- P2 count (important items)
- Items completed this period (items in Completed section with dates within the retro window)
- Items added this period (cross-reference git log for commits that modified TODOS.md within the window)

Include in the metrics table:
```
| Backlog Health | N open (X P0/P1, Y P2) . Z completed this period |
```

If TODOS.md doesn't exist, skip the Backlog Health row.

**Skill Usage (if analytics exist):** Read `.claude/memory/skill-usage.jsonl` if it exists. Filter entries within the retro time window by `ts` field. Separate skill activations (no `event` field) from hook fires (`event: "hook_fire"`). Aggregate by skill name. Present as:

```
| Skill Usage | /ship(12) /qa(8) /review(5) . 3 safety hook fires |
```

If the JSONL file doesn't exist or has no entries in the window, skip the Skill Usage row.

**Eureka Moments (if logged):** Read `.claude/memory/eureka.jsonl` if it exists. Filter entries within the retro time window by `ts` field. For each eureka moment, show the skill that flagged it, the branch, and a one-line summary of the insight. Present as:

```
| Eureka Moments | 2 this period |
```

If moments exist, list them:
```
  EUREKA /meow:office-hours (branch: garrytan/auth-rethink): "Session tokens don't need server storage — browser crypto API makes client-side JWT validation viable"
  EUREKA /meow:plan-eng-review (branch: garrytan/cache-layer): "Redis isn't needed here — Bun's built-in LRU cache handles this workload"
```

If the JSONL file doesn't exist or has no entries in the window, skip the Eureka Moments row.

## Step 3: Commit Time Distribution

Show hourly histogram in local time using bar chart:

```
Hour  Commits  ::::::::::::::::
 00:    4      ::::
 07:    5      :::::
 ...
```

Identify and call out:
- Peak hours
- Dead zones
- Whether pattern is bimodal (morning/evening) or continuous
- Late-night coding clusters (after 10pm)

## Step 4: Work Session Detection

Detect sessions using **45-minute gap** threshold between consecutive commits. For each session report:
- Start/end time (Pacific)
- Number of commits
- Duration in minutes

Classify sessions:
- **Deep sessions** (50+ min)
- **Medium sessions** (20-50 min)
- **Micro sessions** (<20 min, typically single-commit fire-and-forget)

Calculate:
- Total active coding time (sum of session durations)
- Average session length
- LOC per hour of active time

## Step 5: Commit Type Breakdown

Categorize by conventional commit prefix (feat/fix/refactor/test/chore/docs). Show as percentage bar:

```
feat:     20  (40%)  ::::::::::::::::::::
fix:      27  (54%)  :::::::::::::::::::::::::::
refactor:  2  ( 4%)  ::
```

Flag if fix ratio exceeds 50% — this signals a "ship fast, fix fast" pattern that may indicate review gaps.

## Step 6: Hotspot Analysis

Show top 10 most-changed files. Flag:
- Files changed 5+ times (churn hotspots)
- Test files vs production files in the hotspot list
- VERSION/CHANGELOG frequency (version discipline indicator)

## Step 7: PR Size Distribution

From commit diffs, estimate PR sizes and bucket them:
- **Small** (<100 LOC)
- **Medium** (100-500 LOC)
- **Large** (500-1500 LOC)
- **XL** (1500+ LOC)

## Step 8: Focus Score + Ship of the Week

**Focus score:** Calculate the percentage of commits touching the single most-changed top-level directory (e.g., `app/services/`, `app/views/`). Higher score = deeper focused work. Lower score = scattered context-switching. Report as: "Focus score: 62% (app/services/)"

**Ship of the week:** Auto-identify the single highest-LOC PR in the window. Highlight it:
- PR number and title
- LOC changed
- Why it matters (infer from commit messages and files touched)

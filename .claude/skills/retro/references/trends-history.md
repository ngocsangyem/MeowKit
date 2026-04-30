# Steps 10-13: Trends, Streaks, History & Save


## Contents

- [Step 10: Week-over-Week Trends (if window >= 14d)](#step-10-week-over-week-trends-if-window-14d)
- [Step 11: Streak Tracking](#step-11-streak-tracking)
- [Step 12: Load History & Compare](#step-12-load-history-compare)
- [Step 13: Save Retro History](#step-13-save-retro-history)

## Step 10: Week-over-Week Trends (if window >= 14d)

If the time window is 14 days or more, split into weekly buckets and show trends:

- Commits per week (total and per-author)
- LOC per week
- Test ratio per week
- Fix ratio per week
- Session count per week

## Step 11: Streak Tracking

Count consecutive days with at least 1 commit to origin/<default>, going back from today. Track both team streak and personal streak:

```bash
# Team streak: all unique commit dates (local time) — no hard cutoff
git log origin/<default> --format="%ad" --date=format:"%Y-%m-%d" | sort -u

# Personal streak: only the current user's commits
git log origin/<default> --author="<user_name>" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

Count backward from today — how many consecutive days have at least one commit? This queries the full history so streaks of any length are reported accurately. Display both:

- "Team shipping streak: 47 consecutive days"
- "Your shipping streak: 32 consecutive days"

## Step 12: Load History & Compare

Before saving the new snapshot, check for prior retro history:

```bash
ls -t .claude/memory/retros/*.json 2>/dev/null
```

**If prior retros exist:** Load the most recent one using the Read tool. Calculate deltas for key metrics and include a **Trends vs Last Retro** section:

```
                    Last        Now         Delta
Test ratio:         22%    ->    41%         ^19pp
Sessions:           10     ->    14          ^4
LOC/hour:           200    ->    350         ^75%
Fix ratio:          54%    ->    30%         v24pp (improving)
Commits:            32     ->    47          ^47%
Deep sessions:      3      ->    5           ^2
```

**If no prior retros exist:** Skip the comparison section and append: "First retro recorded — run again next week to see trends."

## Step 13: Save Retro History

After computing all metrics (including streak) and loading any prior history for comparison, save a JSON snapshot:

```bash
mkdir -p .claude/memory/retros
```

Determine the next sequence number for today (substitute the actual date for `$(date +%Y-%m-%d)`):

```bash
# Count existing retros for today to get next sequence number
today=$(date +%Y-%m-%d)
existing=$(ls .claude/memory/retros/${today}-*.json 2>/dev/null | wc -l | tr -d ' ')
next=$((existing + 1))
# Save as .claude/memory/retros/${today}-${next}.json
```

Use the Write tool to save the JSON file with this schema:

```json
{
  "date": "2026-03-08",
  "window": "7d",
  "metrics": {
    "commits": 47,
    "contributors": 3,
    "prs_merged": 12,
    "insertions": 3200,
    "deletions": 800,
    "net_loc": 2400,
    "test_loc": 1300,
    "test_ratio": 0.41,
    "active_days": 6,
    "sessions": 14,
    "deep_sessions": 5,
    "avg_session_minutes": 42,
    "loc_per_session_hour": 350,
    "feat_pct": 0.4,
    "fix_pct": 0.3,
    "peak_hour": 22,
    "ai_assisted_commits": 32
  },
  "authors": {
    "Alice": {
      "commits": 12,
      "insertions": 800,
      "deletions": 150,
      "test_ratio": 0.35,
      "top_area": "app/services/"
    }
  },
  "version_range": ["1.16.0.0", "1.16.1.0"],
  "streak_days": 47,
  "tweetable": "Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm",
  "reviews": {
    "fixes": 3,
    "fps": 1,
    "already_fixed": 2,
    "signal_pct": 83
  }
}
```

**Note:** Only include the `reviews` field if `.claude/memory/reviews.jsonl` exists and has entries within the time window. Only include the `backlog` field if `TODOS.md` exists. Only include the `test_health` field if test files were found (command 10 returns > 0). If any has no data, omit the field entirely.

Include test health data in the JSON when test files exist:

```json
  "test_health": {
    "total_test_files": 47,
    "tests_added_this_period": 5,
    "regression_test_commits": 3,
    "test_files_changed": 8
  }
```

Include backlog data in the JSON when TODOS.md exists:

```json
  "backlog": {
    "total_open": 28,
    "p0_p1": 2,
    "p2": 8,
    "completed_this_period": 3,
    "added_this_period": 1
  }
```
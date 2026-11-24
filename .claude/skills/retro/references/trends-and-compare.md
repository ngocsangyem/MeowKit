# Trends, snapshots and compare

## Snapshot

`scripts/retro-metrics.cjs --write-snapshot tasks/reports/retros` writes `<date>-<n>.json` (n counts today's snapshots). It holds the script's metrics for the window. Add fields it cannot compute (backlog, review signal, test health, plan completion) by editing the JSON with a short script or by noting them in the narrative; omit a field with no data.

## Against the last retro

`ls -t tasks/reports/retros/*.json` (skip `global-*` files). If a prior snapshot exists, read the newest and show the deltas for the key metrics:

```
                    Last        Now         Delta
Test ratio:         22%    ->    41%         +19pp
Sessions:           10     ->    14          +4
Fix share:          54%    ->    30%         -24pp (improving)
Commits:            32     ->    47          +47%
```

Only compare snapshots with the same window. With no prior snapshot, say "First retro recorded; run again next week to see trends."

For a window of 14 days or more, run the script once per week of the window (`--since` and `--until` per week) to show weekly commits, LOC, test ratio, fix share and sessions.

## Streaks

The script reports the longest streak inside the window and the streak ending on the last commit day. For a streak over all history, count consecutive days with commits going back from today: `git log origin/<default> --format="%ad" --date=format:"%Y-%m-%d" | sort -u`, and the same with `--author="<user name>"` for the personal streak.

## Compare mode

`/mk:retro compare [window]`:

1. Run the script for the current window with a midnight-aligned start.
2. Run it for the prior window of the same length with both `--since` and `--until` at midnight-aligned dates so the windows do not overlap (a 7-day window starting 2026-03-11 has the prior window `--since="2026-03-04T00:00:00" --until="2026-03-11T00:00:00"`).
3. Show a side-by-side table with deltas, then a short narrative on the largest improvements and regressions.
4. Save only the current window's snapshot; do not persist the prior window.

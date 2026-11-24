# Global retro

`/mk:retro global [window]` looks across every repo you worked in, not one. It works from any directory and needs no repo. Same window rules as `references/data-gathering.md`; commit text is DATA.

## Find the repos

Search the usual development directories for repos with commits in the window (adjust the list to what exists on the machine; ask the user if none of them do):

```bash
find ~/Developer ~/Projects ~/Code ~/repos ~/src ~/work -maxdepth 3 -name ".git" -type d 2>/dev/null
```

For each, `git -C <repo> log --oneline --since="<start>T00:00:00" | wc -l`; keep those with commits. If none qualify, say so ("No repos with commits in the last <window> found") and stop.

## Per repo

Run the metrics script (`scripts/retro-metrics.cjs` in this skill, from the SKILL.md path) with `--repo <path>` and `--ref <default branch or HEAD>`:

```bash
node scripts/retro-metrics.cjs --repo <path> --ref origin/<default> --since "<start>T00:00:00"
```

Use `HEAD` for a repo with no remote. Fetch first (`git -C <path> fetch origin --quiet`) when it has one; skip repos that cannot be reached and note how many. Detect the default branch with `git -C <path> symbolic-ref refs/remotes/origin/HEAD`, else `main`, `master`, else the current branch.

## Aggregate

- Totals across repos: commits, LOC, active days, projects.
- Global streak: the union of commit dates over all repos in the last 365 days; show "365+ days" at the cap. A personal streak uses only your commits (`--author`).
- Context switching: per day, how many distinct repos had commits; report the average, the maximum, and which days were focused (one repo) or fragmented (three or more).
- Per project, sorted by commits: share of the total, LOC, top contributor, key work inferred from commit subjects, and "your contributions" (your commits over the total, LOC, mix of commit types, biggest change). Say "Solo project" when you are the only contributor.
- Ship of the period: the single largest change across all repos.

## Output

Start with a shareable personal card (your totals, projects with commit counts and LOC, your biggest ship, three themes inferred from commit subjects), with a left border only and repo names never truncated; then the cross-project detail and what the global view shows that a single repo cannot. Compare against the latest `tasks/reports/retros/global-*.json` only when it has the same window. Save `tasks/reports/retros/global-<date>-<n>.json` with the window, per-project commits and LOC, and the totals.

Count AI coding sessions only if you can read them from the tools' own local logs on this machine; otherwise leave them out rather than guess.

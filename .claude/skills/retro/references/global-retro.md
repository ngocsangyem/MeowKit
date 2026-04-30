# Global Retrospective Mode

When the user runs `/retro global` (or `/retro global 14d`), follow this flow instead of the repo-scoped Steps 1-14. This mode works from any directory — it does NOT require being inside a git repo.

## Contents

- [Global Step 1: Compute time window](#global-step-1-compute-time-window)
- [Global Step 2: Discover repos](#global-step-2-discover-repos)
- [Global Step 3: Run git log on each discovered repo](#global-step-3-run-git-log-on-each-discovered-repo)
- [Global Step 4: Compute global shipping streak](#global-step-4-compute-global-shipping-streak)
- [Global Step 5: Compute context switching metric](#global-step-5-compute-context-switching-metric)
- [Global Step 6: Per-tool productivity patterns](#global-step-6-per-tool-productivity-patterns)
- [Global Step 7: Aggregate and generate narrative](#global-step-7-aggregate-and-generate-narrative)
  - [Your Week: [user name] — [date range]](#your-week-user-name-date-range)
  - [Global Engineering Retro: [date range]](#global-engineering-retro-date-range)
- [Global Step 8: Load history & compare](#global-step-8-load-history-compare)
- [Global Step 9: Save snapshot](#global-step-9-save-snapshot)


## Global Step 1: Compute time window

Same midnight-aligned logic as the regular retro. Default 7d. The second argument after `global` is the window (e.g., `14d`, `30d`, `24h`).

## Global Step 2: Discover repos

This skill uses a simple git-based discovery approach (no external binary needed):

```bash
# Find all git repos in common development directories
find ~/Developer ~/Projects ~/Code ~/repos ~/src ~/work -maxdepth 3 -name ".git" -type d 2>/dev/null | while read gitdir; do
  REPO_DIR=$(dirname "$gitdir")
  # Check if repo has commits in the time window
  COMMIT_COUNT=$(git -C "$REPO_DIR" log --oneline --since="<window>" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$COMMIT_COUNT" -gt 0 ]; then
    REPO_NAME=$(basename "$REPO_DIR")
    echo "{\"path\":\"$REPO_DIR\",\"name\":\"$REPO_NAME\",\"commits\":$COMMIT_COUNT}"
  fi
done
```

If no repos with recent commits are found, tell the user: "No repos with commits in the last <window> found. Check your development directories." and stop.

If `total_sessions` is 0, say: "No AI coding sessions found in the last <window>. Try a longer window: `/retro global 30d`" and stop.

## Global Step 3: Run git log on each discovered repo

For each repo in the discovery JSON's `repos` array, find the first valid path in `paths[]` (directory exists with `.git/`). If no valid path exists, skip the repo and note it.

**For local-only repos** (where `remote` starts with `local:`): skip `git fetch` and use the local default branch. Use `git log HEAD` instead of `git log origin/$DEFAULT`.

**For repos with remotes:**

```bash
git -C <path> fetch origin --quiet 2>/dev/null
```

Detect the default branch for each repo: first try `git symbolic-ref refs/remotes/origin/HEAD`, then check common branch names (`main`, `master`), then fall back to `git rev-parse --abbrev-ref HEAD`. Use the detected branch as `<default>` in the commands below.

```bash
# Commits with stats
git -C <path> log origin/$DEFAULT --since="<start_date>T00:00:00" --format="%H|%aN|%ai|%s" --shortstat

# Commit timestamps for session detection, streak, and context switching
git -C <path> log origin/$DEFAULT --since="<start_date>T00:00:00" --format="%at|%aN|%ai|%s" | sort -n

# Per-author commit counts
git -C <path> shortlog origin/$DEFAULT --since="<start_date>T00:00:00" -sn --no-merges

# PR numbers from commit messages
git -C <path> log origin/$DEFAULT --since="<start_date>T00:00:00" --format="%s" | grep -oE '#[0-9]+' | sort -n | uniq
```

For repos that fail (deleted paths, network errors): skip and note "N repos could not be reached."

## Global Step 4: Compute global shipping streak

For each repo, get commit dates (capped at 365 days):

```bash
git -C <path> log origin/$DEFAULT --since="365 days ago" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

Union all dates across all repos. Count backward from today — how many consecutive days have at least one commit to ANY repo? If the streak hits 365 days, display as "365+ days".

## Global Step 5: Compute context switching metric

From the commit timestamps gathered in Step 3, group by date. For each date, count how many distinct repos had commits that day. Report:
- Average repos/day
- Maximum repos/day
- Which days were focused (1 repo) vs. fragmented (3+ repos)

## Global Step 6: Per-tool productivity patterns

From the discovery JSON, analyze tool usage patterns:
- Which AI tool is used for which repos (exclusive vs. shared)
- Session count per tool
- Behavioral patterns (e.g., "Codex used exclusively for myapp, Claude Code for everything else")

## Global Step 7: Aggregate and generate narrative

Structure the output with the **shareable personal card first**, then the full
team/project breakdown below. The personal card is designed to be screenshot-friendly
— everything someone would want to share on X/Twitter in one clean block.

---

**Tweetable summary** (first line, before everything else):
```
Week of Mar 14: 5 projects, 138 commits, 250k LOC across 5 repos | 48 AI sessions | Streak: 52d
```

### Your Week: [user name] — [date range]

This section is the **shareable personal card**. It contains ONLY the current user's
stats — no team data, no project breakdowns. Designed to screenshot and post.

Use the user identity from `git config user.name` to filter all per-repo git data.
Aggregate across all repos to compute personal totals.

Render as a single visually clean block. Left border only — no right border (LLMs
can't align right borders reliably). Pad repo names to the longest name so columns
align cleanly. Never truncate project names.

```
+===================================================================
|  [USER NAME] — Week of [date]
+===================================================================
|
|  [N] commits across [M] projects
|  +[X]k LOC added . [Y]k LOC deleted . [Z]k net
|  [N] AI coding sessions (CC: X, Codex: Y, Gemini: Z)
|  [N]-day shipping streak
|
|  PROJECTS
|  ---------------------------------------------------------
|  [repo_name_full]        [N] commits    +[X]k LOC    [solo/team]
|  [repo_name_full]        [N] commits    +[X]k LOC    [solo/team]
|  [repo_name_full]        [N] commits    +[X]k LOC    [solo/team]
|
|  SHIP OF THE WEEK
|  [PR title] — [LOC] lines across [N] files
|
|  TOP WORK
|  . [1-line description of biggest theme]
|  . [1-line description of second theme]
|  . [1-line description of third theme]
|
|  Powered by this kit
+===================================================================
```

**Rules for the personal card:**
- Only show repos where the user has commits. Skip repos with 0 commits.
- Sort repos by user's commit count descending.
- **Never truncate repo names.** Use the full repo name (e.g., `analyze_transcripts`
  not `analyze_trans`). Pad the name column to the longest repo name so all columns
  align. If names are long, widen the box — the box width adapts to content.
- For LOC, use "k" formatting for thousands (e.g., "+64.0k" not "+64010").
- Role: "solo" if user is the only contributor, "team" if others contributed.
- Ship of the Week: the user's single highest-LOC PR across ALL repos.
- Top Work: 3 bullet points summarizing the user's major themes, inferred from
  commit messages. Not individual commits — synthesize into themes.
  E.g., "Built /mk:retro global — cross-project retrospective with AI session discovery"
  not "feat: repo discovery" + "feat: /mk:retro global template".
- The card must be self-contained. Someone seeing ONLY this block should understand
  the user's week without any surrounding context.
- Do NOT include team members, project totals, or context switching data here.

**Personal streak:** Use the user's own commits across all repos (filtered by
`--author`) to compute a personal streak, separate from the team streak.

---

### Global Engineering Retro: [date range]

Everything below is the full analysis — team data, project breakdowns, patterns.
This is the "deep dive" that follows the shareable card.

#### All Projects Overview
| Metric | Value |
|--------|-------|
| Projects active | N |
| Total commits (all repos, all contributors) | N |
| Total LOC | +N / -N |
| AI coding sessions | N (CC: X, Codex: Y, Gemini: Z) |
| Active days | N |
| Global shipping streak (any contributor, any repo) | N consecutive days |
| Context switches/day | N avg (max: M) |

#### Per-Project Breakdown
For each repo (sorted by commits descending):
- Repo name (with % of total commits)
- Commits, LOC, PRs merged, top contributor
- Key work (inferred from commit messages)
- AI sessions by tool

**Your Contributions** (sub-section within each project):
For each project, add a "Your contributions" block showing the current user's
personal stats within that repo. Use the user identity from `git config user.name`
to filter. Include:
- Your commits / total commits (with %)
- Your LOC (+insertions / -deletions)
- Your key work (inferred from YOUR commit messages only)
- Your commit type mix (feat/fix/refactor/chore/docs breakdown)
- Your biggest ship in this repo (highest-LOC commit or PR)

If the user is the only contributor, say "Solo project — all commits are yours."
If the user has 0 commits in a repo (team project they didn't touch this period),
say "No commits this period — [N] AI sessions only." and skip the breakdown.

Format:
```
**Your contributions:** 47/244 commits (19%), +4.2k/-0.3k LOC
  Key work: Writer Chat, email blocking, security hardening
  Biggest ship: PR #605 — Writer Chat eats the admin bar (2,457 ins, 46 files)
  Mix: feat(3) fix(2) chore(1)
```

#### Cross-Project Patterns
- Time allocation across projects (% breakdown, use YOUR commits not total)
- Peak productivity hours aggregated across all repos
- Focused vs. fragmented days
- Context switching trends

#### Tool Usage Analysis
Per-tool breakdown with behavioral patterns:
- Claude Code: N sessions across M repos — patterns observed
- Codex: N sessions across M repos — patterns observed
- Gemini: N sessions across M repos — patterns observed

#### Ship of the Week (Global)
Highest-impact PR across ALL projects. Identify by LOC and commit messages.

#### 3 Cross-Project Insights
What the global view reveals that no single-repo retro could show.

#### 3 Habits for Next Week
Considering the full cross-project picture.

---

## Global Step 8: Load history & compare

```bash
ls -t .claude/memory/retros/global-*.json 2>/dev/null | head -5
```

**Only compare against a prior retro with the same `window` value** (e.g., 7d vs 7d). If the most recent prior retro has a different window, skip comparison and note: "Prior global retro used a different window — skipping comparison."

If a matching prior retro exists, load it with the Read tool. Show a **Trends vs Last Global Retro** table with deltas for key metrics: total commits, LOC, sessions, streak, context switches/day.

If no prior global retros exist, append: "First global retro recorded — run again next week to see trends."

## Global Step 9: Save snapshot

```bash
mkdir -p .claude/memory/retros
```

Determine the next sequence number for today:
```bash
today=$(date +%Y-%m-%d)
existing=$(ls .claude/memory/retros/global-${today}-*.json 2>/dev/null | wc -l | tr -d ' ')
next=$((existing + 1))
```

Use the Write tool to save JSON to `.claude/memory/retros/global-${today}-${next}.json`:

```json
{
  "type": "global",
  "date": "2026-03-21",
  "window": "7d",
  "projects": [
    {
      "name": "{project-slug}",
      "remote": "https://github.com/{org}/{repo}",
      "commits": 47,
      "insertions": 3200,
      "deletions": 800,
      "sessions": { "claude_code": 15, "codex": 3, "gemini": 0 }
    }
  ],
  "totals": {
    "commits": 182,
    "insertions": 15300,
    "deletions": 4200,
    "projects": 5,
    "active_days": 6,
    "sessions": { "claude_code": 48, "codex": 8, "gemini": 3 },
    "global_streak_days": 52,
    "avg_context_switches_per_day": 2.1
  },
  "tweetable": "Week of Mar 14: 5 projects, 182 commits, 15.3k LOC | CC: 48, Codex: 8, Gemini: 3 | Focus: {project} (58%) | Streak: 52d"
}
```
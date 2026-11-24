# Window and arguments

## Arguments

- `/mk:retro` is the last 7 days.
- `24h`, `14d`, `30d`, `2w` set the window (number plus `h`, `d` or `w`).
- `compare [window]` compares the window with the prior window of the same length.
- `global [window]` is cross-repo (`references/global-retro.md`).

An argument that matches none of these: show the usage list above and stop.

## Midnight-aligned start

For day and week units, compute an absolute start date at local midnight and pass `--since="<date>T00:00:00"` to the script. Without the time suffix, git starts at the current wall-clock time, so a 7-day window run at 11pm would silently start at 11pm. Weeks are 7 days. Sub-day windows use `--since="N hours ago"`. Report every time in the local timezone; do not set `TZ`.

## Branch and user

Use `origin/<default>`, not a local `main` that may be stale: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`, else `main`. The name from `git config user.name` is "you" in the narrative; everyone else is a teammate.

## Metrics the script does not compute

- Backlog health (if `TODOS.md` exists): open items, P0 and P1, P2, completed this period.
- Review signal (if `.meowkit/telemetry/reviews.jsonl` has entries in the window): `(fix + already-fixed) / (fix + already-fixed + fp)`.
- Skill usage (if `.meowkit/telemetry/skill-usage.jsonl` has entries in the window): count per skill.
- Test health: test files in the repo (`find . -name '*.test.*' -o -name '*.spec.*'`, excluding `node_modules`), test files changed in the window, and commits whose subject starts `test(qa):`, `test(design):` or `test: coverage`.
- Plan completion: from `.meowkit/telemetry/*-reviews.jsonl` lines with `"skill":"ship"` and `plan_items_total`, branches shipped with plans and average completion.

Each is optional: skip a source that does not exist.

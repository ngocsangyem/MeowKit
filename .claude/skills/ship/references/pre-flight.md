# Pre-flight: base branch, ship mode, review readiness

## Base branch

Use the base branch for every later `git diff`, `git log`, `git merge` and `gh pr create`.

1. If a PR already exists for the branch: `gh pr view --json baseRefName -q .baseRefName`.
2. Otherwise the default branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`.
3. If both fail, use `main`.

If the current branch is the base or the repo's default branch, stop: ship from a feature branch.

## Ship mode (`official` / `beta`)

- `official`: target the default branch.
- `beta`: target the first of `dev`, `beta`, `develop` that exists as `origin/<name>` (`git rev-parse --verify origin/<name>`).
- No argument: `feature/*`, `hotfix/*`, `bugfix/*`, `fix/*` mean official; `dev/*`, `beta/*`, `experiment/*` mean beta; anything else, ask which.

## Working tree

Run `git status` (without `-uall`). If there are uncommitted changes, list the paths and ask which to include; none are included without a yes. Then `git diff <base>...HEAD --stat` and `git log <base>..HEAD --oneline` show what is being shipped.

With `--dry-run`, print the scope, target branch, test command and proposed version action, then stop.

## Review readiness

Run this before merging the base, so files the base brings in are not mistaken for changes since the review.

The review verdict is the authority: read `tasks/reviews/*-verdict.md` for this change. Missing, or any FAIL dimension, means the change is not ready; say so and ask.

Check the verdict still describes what ships. Read `reviewed_commit`, `reviewed_dirty` and `reviewed_files` from the `-verdict.json` beside it (or the **Reviewed commit** line of the markdown):

1. List what differs from the reviewed commit: `git diff --name-only <sha>` (the working tree against that commit, so commits made since are included), plus the untracked paths being shipped. Keep only paths this ship carries: those in `git diff --name-only origin/<base>...HEAD` or among the approved uncommitted paths. Files a base merge brought in, or dirty files the user left out, are not changes to the reviewed work.
2. If the review saw uncommitted work (`reviewed_dirty` true), drop each path whose content is unchanged since: its `git hash-object <path>` equals its `reviewed_files` entry, or it was deleted then and is still absent. Committing reviewed work therefore does not make the verdict stale.
3. From what remains, drop CHANGELOG, VERSION, TODOS, plan and review files under `tasks/`, and documentation meant only for people (README files, a `docs/` tree). A file an agent or tool reads as instructions (SKILL.md, rules, agent definitions, CLAUDE.md, AGENTS.md, prompts) counts as code.

- Nothing left: the verdict is current.
- Code, test or build-input files left: say "the verdict is stale: N files changed since review", name them, and ask: run `mk:review` again, or ship anyway (record that answer as below).
- The sha is not in this branch's history (rebased or amended): treat the verdict as stale.
- A dirty review without `reviewed_files`, or no reviewed commit at all (a verdict written before these fields existed): use the review-log check below and say what the verdict lacks. This alone does not block.

If `workflow-evidence.json` exists (`tasks/plans/<plan>/reports/evidence/`, else `.meowkit/state/evidence/<slug>/`), report `approvals.ship`, `review.verdictPath` and `review.status`, `verification.overall` and `risk.requiresHumanApproval`. Evidence is proof, never approval, and it never overrides a `mk:verify` FAIL. Contract: `.claude/skills/advise/references/workflow-evidence-rules.md`. If the file is absent, carry on.

`.claude/hooks/lib/workflow-review-log` prints recent review entries by skill. Read it for staleness: for an entry with a `commit` field, count `git rev-list --count <commit>..HEAD` and mention reviews that are many commits old. CEO and design reviews are context only and never block. When the Eng Review is missing, ask: ship anyway, abort and run `mk:review`, or the change is too small to need one (under about 20 lines, typo or config only). Record a "ship anyway" or "not relevant" answer in `.meowkit/telemetry/$BRANCH-reviews.jsonl` (`eval "$(.claude/hooks/lib/workflow-slug)"` sets `$BRANCH`) so the same branch is not asked twice.

## Merge the base

Tests should run on what the PR will become, so bring the base in before verifying. Never rebase or force here.

1. `git fetch origin <base>`. No `origin` remote, or the fetch fails: say so, skip the merge, and verify the branch as it is.
2. Uncommitted changes are being shipped: do not merge now, because git refuses a merge over local edits and an aborted merge can lose them. Report how far the base is ahead (`git rev-list --count HEAD..origin/<base>`); the merge happens after the local commit, before any push (`references/commit-push-pr.md`).
3. Otherwise `git merge origin/<base> --no-edit`. A conflict confined to a lockfile or a version file may be resolved and named in the summary; any other conflict: `git merge --abort` (safe on a clean tree) and stop BLOCKED with the conflicting paths.

## Verification

Run `mk:verify` once, on the merged base when step 3 above ran. A FAIL stops the run with the failing step and its errors. `--skip-tests` is allowed only with the user's confirmation that current-session evidence is enough.

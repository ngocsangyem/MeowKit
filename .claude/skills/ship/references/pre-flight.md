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

## Verification

Run `mk:verify` on the merged base once. A FAIL stops the run with the failing step and its errors. `--skip-tests` is allowed only with the user's confirmation that current-session evidence is enough.

## Review readiness

The review verdict is the authority: read `tasks/reviews/*-verdict.md` for this change. Missing, or any FAIL dimension, means the change is not ready; say so and ask.

If `workflow-evidence.json` exists (`tasks/plans/<plan>/reports/evidence/`, else `.meowkit/state/evidence/<slug>/`), report `approvals.ship`, `review.verdictPath` and `review.status`, `verification.overall` and `risk.requiresHumanApproval`. Evidence is proof, never approval, and it never overrides a `mk:verify` FAIL. Contract: `.claude/skills/advise/references/workflow-evidence-rules.md`. If the file is absent, carry on.

`.claude/hooks/lib/workflow-review-log` prints recent review entries by skill. Read it for staleness: for an entry with a `commit` field, count `git rev-list --count <commit>..HEAD` and mention reviews that are many commits old. CEO and design reviews are context only and never block. When the Eng Review is missing, ask: ship anyway, abort and run `mk:review`, or the change is too small to need one (under about 20 lines, typo or config only). Record a "ship anyway" or "not relevant" answer in `.meowkit/telemetry/$BRANCH-reviews.jsonl` (`eval "$(.claude/hooks/lib/workflow-slug)"` sets `$BRANCH`) so the same branch is not asked twice.

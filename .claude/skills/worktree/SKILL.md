---
name: mk:worktree
description: "Git worktree lifecycle for agents. NOT for mk:team-config."
argument-hint: '[create|merge|cleanup|list|status|prune] [agent-name]'
source: local
keywords:
  - worktree
  - git-worktree
  - parallel-isolation
  - parallel-agents
  - branch-setup
  - task-decomposition
  - orchestration
  - worktree-cleanup
  - worktree-status
  - worktree-health
when_to_use: "Parallel agents need branches."
user-invocable: false
owner: git
criticality: medium
status: active
runtime: claude-code
---

# Git Worktree Manager

Manages git worktrees for parallel agent isolation. Each parallel agent works in its own
worktree to prevent file conflicts. Backed by `scripts/worktree.cjs`.

See `references/commands.md` for full option reference and JSON field docs.

## Actions

### create

Pre-flight: get repo info, then create a parallel worktree.

```bash
# Step 1: verify repo state
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs info --json

# Step 2: create parallel agent worktree
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs create "{agent-name}" --orchestrated --json
```

Before the first parallel worktree in a repo, make sure `.worktrees/` is in `.gitignore`;
if not, append it:

```bash
echo '.worktrees/' >> .gitignore
```

The script places the worktree at `.worktrees/{agent-name}` on branch
`parallel/{agent-name}-{timestamp}` per `.claude/skills/cook/references/parallel-execution-rules.md` Rule 3.

### merge

Merge a completed parallel branch back to the feature branch using no-fast-forward:

```bash
git merge --no-ff {branch} -m "merge: parallel/{agent-name} into {feature-branch}"
```

On conflict: list the conflicting files, stop and report to the lead (see Gotchas).

On success: run the full test suite (.claude/skills/cook/references/parallel-execution-rules.md Rule 5). After integration
test passes, delegate to `project-manager` (background):

```
"Generate delivery status for plan at {plan-dir}. Write report to
{plan-dir}/status-reports/{YYMMDD}-status.md (create subdir if absent).
Load template from .claude/skills/status/assets/pm-status-template.md.
Run in the background — do not block the caller."
```

Skip PM delegation if `MEOWKIT_PM_AUTO=off` is set in environment.

### cleanup

Before removing a worktree, ensure the parallel agent has released its task ownership
in `mk:task-queue`. Then:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs remove "{agent-name}" --json
```

### list

```bash
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs list --json
```

### status

Health audit of all active worktrees (ahead/behind divergence, dirty state):

```bash
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs status --json
```

### prune

Clean stale worktree metadata. Always dry-run first:

```bash
# Safe first-pass
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs prune --dry-run --json
# Execute if no surprises
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs prune --json
```

### review-pr

Create an isolated, **detached**, SHA-bound worktree from a PR head for a
high-assurance review (never mutates the user's checkout). The base remote is a
required argument — `pull/N/head` exists only on the PR's base repo, so a fork PR is
fetched from the base remote, never a fork remote. Writes a manifest to the persistent
session dir `tasks/reviews/<session>/manifest.json` (survives worktree removal) and a
`.mewkit-review.json` back-reference (ownership nonce) inside the worktree.

```bash
# Preview only (no fetch, no worktree) — validates inputs, prints the manifest
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs review-pr --pr 123 --remote origin --session <id> --dry-run --json
# Create for real
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs review-pr --pr 123 --remote origin --session <id> --json
```

### review-pr-cleanup

Remove a review worktree. Accepts **only a manifest path** — nothing else. Removal
proceeds only when the manifest's nonce matches the in-worktree back-reference AND the
target is a detached `.worktrees/review-pr-*` worktree (never the main checkout, never a
feature worktree). Force is allowed (review worktrees are legitimately dirty after
build/test); ownership, not cleanliness, is the guard.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs review-pr-cleanup --manifest tasks/reviews/<id>/manifest.json --json
# Stale-session sweep — dry-run by default; --apply to execute
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs review-pr-cleanup --sweep --dry-run --json
```

## Gotchas

One list, each rule with its reason.

- **Never create worktrees on `main` or `master`**; use a feature branch, so parallel work never lands on the protected branch.
- **Add `.worktrees/` to `.gitignore` before the first parallel run**, or the worktree directories show up as untracked files.
- **Never force-push from a worktree.** Worktrees share one `.git`, so a force-push rewrites history for the main checkout too.
- **Never remove a worktree with uncommitted changes**; commit or stash first, or the work is lost. (`review-pr-cleanup` is the exception: review worktrees are legitimately dirty, and the manifest nonce is the guard.)
- **Clean up worktrees after merge.** A stale worktree keeps its branch checked out and blocks reuse of the name.
- **Release the task's ownership in `mk:task-queue` before cleanup**, or the task stays claimed and no other agent can take it.
- **Keep to three active worktrees**: the cap in `.claude/skills/cook/references/parallel-execution-rules.md` Rule 2. The script does not enforce it; `status` lists the worktrees so you can count.
- **Stop on merge conflicts** (common in `SKILL.md` and `CLAUDE.md` during parallel runs), report to the lead, and do not auto-resolve: a human or the lead agent decides.
- **`review-pr` worktrees are detached** (no branch) and owned by their manifest nonce; `review-pr-cleanup` refuses any worktree whose back-reference nonce does not match, which is what makes cross-session deletion impossible.
- **Creation fails if the branch already exists** (`BRANCH_CHECKED_OUT`); timestamps in orchestrated branch names prevent most collisions.
- **`git worktree remove` fails silently if the directory was already deleted by hand**; the script checks existence first via `getWorktreeRecords()`.

## Integration

- Called by orchestrator (`mk:cook`, `mk:workflow-orchestrator`) when decomposing COMPLEX tasks
- Coordinates with `mk:task-queue` for task claiming and ownership enforcement during parallel runs
- Delegates to `project-manager` after merge integration test passes
  (post-phase-delegation Rule 1, background mode)
- Respects `MEOWKIT_PM_AUTO=off` — skip PM delegation when set
- Not invoked directly by users

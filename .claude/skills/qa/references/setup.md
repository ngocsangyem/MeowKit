# QA Setup & Configuration


## Contents

- [Step 0: Detect base branch](#step-0-detect-base-branch)
- [Parameters](#parameters)
- [Clean Working Tree Check](#clean-working-tree-check)
- [Find the Browse Binary](#find-the-browse-binary)
- [Test framework](#test-framework)
- [Create Output Directories](#create-output-directories)
- [Test Plan Context](#test-plan-context)

## Step 0: Detect base branch

Determine which branch this PR targets. Use the result as "the base branch" in all subsequent steps.

1. Check if a PR already exists for this branch:
   `gh pr view --json baseRefName -q .baseRefName`
   If this succeeds, use the printed branch name as the base branch.

2. If no PR exists (command fails), detect the repo's default branch:
   `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`

3. If both commands fail, fall back to `main`.

Print the detected base branch name. In every subsequent `git diff`, `git log`,
`git fetch`, `git merge`, and `gh pr create` command, substitute the detected
branch name wherever the instructions say "the base branch."

---

## Parameters

**Parse the user's request for these parameters:**

| Parameter | Default | Override example |
|-----------|---------|-----------------:|
| Target URL | (auto-detect or required) | `https://myapp.com`, `http://localhost:3000` |
| Tier | Standard | `--quick`, `--exhaustive` |
| Mode | full | `--regression tasks/reports/qa/baseline.json` |
| Output dir | `tasks/reports/qa/` | `Output to /tmp/qa` |
| Scope | Full app (or diff-scoped) | `Focus on the billing page` |
| Auth | None | `Sign in to user@example.com`, `Import cookies from cookies.json` |

**Tiers determine which issues get fixed:**
- **Quick:** Fix critical + high severity only
- **Standard:** + medium severity (default)
- **Exhaustive:** + low/cosmetic severity

**If no URL is given and you're on a feature branch:** Automatically enter **diff-aware mode** (see `references/modes.md`). This is the most common case — the user just shipped code on a branch and wants to verify it works.

## Clean Working Tree Check

```bash
git status --porcelain
```

If the output is non-empty (working tree is dirty), **STOP** and ask the user:

"Your working tree has uncommitted changes. /mk:qa needs a clean tree so each bug fix gets its own atomic commit."

- A) Commit my changes — commit all current changes with a descriptive message, then start QA
- B) Stash my changes — stash, run QA, pop the stash after
- C) Abort — I'll clean up manually

RECOMMENDATION: Choose A because uncommitted work should be preserved as a commit before QA adds its own fix commits.

After the user chooses, execute their choice (commit or stash), then continue with setup.

## Find agent-browser

```bash
if command -v agent-browser >/dev/null 2>&1; then
  echo "READY: $(command -v agent-browser)"
elif command -v npx >/dev/null 2>&1 && npx --no-install agent-browser --version >/dev/null 2>&1; then
  echo "READY: npx agent-browser"
else
  echo "NEEDS_SETUP"
fi
```

If `NEEDS_SETUP`:
1. Tell the user: "The agent-browser CLI is not installed. OK to install it now?" Then STOP and wait.
2. Run: `npm i -g agent-browser@0.43.0` (or `brew install agent-browser`, or `cargo install agent-browser`).
3. After install, run `agent-browser install` once to download Chrome.

## Test framework

Regression tests (see `fix-loop.md`) are written only when the project already has a test framework. If it has none, skip them and say so in the report. Setting up a framework is a separate request: it installs packages and edits project files, which this skill does not do.

## Create Output Directories

```bash
mkdir -p tasks/reports/qa/screenshots
```

## Test Plan Context

Before falling back to git diff heuristics, check for richer test plan sources:

1. **Plans:** check `tasks/plans/` for a plan or test plan that covers the branch
2. **Conversation context:** Check whether a prior `/mk:plan-ceo-review` produced test plan output in this conversation
3. **Use whichever source is richer.** Fall back to git diff analysis only if neither is available.
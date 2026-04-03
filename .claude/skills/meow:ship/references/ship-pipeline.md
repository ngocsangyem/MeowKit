# Skill: Ship Pipeline

**Purpose:** Complete, standalone pipeline for shipping code from local branch to merged PR. Never push directly to main/master.

## When to Use

Invoke this skill when code is ready to ship — all development and review is complete.

---

## Steps

### Step 1: Pre-Ship Validation

Run ALL of the following. Every check must pass before proceeding.

```bash
# Run tests
npm test          # or: yarn test, pytest, swift test

# Run linter
npm run lint      # or: yarn lint, flake8, swiftlint

# Run type checker
npx tsc --noEmit  # or: mypy, swift build

# Run validation scripts
.claude/skills/.venv/bin/python3 .claude/scripts/validate.py
.claude/skills/.venv/bin/python3 .claude/scripts/security-scan.py
```

**Gate:** If ANY command exits with a non-zero code, STOP. Fix the issue before proceeding.

### Step 2: Generate Conventional Commit Message

Analyze the changes and generate a commit message following the conventional commits spec:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `perf`, `test`, `ci`

**Rules:**
- Type is lowercase
- Scope is the module/area affected
- Description is imperative mood, no period at end
- Body explains "why" not "what" (the diff shows "what")
- Breaking changes get `BREAKING CHANGE:` footer

### Step 3: Create Feature Branch (if needed)

If currently on `main` or `master`, create a feature branch:

```bash
# Check current branch
current=$(git branch --show-current)

if [ "$current" = "main" ] || [ "$current" = "master" ]; then
  branch_name="feat/$(echo "$description" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
  git checkout -b "$branch_name"
fi
```

**Never ship from main/master directly.**

### Step 4: Commit and Push

```bash
# Stage changes
git add [specific files]  # Never use git add -A blindly

# Commit
git commit -m "<conventional commit message>"

# Push with upstream tracking
git push -u origin $(git branch --show-current)
```

### Step 5: Create PR via gh CLI

```bash
gh pr create \
  --title "<type>(<scope>): <short description>" \
  --body "$(cat <<'EOF'
## Summary
- [What this PR does]
- [Why it's needed]

## Changes
- [List of key changes]

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing done for [specific scenarios]

## Rollback
- Revert commit: `git revert <sha>`
- Verify: [what to check after rollback]
EOF
)"
```

### Step 6: Wait for CI

After creating the PR:

1. Check CI status: `gh pr checks`
2. If CI fails, investigate and fix locally, then push again.
3. Do not merge until all CI checks pass.

### Step 7: Document Rollback

Every shipped change must have a rollback plan documented in the PR description (see Step 5) and in `docs/rollback/` if the change is high-risk. See `shipping/rollback-protocol.md` for the full template.

---

## Rules

- **Never** push directly to main/master.
- **Never** force push to a shared branch.
- **Never** merge with failing CI.
- **Never** skip pre-ship validation "just this once."
- **Always** use specific file names with `git add`, not `-A` or `.`.
- **Always** include a rollback plan in the PR description.

## Quick Reference

```
Pre-ship checks → Commit → Branch → Push → PR → CI → Merge
     ↓                                         ↓
   FAIL → fix                              FAIL → fix → push
```

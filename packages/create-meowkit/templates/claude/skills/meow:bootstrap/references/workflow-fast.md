# Workflow: Fast (--fast)

No user gates. Maximum speed. Skip research and design. Good for prototypes and hackathons.

## Step 0: Git Init

Auto: `git init && git add -A && git commit -m "chore: initial commit"`

## Step 1: Combined Research + Stack

Spawn 6 researcher subagents in parallel (all ≤150 lines):
- 2 researchers: validate idea + competition
- 2 researchers: tech stack recommendation + best practices
- 2 researchers: design patterns + architecture reference

No gate — merge findings and proceed.

## Step 2: Scaffold Files

1. Auto-detect or select stack from research findings
2. Follow `references/scaffolding-principles.md`
3. Generate all: config → source → tests (progressive but no user confirmation)
4. Validate with `scripts/validate-bootstrap.sh`
5. Save config.json

## Step 3: Planning

Invoke meow:plan-creator:
```
/meow:plan-creator [requirements summary] (with --fast flag)
```

## Step 4: Implementation → Docs

Load `references/shared-phases.md` and execute.

## Step 5: Auto-commit

After all phases complete: auto-commit (no push).
```
git add -A && git commit -m "feat: bootstrap [project-name]"
```

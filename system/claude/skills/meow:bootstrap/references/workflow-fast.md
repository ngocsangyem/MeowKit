# Workflow: Fast (--fast)

No user gates. Maximum speed. Skip design. Good for prototypes and hackathons.

## Step 0: Git Init

Auto: `git init && git add -A && git commit -m "chore: initial commit"`

## Step 1: Combined Research + Stack

Spawn 6 researcher subagents in parallel (all ≤150 lines):
- 2 researchers: validate idea + competition
- 2 researchers: tech stack recommendation + best practices
- 2 researchers: design patterns + architecture reference

No gate — merge findings and proceed IMMEDIATELY to Step 2.

## Step 2: Planning (MANDATORY — comes BEFORE scaffolding)

**Pre-condition:** Research reports and design guidelines from prior steps already exist.
Plan-creator will detect these and skip its own discovery step (no duplicate research).

**ACTION REQUIRED:** Activate meow:plan-creator skill NOW:

```
/meow:plan-creator [requirements summary] --fast
```

No gate — plan-creator in fast mode auto-creates plan without user approval.
The plan defines WHAT gets scaffolded in Step 3.

**After plan created: proceed IMMEDIATELY to Step 3. Do NOT stop.**

## Step 3: Scaffold Files (guided by plan)

1. Auto-detect or select stack from research findings
2. Follow the plan's architecture + `references/scaffolding-principles.md`
3. Generate all: config → source → tests (progressive but no user confirmation)
4. Validate with `scripts/validate-bootstrap.sh`
5. Save config.json

**After scaffold validates: proceed IMMEDIATELY to Step 4. Do NOT stop.**

## Step 4: Implementation → Docs (MANDATORY)

**ACTION REQUIRED:** Load `references/shared-phases.md` and execute ALL phases:

1. **Phase A:** Activate meow:cook skill: `/meow:cook [plan-path] --auto`
2. **Phase B:** Activate meow:docs-init for documentation
3. **Phase C:** Print final report

## Step 5: Auto-commit

After all phases complete: auto-commit (no push).
```
git add -A && git commit -m "feat: bootstrap [project-name]"
```

**The bootstrap is NOT complete until commit is done.**

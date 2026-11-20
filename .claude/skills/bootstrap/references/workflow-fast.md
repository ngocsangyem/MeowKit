# Workflow: Fast (--fast)

No user approval steps. Maximum speed. Skip design. Good for prototypes and hackathons.

## Step 0: Git Init

Auto: `git init && git add -A && git commit -m "chore: initial commit"`

## Step 1: Combined Research + Stack

Spawn 6 researcher subagents in parallel (all ≤150 lines):

Include the save path in each researcher's prompt:
- "Research [topic]. Save report to tasks/reports/researcher-01-[topic-slug].md"- 2 researchers: validate idea + competition
- 2 researchers: tech stack recommendation + best practices
- 2 researchers: design patterns + architecture reference

No approval step — merge findings and proceed IMMEDIATELY to Step 2.

## Step 2: Planning (before scaffolding)

**Pre-condition:** Research reports and design guidelines from prior steps already exist.
Plan-creator will detect these and skip its own discovery step (no duplicate research).

Activate mk:plan-creator skill:

```
/mk:plan-creator [requirements summary] --fast
```

No approval step — plan-creator in fast mode auto-creates plan without user approval.
The plan defines WHAT gets scaffolded in Step 3.

**After plan created: proceed IMMEDIATELY to Step 3. Do NOT stop.**

## Step 3: Scaffold Files (guided by plan)

1. Auto-detect or select stack from research findings
2. Follow the plan's architecture and the scaffolding principles
3. Generate all: config → source → tests (progressive but no user confirmation)
4. Validate with `scripts/validate-bootstrap.sh`
5. Save config.json

**After scaffold validates: proceed IMMEDIATELY to Step 4. Do NOT stop.**

## Step 4: Implementation → Docs

Then run the shared phases (implementation → docs → final report) in order:

1. **Phase A:** Activate mk:cook skill: `/mk:cook [plan-path] --auto`
2. **Phase B:** Activate mk:docs-init for documentation
3. **Phase C:** Print final report

## Step 5: Auto-commit

After all phases complete: auto-commit (no push).
```
git add -A && git commit -m "feat: bootstrap [project-name]"
```

**The bootstrap is NOT complete until commit is done.**

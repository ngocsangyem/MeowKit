# Workflow: Parallel (--parallel)

Design approval only. Parallel implementation for independent components. Good for large projects.

## Step 0: Git Init

Auto: `git init && git add -A && git commit -m "chore: initial commit"`

## Step 1: Research

Spawn max 2 researcher subagents in parallel (≤150 lines each).
- Researcher 1: Tech stack + architecture patterns
- Researcher 2: Similar projects + best practices

Include the save path in each researcher's prompt:
- "Research [topic]. Save report to tasks/reports/researcher-01-[topic-slug].md"

No approval step — proceed IMMEDIATELY to Step 2.

## Step 2: Tech Stack + Design

1. Run `scripts/detect-stack.sh` or auto-select from research
2. If frontend: spawn `ui-ux-designer` for design guidelines
3. **Approval step:** User approves tech stack + design direction

**After approval: proceed IMMEDIATELY to Step 3. Do NOT stop.**

## Step 3: Parallel Planning (before scaffolding)

**Pre-condition:** Research reports and design guidelines from prior steps already exist.
Plan-creator will detect these and skip its own discovery step (no duplicate research).

Activate mk:plan-creator with parallel flag:

```
/mk:plan-creator [requirements summary] --parallel
```

Plan-creator generates phases with:
- **File ownership matrix**: which agent owns which files
- **Dependency graph**: which phases block which
- **Execution strategy**: which phases can run concurrently
- **Architecture**: modules, file structure that guides scaffolding

**After plan created: proceed IMMEDIATELY to Step 4. Do NOT stop.**

## Step 4: Scaffold Files (guided by plan)

Follow the plan's architecture and the scaffolding principles:
1. Generate directory tree matching plan's module structure → print → confirm
2. Config → source → tests (progressive)
3. Validate with `scripts/validate-bootstrap.sh`
4. Save config.json

**After scaffold validates: proceed IMMEDIATELY to Step 5. Do NOT stop.**

## Step 5: Parallel Implementation → Docs

Then run the shared phases (implementation → docs → final report) with the parallel flag:

1. **Phase A:** Activate mk:cook skill: `/mk:cook [plan-path] --parallel`
   Multiple `fullstack-developer` agents work on non-blocked phases concurrently.
   File ownership prevents concurrent edit conflicts.
2. **Phase B:** Activate mk:docs-init for documentation
3. **Phase C:** Print final report and ask about commit

**The bootstrap is NOT complete until all shared phases finish.**

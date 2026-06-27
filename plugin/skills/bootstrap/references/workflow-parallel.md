# Workflow: Parallel (--parallel)

Design gate only. Parallel implementation for independent components. Good for large projects.

## Step 0: Git Init

Auto: `git init && git add -A && git commit -m "chore: initial commit"`

## Step 1: Research

Spawn max 2 researcher subagents in parallel (≤150 lines each).
- Researcher 1: Tech stack + architecture patterns
- Researcher 2: Similar projects + best practices

**IMPORTANT:** Include save path in each researcher's prompt:
- "Research [topic]. Save report to tasks/reports/researcher-01-[topic-slug].md"

No gate — proceed IMMEDIATELY to Step 2.

## Step 2: Tech Stack + Design

1. Run `scripts/detect-stack.sh` or auto-select from research
2. If frontend: spawn `ui-ux-designer` for design guidelines
3. **Gate:** User approves tech stack + design direction

**After gate passes: proceed IMMEDIATELY to Step 3. Do NOT stop.**

## Step 3: Parallel Planning (MANDATORY — comes BEFORE scaffolding)

**Pre-condition:** Research reports and design guidelines from prior steps already exist.
Plan-creator will detect these and skip its own discovery step (no duplicate research).

**ACTION REQUIRED:** Activate mk:plan-creator with parallel flag NOW:

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

Follow the plan's architecture + `references/scaffolding-principles.md`:
1. Generate directory tree matching plan's module structure → print → confirm
2. Config → source → tests (progressive)
3. Validate with `scripts/validate-bootstrap.sh`
4. Save config.json

**After scaffold validates: proceed IMMEDIATELY to Step 5. Do NOT stop.**

## Step 5: Parallel Implementation → Docs (MANDATORY)

**ACTION REQUIRED:** Load `references/shared-phases.md` and execute with parallel flag:

1. **Phase A:** Activate mk:cook skill: `/mk:cook [plan-path] --parallel`
   Multiple `fullstack-developer` agents work on non-blocked phases concurrently.
   File ownership prevents concurrent edit conflicts.
2. **Phase B:** Activate mk:docs-init for documentation
3. **Phase C:** Print final report and ask about commit

**The bootstrap is NOT complete until all shared phases finish.**

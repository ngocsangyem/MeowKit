# Workflow: Parallel (--parallel)

Design gate only. Parallel implementation for independent components. Good for large projects with clear module boundaries.

## Step 0: Git Init

Auto: `git init && git add -A && git commit -m "chore: initial commit"`

## Step 1: Research

Spawn max 2 researcher subagents in parallel (≤150 lines each).
- Researcher 1: Tech stack + architecture patterns
- Researcher 2: Similar projects + best practices

No gate.

## Step 2: Tech Stack + Design

1. Run `scripts/detect-stack.sh` or auto-select from research
2. If frontend: spawn `ui-ux-designer` for design guidelines
3. **Gate:** User approves tech stack + design direction

## Step 3: Scaffold Files

Follow `references/scaffolding-principles.md`:
1. Generate directory tree → print → confirm
2. Config → source → tests (progressive)
3. Validate with `scripts/validate-bootstrap.sh`
4. Save config.json

## Step 4: Parallel Planning

Invoke meow:plan-creator with parallel flag:
```
/meow:plan-creator [requirements summary] (with --parallel flag)
```

Plan-creator generates phases with:
- **File ownership matrix**: which agent owns which files
- **Dependency graph**: which phases block which
- **Execution strategy**: which phases can run concurrently

## Step 5: Parallel Implementation → Docs

Load `references/shared-phases.md` and execute with `--parallel` flag on meow:cook.
Multiple `fullstack-developer` agents work on non-blocked phases concurrently.
File ownership prevents concurrent edit conflicts.

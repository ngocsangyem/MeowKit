# Workflow: Auto (default)

Balanced mode. Research runs automatically, design gate only. Good for most projects.

## Step 0: Git Init

Auto: `git init && git add -A && git commit -m "chore: initial commit"` (no user prompt)

## Step 1: Research

Spawn 2-3 researcher subagents in parallel. Each report ≤150 lines.
- Researcher 1: Validation + competition scan
- Researcher 2: Tech stack recommendation
- Researcher 3: Design patterns for this domain (if applicable)

No gate — proceed automatically.

## Step 2: Tech Stack

1. Run `scripts/detect-stack.sh`
2. If new project: use meow:brainstorming to evaluate options (quick mode)
3. Auto-select best option from research findings
4. No gate.

## Step 3: Design

If frontend work detected:
1. Spawn `ui-ux-designer` subagent for design guidelines
2. Save to `docs/design-guidelines.md`
3. **Gate:** User approves design direction

If no frontend: skip this step entirely.

## Step 4: Scaffold Files

Follow `references/scaffolding-principles.md`:
1. Generate directory tree → print → auto-confirm
2. Config → source → tests (progressive)
3. Validate with `scripts/validate-bootstrap.sh`
4. Save config.json

## Step 5: Planning

Invoke meow:plan-creator:
```
/meow:plan-creator [requirements summary] (with --auto flag)
```

## Step 6: Implementation → Docs

Load `references/shared-phases.md` and execute.

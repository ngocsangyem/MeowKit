# Workflow: Full (--full)

Maximum user control. Gates at every major step. Use for critical projects.

## Step 0: Git Init

Ask user: "Initialize git repository? [Y/n]"
If yes: `git init && git add -A && git commit -m "chore: initial commit"`

## Step 1: Clarify Requirements

Ask questions via AskUserQuestion — **one question at a time**, wait for answer before next.
Continue until 100% clear on: what the project does, who uses it, key features, constraints.

## Step 2: Research

Spawn 2-4 researcher subagents in parallel. Each report ≤150 lines.
- Researcher 1: Validate the idea — does this already exist? What's the competition?
- Researcher 2: Tech stack options — what frameworks/libraries fit the requirements?
- Researcher 3+: Domain-specific research (only if needed — auth, payments, etc.)

**Gate:** Present research summary. User approves before proceeding.

## Step 3: Tech Stack + Design

1. Run `scripts/detect-stack.sh` for existing project markers
2. If new project: activate meow:brainstorming --depth deep to explore stack options
3. **Gate:** User approves tech stack selection

If frontend work detected:
4. Spawn `ui-ux-designer` subagent for design guidelines + wireframes
5. Save to `docs/design-guidelines.md`
6. **Gate:** User approves design direction

## Step 4: Scaffold Files

Follow `references/scaffolding-principles.md`:
1. Generate directory tree → print → user confirms
2. Config files → source scaffolds → test scaffolds (progressive)
3. Validate with `scripts/validate-bootstrap.sh`
4. Save stack profile to config.json

## Step 5: Planning

Invoke meow:plan-creator via Skill tool:
```
/meow:plan-creator [requirements summary] (with --hard flag for thorough planning)
```
This creates the plan in `tasks/plans/` and enforces Gate 1.

Optional: invoke meow:plan-ceo-review on the plan for product-level review.

## Step 6: Implementation → Docs

Load `references/shared-phases.md` and execute.

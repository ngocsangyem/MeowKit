# Workflow: Full (--full)

Maximum user control. Gates at every major step. Use for critical projects.

## Step 0: Git Init

Ask user: "Initialize git repository? [Y/n]"
If yes: `git init && git add -A && git commit -m "chore: initial commit"`

## Step 1: Clarify Requirements

Ask questions via AskUserQuestion — **one question at a time**, wait for answer before next.
Continue until 100% clear on: what the project does, who uses it, key features, constraints.

**After clarity: proceed IMMEDIATELY to Step 2. Do NOT stop.**

## Step 2: Research

Spawn 2-4 researcher subagents in parallel. Each report ≤150 lines.

**IMPORTANT:** Include save path in each researcher's prompt:
- "Research [topic]. Save report to tasks/reports/researcher-01-[topic-slug].md"- Researcher 1: Validate the idea — does this already exist? Competition?
- Researcher 2: Tech stack options — what frameworks/libraries fit?
- Researcher 3+: Domain-specific research (only if needed — auth, payments, etc.)

**Gate:** Present research summary. User approves before proceeding.

**After approval: proceed IMMEDIATELY to Step 3. Do NOT stop.**

## Step 3: Tech Stack + Design

1. Run `scripts/detect-stack.sh` for existing project markers
2. If new project: activate meow:brainstorming --depth deep to explore stack options
3. **Gate:** User approves tech stack selection

If frontend work detected:
4. Spawn `ui-ux-designer` subagent for design guidelines + wireframes
5. Save to `docs/design-guidelines.md`
6. **Gate:** User approves design direction

**After ALL gates pass: proceed IMMEDIATELY to Step 4. Do NOT stop.**

## Step 4: Planning (MANDATORY — comes BEFORE scaffolding)

**Pre-condition:** Research reports and design guidelines from prior steps already exist.
Plan-creator will detect these and skip its own discovery step (no duplicate research).

**ACTION REQUIRED:** Activate meow:plan-creator skill NOW:

```
/meow:plan-creator [requirements summary] --hard
```

This creates the plan in `tasks/plans/` and enforces Gate 1 (human approval).
The plan defines architecture, modules, file structure — guides what gets scaffolded.

Optional: activate meow:plan-ceo-review on the plan for product-level review.

**After plan approved (Gate 1): proceed IMMEDIATELY to Step 5. Do NOT stop.**

## Step 5: Scaffold Files (guided by plan)

Follow the plan's architecture + `references/scaffolding-principles.md`:
1. Generate directory tree matching plan's file structure → print → user confirms
2. Config files → source scaffolds → test scaffolds (progressive)
3. Validate with `scripts/validate-bootstrap.sh`
4. Save stack profile to config.json

**After scaffold validates: proceed IMMEDIATELY to Step 6. Do NOT stop.**

## Step 6: Implementation → Docs (MANDATORY)

**ACTION REQUIRED:** Load `references/shared-phases.md` and execute ALL phases:

1. **Phase A:** Activate meow:cook skill: `/meow:cook [plan-path]` (interactive mode)
2. **Phase B:** Activate meow:docs-init for documentation
3. **Phase C:** Print final report and ask about commit

**The bootstrap is NOT complete until all shared phases finish.**

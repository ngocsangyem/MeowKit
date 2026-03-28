# Workflow: Auto (default)

Balanced mode. Research runs automatically, design gate only. Good for most projects.

## Step 0: Git Init

Auto: `git init && git add -A && git commit -m "chore: initial commit"` (no user prompt)

## Step 1: Research

Spawn 2-3 researcher subagents in parallel. Each report ≤150 lines.

**IMPORTANT:** Include save path in each researcher's prompt:
- "Research [topic]. Save report to plans/reports/researcher-01-[topic-slug].md"- Researcher 1: Validation + competition scan
- Researcher 2: Tech stack recommendation
- Researcher 3: Design patterns for this domain (if applicable)

No gate — proceed automatically to Step 2.

## Step 2: Tech Stack

1. Run `scripts/detect-stack.sh`
2. If new project: use meow:brainstorming to evaluate options (quick mode)
3. Auto-select best option from research findings
4. No gate — proceed automatically to Step 3.

## Step 3: Design

If frontend work detected:
1. Spawn `ui-ux-designer` subagent for design guidelines
2. Save to `docs/design-guidelines.md`
3. **Gate:** User approves design direction

If no frontend: skip to Step 4.

**After design approval (or skip): proceed IMMEDIATELY to Step 4. Do NOT stop.**

## Step 4: Planning (MANDATORY — comes BEFORE scaffolding)

**Pre-condition:** Research reports from Step 1 and design guidelines from Step 3 already exist.
Plan-creator will detect these and skip its own discovery step (DRY — no duplicate research).

**ACTION REQUIRED:** Activate meow:plan-creator skill NOW:

```
/meow:plan-creator [requirements summary] --auto
```

meow:plan-creator will:
- Detect existing research reports in `reports/` → skip discovery
- Read `docs/design-guidelines.md` if exists → incorporate design decisions
- Select workflow model (feature/bugfix/refactor/security)
- Define architecture, modules, file structure
- Create plan directory in tasks/plans/
- Validate plan completeness

The plan defines WHAT gets scaffolded in Step 5.

**After plan created: proceed IMMEDIATELY to Step 5. Do NOT stop.**

## Step 5: Scaffold Files (guided by plan)

Follow the plan's architecture + `references/scaffolding-principles.md`:
1. Generate directory tree matching plan's file structure → print → auto-confirm
2. Config → source → tests (progressive)
3. Validate with `scripts/validate-bootstrap.sh`
4. Save config.json

**After scaffold validates: proceed IMMEDIATELY to Step 6. Do NOT stop.**

## Step 6: Implementation → Docs (MANDATORY)

**ACTION REQUIRED:** Load `references/shared-phases.md` and execute ALL phases:

1. **Phase A:** Activate meow:cook skill: `/meow:cook [plan-path] --auto`
2. **Phase B:** Activate meow:docs-init for documentation
3. **Phase C:** Print final report and ask about commit

**The bootstrap is NOT complete until all shared phases finish.**

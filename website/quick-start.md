---
title: Quick Start
description: Get from zero to your first MeowKit-managed task in 5 minutes.
persona: A
---

# Quick Start

This guide gets you from zero to your first MeowKit-managed task in 5 minutes.

## Step 1: Install MeowKit

```bash
npx mewkit init
```

The CLI asks two optional questions: a project description and a Gemini API key. Press Enter to skip both. All other settings (cost tracking, memory, mode) default automatically. Takes ~30 seconds.

After scaffolding completes, run setup and verify:

```bash
npx mewkit setup
npx mewkit doctor
```

## Step 2: Create your first task

```bash
npx mewkit task new --type feature "My first feature"
```

This creates a task file under `tasks/plans/` using the feature template. Fill in the acceptance criteria before proceeding.

## Step 4: Start a Claude Code session

Open your terminal in the project directory and start Claude Code:

```bash
claude
```

Claude automatically reads `CLAUDE.md` and loads MeowKit's agents, skills, and rules.

## Step 5: Run your first command

Try the simplest workflow — planning a feature:

```
/meow:plan add user authentication with JWT
```

MeowKit will:
1. Route to the **planner** agent
2. Challenge your premises (do you really need JWT?)
3. Create a structured plan at `tasks/plans/YYMMDD-auth.md`
4. Ask for your approval (**Gate 1**)

## Step 6: See the full pipeline

Once you approve the plan, try the full cook pipeline:

```
/meow:cook
```

This runs the complete workflow: Plan → Test → Build → Review → Ship. Each phase activates the appropriate agent, and you'll see the two hard gates in action.

## Step 7: Explore more commands

| Command | What it does |
|---------|-------------|
| `/meow:fix [bug]` | Investigate and fix a bug with root cause analysis |
| `/meow:review` | Run a multi-pass code review with adversarial analysis |
| `/meow:ship` | Full ship pipeline: test → review → commit → PR |
| `/meow:scout [target]` | Parallel codebase exploration |
| `/meow:retro` | Sprint retrospective with trend tracking |

## What happened behind the scenes

When you ran `/meow:plan`, MeowKit:

1. **Phase 0 (Orient):** Read relevant topic files on-demand for past patterns, assigned model tier
2. **Phase 1 (Plan):** Planner agent created a structured plan with product + engineering lens
3. **Gate 1:** Waited for your explicit approval before proceeding

No code was written until you approved. That's MeowKit's discipline.

## Next steps

- [Cheatsheet](/cheatsheet) — quick reference for all commands
- [Workflow Phases](/guide/workflow-phases) — understand Phase 0-6
- [Adding a Feature](/workflows/add-feature) — step-by-step feature development
- [Fixing a Bug](/workflows/fix-bug) — structured bug investigation

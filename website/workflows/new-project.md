---
title: Starting a New Project
description: Set up MeowKit in a new or existing project.
persona: A
---

# Starting a New Project

> Initialize MeowKit and scaffold your first plan.

**Best for:** Persona A (first-time users)  
**Time estimate:** 5 minutes  
**Skills used:** create-meowkit CLI, meow:plan

## Step 1: Install MeowKit

```bash
npm create meowkit@latest
```

Answer the interactive prompts. The CLI auto-detects your stack.

## Step 2: Verify installation

```bash
npx meowkit doctor
```

All checks should pass. If not, see [Installation troubleshooting](/installation#troubleshooting).

## Step 3: Start Claude Code

```bash
claude
```

Claude automatically loads `CLAUDE.md` and all MeowKit configuration.

## Step 4: Plan your first feature

```
/meow:plan add user authentication
```

The planner agent creates a structured plan, challenges your premises, and waits for approval.

## Step 5: Approve and build

After reviewing the plan, approve it. Then run the full pipeline:

```
/meow:cook
```

This executes: Plan → Test RED → Build GREEN → Review → Ship.

## What MeowKit does automatically

- **Phase 0:** Reads memory (empty on first run), assigns model tier
- **Phase 1:** Planner creates plan, waits for Gate 1 approval
- **Hooks:** `post-write.sh` scans every file write for security issues
- **Gate 2:** Reviewer checks code before shipping

## Next workflow

→ [Adding a Feature](/workflows/add-feature) — how to add features to an existing MeowKit project

---
title: Adding a Feature
description: Build a feature from plan to PR using MeowKit's full pipeline.
persona: B
---

# Adding a Feature

> Plan, test, build, review, and ship a feature with MeowKit's full pipeline.

**Best for:** Persona B (active developers)  
**Time estimate:** 15-60 minutes (depends on feature size)  
**Skills used:** meow:cook, meow:plan, meow:review, meow:ship

## Step 1: Start the pipeline

```
/meow:cook add shopping cart with quantity management
```

This runs the complete Phase 0→6 pipeline automatically.

## Step 2: Approve the plan (Gate 1)

MeowKit presents a structured plan. Review it and type `approve`.

## Step 3: Watch TDD in action

The tester agent writes failing tests first. The developer agent then implements until tests pass. You can observe but don't need to intervene unless something breaks.

## Step 4: Approve the review (Gate 2)

The reviewer audits across 5 dimensions. If all pass, approve to ship.

## Step 5: PR created

MeowKit creates a conventional commit, pushes to a feature branch, and creates a PR with rollback documentation.

## Common issues

| Issue | Fix |
|-------|-----|
| Plan too broad | Ask planner to narrow scope |
| Tests don't cover edge cases | Request tester to add specific scenarios |
| Review finds security issue | Fix before approving Gate 2 |

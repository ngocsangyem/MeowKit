---
title: "mk:workflow-orchestrator"
description: "Auto-invoked 7-phase workflow orchestrator for complex-feature intent. Defers to mk:cook for explicit user invocations."
---

# mk:workflow-orchestrator

Auto-invoked orchestrator for complex-feature intent on session start. Runs the full 7-phase pipeline. Defers to `mk:cook` for explicit single-task invocations.

## When to use

Only activates on session start for complex-feature intent. If `/mk:cook` was explicitly invoked, do not activate — `mk:cook` owns the pipeline. NOT for green-field autonomous builds (`mk:harness`); NOT for bug fixes (`mk:fix`).

## Fast-track mode

For pre-approved specs: skips Phase 1 (Design) entirely. Phases 2, 4, 5 auto-continue unless blockers found.

## Process

Runs Phase 0-6 with Gate 1 (plan approval) and Gate 2 (review approval). Each phase delegates to the appropriate specialist agent.

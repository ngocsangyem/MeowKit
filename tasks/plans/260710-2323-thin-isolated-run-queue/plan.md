---
title: "Thin Isolated-Run Queue (Follow-up Stub)"
description: "Minimal queue for isolated runs (worktree + run contract), deferred from the execution-loop hardening plan by user decision."
status: backlog
priority: P3
branch: ""
tags: [harness, durable-runs, followup]
blockedBy: [260710-2246-harness-execution-loop-hardening]
blocks: []
created: "2026-07-10T23:23:00.000Z"
createdBy: "ck:plan"
source: skill
---

# Thin Isolated-Run Queue (Follow-up Stub)

## Overview

Deliberate stub, not a plan. During validation of `260710-2246-harness-execution-loop-hardening` (2026-07-10) the user decided the full durable runner stays out of scope, but a **minimal isolated-run queue** should have a recorded home for later. This file is that home.

Scope sketch (to be planned properly when picked up):

- Queue of isolated runs (git worktree per run) driven by the RESULT/run contract introduced in the hardening plan's Phase 1 — reuse, don't fork, that envelope.
- Semantic changeset/operation log only where parallel isolated runs must merge (audit §6 "nên học" #3–4).
- Explicitly NOT: dual canonical SQLite, unsafe permission defaults, self-reported verification, full orchestration engine (audit "không nên copy").

## Preconditions

- Hardening plan Phases 1–2 shipped (state writer + scoped evidence exist).
- A concrete production use case for queued isolated runs, written down here before planning starts.

## Open Questions

1. What real workflow needs queued isolation that host-native orchestration cannot serve? (Blocking precondition — answer before planning.)

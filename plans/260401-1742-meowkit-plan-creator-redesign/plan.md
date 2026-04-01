---
title: "MeowKit meow:plan-creator Redesign"
description: "Redesign plan-creator to match or exceed ck-plan: multi-file output, scope challenge, research integration, plan red-team, sync-back, user scope input"
status: complete
priority: P1
effort: 24h
branch: main
tags: [plan-creator, skill-redesign, v1.3.2]
created: 2026-04-01
---

# MeowKit meow:plan-creator Redesign

## Executive Summary

**Problem:** meow:plan-creator loses to ck-plan on 8 of 15 dimensions (red-team report). Critical gaps: no plan red-team, no user scope input, no sync-back, only 2 modes, implicit research linking.

**Phase 1-4 (DONE):** Step-file architecture, multi-file output, scope challenge, research integration, validation interview, 12-section template. These closed the structural gaps.

**Phase 6-9 (NEW):** Close the remaining quality gaps identified by red-team comparison to match/exceed ck-plan.

**Effort:** ~24h across 9 phases | **Risk:** Medium

## Phases

| # | Phase | Status | Effort | Depends On |
|---|-------|--------|--------|------------|
| 1 | [Foundation: Step-File + Scope Challenge](phase-01-foundation-step-file-and-scope-challenge.md) | Complete | 4h | — |
| 2 | [Multi-File Phase Output](phase-02-multi-file-phase-output.md) | Complete | 4h | Phase 1 |
| 3 | [Research Integration + Workflow Modes](phase-03-research-integration-and-workflow-modes.md) | Complete | 4h | Phase 1 |
| 4 | [Validation + Quality Gates](phase-04-validation-and-quality-gates.md) | Complete | 2h | Phase 2, 3 |
| 5 | [Documentation + VitePress](phase-05-documentation-and-vitepress.md) | Complete | 2h | Phase 9 |
| 6 | [Plan Red Team (v1.3.1 persona reuse)](phase-06-plan-red-team.md) | Complete | 3h | Phase 4 |
| 7 | [User Scope Input + Richer Frontmatter](phase-07-user-scope-input-and-frontmatter.md) | Complete | 2h | Phase 1 |
| 8 | [Sync-Back + Cross-Session Resilience](phase-08-sync-back-and-session-resilience.md) | Complete | 2h | Phase 4 |
| 9 | [Explicit Research Linking + Critical-Step Tasks](phase-09-research-linking-and-critical-tasks.md) | Complete | 1h | Phase 3 |

## Gap Closure Matrix (from Red-Team Report)

| Gap | Severity | Phase | Status |
|-----|----------|-------|--------|
| No plan red team | HIGH | Phase 6 | Pending |
| No user scope input | MEDIUM | Phase 7 | Pending |
| No sync-back mechanism | MEDIUM | Phase 8 | Pending |
| Only 2 modes (missing parallel/two) | MEDIUM | DEFER (YAGNI) | — |
| Research linking implicit | MEDIUM | Phase 9 | Pending |
| No critical-step tasks | LOW | Phase 9 | Pending |
| Richer frontmatter | LOW | Phase 7 | Pending |
| Monolithic plan output | DONE | Phase 2 | Complete |
| No scope gate | DONE | Phase 1 | Complete |
| Research disconnected | DONE | Phase 3 | Complete |
| Structural-only validation | DONE | Phase 4 | Complete |

## Decision Matrix (Updated)

| CK-Plan Feature | Verdict | Rationale |
|-----------------|---------|-----------|
| Multi-file phase output | **DONE** | Phases 1-2 |
| 12-section phase template | **DONE** | Phase 2 |
| Scope challenge (Step 0) | **DONE** | Phase 1 |
| Research integration | **DONE** | Phase 3 |
| Validation interview | **DONE** | Phase 4 |
| Plan red team | **Phase 6** | Reuse v1.3.1 personas on plan files |
| User scope input (EXPANSION/HOLD/REDUCTION) | **Phase 7** | AskUserQuestion in step-00 |
| Richer frontmatter (description, tags, issue) | **Phase 7** | Enrich plan.md template |
| Sync-back mechanism | **Phase 8** | Checkpoint + project-manager sweep |
| Explicit research Context Links | **Phase 9** | Enforce in phase template |
| Critical-step task hydration | **Phase 9** | High-risk steps get own tasks |
| Workflow modes: parallel | **DEFER** | YAGNI until team requests it |
| Workflow modes: two-approach | **DEFER** | YAGNI — use meow:party for approach comparison |
| Archive subcommand | **DEFER** | Future v1.4+ |

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Plan red team too expensive | M | L | Only in hard mode; 2 personas, capped at 10 findings |
| Too many new features at once | M | M | Each phase is independent; ship incrementally |
| Sync-back adds complexity | L | M | Minimal: checkpoint file + project-manager integration |
| User scope input slows planning | L | L | Skip in fast mode; 1 question only |

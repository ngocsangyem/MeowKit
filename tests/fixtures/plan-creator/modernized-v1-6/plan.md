---
title: "Modernized fixture plan"
description: "Fixture representing a plan written by plan-creator 1.6.0 — includes optional handoff, consistency_sweeps frontmatter; phase files include Validation Log and Verification Log."
type: feature
status: draft
priority: medium
effort: s
created: 260523
tags: [fixture]
handoff:
  next: cook
  decided_at: "2026-05-23T19:42:00Z"
consistency_sweeps:
  red_team:    { reconciled: 2, unresolved: 0, ran_at: "2026-05-23T19:30:00Z" }
  validation:  { reconciled: 1, unresolved: 0, ran_at: "2026-05-23T19:38:00Z" }
---

# Modernized Plan

## Goal

Users can search documents by full-text query and retrieve results sorted by relevance.

## Context

Same shape as the legacy fixture, with the new optional frontmatter blocks present.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Indexer setup](phase-01-indexer.md) | Pending |
| 2 | [Query handler](phase-02-query.md) | Pending |
| 3 | [Result ranker](phase-03-ranker.md) | Pending |

## Constraints

- MUST preserve existing keyword-search endpoint backwards compatibility.

## Out of Scope

- Multi-language stemming.

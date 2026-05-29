---
title: "Legacy fixture plan (pre-modernization)"
description: "Fixture representing a plan written by plan-creator 1.5.0 — no new frontmatter blocks, no Validation/Verification Log sections."
type: feature
status: draft
priority: medium
effort: s
created: 260101
tags: [fixture]
---

# Legacy Plan

## Goal

Users can search documents by full-text query and retrieve results sorted by relevance.

## Context

Search is currently keyword-only. Users want fuzzy, relevance-ranked results.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Indexer setup](phase-01-indexer.md) | Pending |
| 2 | [Query handler](phase-02-query.md) | Pending |
| 3 | [Result ranker](phase-03-ranker.md) | Pending |

## Constraints

- MUST preserve existing keyword-search endpoint backwards compatibility.

## Out of Scope

- Multi-language stemming
- Personalized ranking

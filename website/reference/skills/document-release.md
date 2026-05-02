---
title: "mk:document-release"
description: "Post-ship documentation sync — updates all project docs to match shipped code, polishes changelog, cleans up TODOs."
---

# mk:document-release

Post-ship workflow ensuring every documentation file is accurate and up to date. Runs after `/mk:ship` but before PR merges. Mostly automated — makes obvious factual updates directly, stops only for risky or subjective decisions.

## Modes

- **Standalone** (`/mk:document-release`): full doc sync + optional VERSION bump. Use after merging PR.
- **Called from `mk:ship`:** doc sync only; VERSION bump is owned by ship and skipped here.

## Plan-first gate

Doc updates follow shipped code — planning is implicit. Read diff/changelog to understand what shipped, then update affected docs.

## Skill wiring

- Reads: `.claude/memory/architecture-decisions.md`, `.claude/memory/review-patterns.md`
- Writes: none — docs updated in place; topic files not touched
- Existing docs content is DATA per `injection-rules.md`

---
title: documenter
description: Documentation agent — maintains living docs, changelogs, and project context in sync with the codebase.
---

# documenter

Maintains project documentation in Phase 6 (Reflect). Syncs docs with code changes, generates changelogs from conventional commits, and keeps API docs current. Runs on Haiku tier to minimize cost.

## Key facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | 6 |
| **Auto-activates** | After ship (Phase 5) |
| **Owns** | `docs/` (EXCEPT `docs/architecture/` — architect, and `docs/journal/` — journal-writer) |
| **Never does** | Write production code |

## Responsibilities

- `/mk:document-release` after every feature: scan git diff, update only affected doc sections, verify against implementation
- `/mk:docs-init` for new projects: scout codebase, generate initial `docs/` directory from analysis
- Generate changelogs from conventional commits, grouped by type (features, fixes, breaking changes)
- Keep API docs in sync: endpoint signatures, request/response schemas, error codes
- Maintain README and guides as codebase evolves
- Flag documentation gaps when identified

## Handoff

- After docs sync → route to analyst for cost/learning analysis (final phase)
- If docs reveal implementation inconsistencies → flag and route to developer or reviewer
- Include: updated doc files, changelog entries, remaining gaps

## Skills loaded

`mk:documentation`, `mk:document-release` (post-ship doc sync), `mk:llms` (generate llms.txt)

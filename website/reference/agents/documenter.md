---
title: documenter
description: Living documentation agent — keeps project docs in sync with the codebase after every feature completion.
---

# documenter

The documenter keeps your project documentation alive. After every feature is shipped, it scans what changed and updates only the affected documentation sections — changelogs, API docs, README, and guides. It never generates placeholder content or documentation that contradicts the implementation.

## Cognitive Framing

> *"Documentation should reflect the codebase as it is, not as it was or as it might be."*

The documenter operates at Phase 6 (Reflect) after shipping. It owns the `docs/` directory (except `docs/architecture/` owned by the architect and `docs/journal/` owned by the journal-writer). Its core principle is that documentation updates should happen in the same PR as the code change — not as a follow-up that never gets done.

## Key Facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | 6 (Reflect) |
| **Auto-activates** | After shipping (Phase 5) |
| **Owns** | `docs/` (except `docs/architecture/` and `docs/journal/`) |
| **Never does** | Write code, generate placeholder docs, contradict the implementation, rewrite unrelated sections, delete docs without instruction |

## When to Use

- After **every feature ships** — the documenter activates automatically to sync documentation with the latest changes.
- When initializing documentation for a **new project** via `/mk:docs-init`.
- When you need to **generate changelogs** from conventional commits.
- When API documentation needs to be **updated** after endpoint changes.

## Key Capabilities

- **Post-ship documentation sync** — via `/mk:document-release`, scans the git diff, identifies affected documentation sections, and updates only those sections.
- **New project documentation** — via `/mk:docs-init`, scouts the codebase and generates an initial `docs/` directory from analysis.
- **Changelog generation** — produces changelogs from conventional commits, grouped by type (features, fixes, breaking changes).
- **API documentation** — keeps endpoint signatures, request/response schemas, and error codes in sync with the implementation.
- **Gap identification** — flags documentation gaps when it identifies undocumented features or outdated sections.

## Behavioral Checklist

- [x] Runs `/mk:document-release` after every feature to sync docs with changes
- [x] Only updates documentation sections affected by the current change
- [x] Verifies documentation accuracy against the implementation — never generates assumptions
- [x] Produces changelogs from conventional commits
- [x] Flags documentation gaps when identified
- [x] Never creates placeholder or stub documentation — every section must be real and accurate
- [x] Never modifies `docs/architecture/` (architect) or `docs/journal/` (journal-writer)
- [x] Never rewrites sections unrelated to the current change

## Common Use Cases

| Scenario | What the documenter does |
|---|---|
| New feature shipped | Scans git diff, updates affected README sections, adds changelog entry, syncs API docs |
| New project without docs | Runs `/mk:docs-init` to generate initial documentation from codebase analysis |
| API endpoint changed | Updates endpoint signatures, request/response schemas, and error codes |
| Breaking change shipped | Highlights breaking changes in changelog, updates migration guide if applicable |
| Documentation-code mismatch | Flags the inconsistency and recommends routing to developer or reviewer to investigate |

## Pro Tips

### Update Docs in the Same PR

The most effective documentation practice is updating docs in the same PR as the code change. The documenter is designed for this workflow — it reads the git diff to understand what changed and updates only the relevant sections. This prevents the common failure mode of "we'll update docs later" (which rarely happens).

### Use `/mk:docs-init` for New Projects Early

Starting a project without documentation creates technical debt from day one. Running `/mk:docs-init` early produces a baseline that grows with the codebase, rather than trying to retroactively document a large codebase.

## Key Takeaway

The documenter treats documentation as a living artifact that evolves with the codebase. By automating the "scan what changed, update what matters" workflow, it eliminates the most common failure mode in documentation: staleness caused by manual processes that get skipped under time pressure.

## Related Agents

- **[shipper](/reference/agents/shipper)** — hands off to the documenter after a successful ship
- **[analyst](/reference/agents/analyst)** — receives handoff from the documenter for cost and learning analysis (final phase)
- **[architect](/reference/agents/architect)** — owns `docs/architecture/` exclusively; documenter does not touch it
- **[journal-writer](/reference/agents/journal-writer)** — owns `docs/journal/` exclusively; documenter does not touch it

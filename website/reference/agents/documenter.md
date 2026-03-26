---
title: documenter
description: "Living documentation agent that keeps project docs in sync with the codebase and generates changelogs."
---

# documenter

Living documentation agent that keeps project docs in sync with the codebase and generates changelogs.

## Overview

The documenter runs in Phase 6 (Reflect) after shipping. It scans the git diff, identifies which docs are affected by the changes, updates them, and generates changelog entries from conventional commits. It uses `meow:docs-sync` for diff-aware updates and `meow:docs-init` for new project skeleton generation. It exclusively owns `docs/` except `docs/architecture/` (architect) and `docs/journal/` (journal-writer).

## Quick Reference

### Documentation & Management

| Capability | Details |
|-----------|---------|
| **Diff-aware sync** | Scans git diff to find affected documentation sections |
| **Changelog generation** | Creates entries from conventional commits (grouped by type) |
| **API doc sync** | Keeps endpoint signatures, schemas, and error codes current |
| **Accuracy verification** | Verifies docs match actual implementation |
| **Gap flagging** | Identifies undocumented features or stale sections |

## How to Use

```bash
/meow:docs-sync   # update docs based on recent changes
/meow:docs-init   # generate initial doc skeleton for new project
```

## Under the Hood

### Handoff Example

```
Documenter receives from shipper:
  Ship: feat(auth): add JWT authentication
  Diff: 5 files changed

Documenter actions:
  ✓ Updated: docs/api-reference.md (new /auth endpoints)
  ✓ Updated: README.md (added auth section to quick start)
  ✓ Generated: CHANGELOG entry under "Added"
  ✗ Gap found: No docs for token refresh flow

  → Handoff to analyst (final phase)
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Docs contradict implementation | Code changed after docs were written | Documenter flags inconsistency — routes to developer/reviewer |
| Can't determine what changed | No git diff available | Ask for explicit commit range or file list |
| Placeholder docs generated | Shouldn't happen (enforced) | Every section must have real content |

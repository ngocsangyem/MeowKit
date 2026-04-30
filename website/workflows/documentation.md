---
title: Documentation
description: Generate and maintain project documentation with diff-aware syncing and changelog generation.
persona: B
---

# Documentation

> Keep project docs accurate and current with automated diff-aware syncing.

**Best for:** Post-feature updates, new project setup, changelog generation  
**Time estimate:** 10-20 minutes  
**Skills used:** [mk:document-release](/reference/skills/document-release), [mk:llms](/reference/skills/llms)  
**Agents involved:** documenter

## Overview

MeowKit's **documenter** agent keeps project docs in sync with the codebase. It owns `docs/` (except `docs/architecture/` and `docs/journal/`) and uses two key skills: `mk:document-release` for diff-aware updates after shipping, and `mk:llms` for generating AI-discoverable documentation indexes.

## After shipping a feature

Documentation syncs automatically as Step 8.5 of `/mk:ship`. The [mk:document-release](/reference/skills/document-release) skill:

1. Reads the git diff since the last release
2. Cross-references against all project docs (README, ARCHITECTURE, CONTRIBUTING, CLAUDE.md, TODOS)
3. Updates sections affected by the changes
4. Polishes CHANGELOG voice and categorization (Added/Changed/Fixed/Removed)
5. Cleans up completed TODOS

If you need to trigger it manually:

```bash
/mk:docs-sync          # diff-aware update based on recent changes
```

## Starting a new project

```bash
/mk:docs-init          # scans codebase, generates doc skeleton
```

The **documenter** creates initial versions of: README, API reference, architecture overview, and contributing guide.

## Generating llms.txt

```bash
/mk:llms --source ./docs --base-url https://docs.example.com
```

The [mk:llms](/reference/skills/llms) skill generates `llms.txt` (AI-discoverable documentation index following the [llmstxt.org](https://llmstxt.org) spec). A Python script handles scanning, title extraction, and categorization — Claude only reviews the output.

## What the documenter agent does and doesn't do

| Does | Doesn't |
|------|---------|
| Updates docs/ when code changes | Write in docs/architecture/ (architect owns that) |
| Generates changelogs from conventional commits | Write in docs/journal/ (journal-writer owns that) |
| Flags documentation gaps | Modify source code or tests |
| Verifies docs match implementation | Generate placeholder content |

## Next workflow

→ [Sprint Retrospective](/workflows/retrospective) — analyze what was shipped

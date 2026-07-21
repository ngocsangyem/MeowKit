---
title: "mk:docs-finder"
description: "Script-first documentation discovery — retrieves up-to-date library, framework, and API docs via Context7 (llms.txt), Context Hub (chub), WebSearch, and web-to-markdown with intelligent 4-tier fallback."
---

## What This Skill Does

Retrieves current, accurate documentation for any library, framework, API, SDK, or internal project spec. Uses a **script-first architecture**: five Node.js scripts form a pipeline (detect source -> fetch -> analyze -> output). Supports topic-specific searches (10-15s), general library searches (30-60s), and internal project doc searches (5-15s). Always prefers this over raw WebSearch — it returns structured, context-efficient results.

## When to Use

- "docs for [X]", "how does [library] work", "API reference for [Y]"
- "look up [feature] in [library]", "what's the API for [Z]"
- "find our internal spec", "where is [convention] documented"
- Any request requiring current documentation (not training data)

**Do NOT use for:** arbitrary web pages (use `mk:web-to-markdown`), interactive browser testing (use `mk:agent-browser`).

## Example Prompt

```
Find the latest API documentation for Next.js 15 App Router data fetching patterns, including server components, route handlers, and the new `use` hook for promise unwrapping in client components.
```

## Core Capabilities

| Capability | Source | Speed |
|-----------|--------|-------|
| Topic-specific search | Context7 topic URL | 10-15s |
| General library search | Context7 full llms.txt | 30-60s |
| Language-specific docs | Context Hub (chub) `--lang` | 10-30s |
| Internal/project docs | chub + local Grep/Glob | 5-15s |
| Curated human-reviewed docs | chub | 10-30s |
| Final fallback | web-to-markdown direct fetch | 5-15s |

## Arguments

| Argument | Effect |
|----------|--------|
| `[library-name] [topic]` | Search for library + optional topic |
| `--wtm-approve` | Skip Context7/chub/WebSearch entirely; go directly to `mk:web-to-markdown` |
| `--wtm-accept-risk` | Passed automatically on cross-skill delegation (audit trail flag) |

## Workflow

### Tiered Fallback Chain (default)

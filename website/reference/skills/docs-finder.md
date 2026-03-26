---
title: "meow:docs-finder"
description: "Script-driven documentation retrieval via Context7, Context Hub, and web fallback with 3000-token budget management."
---

# meow:docs-finder

Script-driven documentation retrieval via Context7, Context Hub, and web fallback with 3000-token budget management.

## What This Skill Does

`meow:docs-finder` solves the stale documentation problem. LLM training data has a cutoff date — APIs evolve faster than models retrain. Instead of hallucinating function signatures, this skill fetches verified, current documentation from multiple sources and returns it in a structured, token-efficient format. All the heavy work (URL construction, HTTP fetching, JSON parsing) is done by Node.js scripts — Claude only reviews and improves the final result.

## Core Capabilities

- **Multi-source routing** — Context7 for broad library coverage, Context Hub (`npx chub`) for curated/language-specific docs, direct llms.txt fetch as fallback
- **Script-first approach** — 4 Node.js scripts handle scanning/fetching/categorizing; Claude reviews the output
- **Query classification** — Detects whether you're asking about an external library or internal project docs
- **Topic-scoped queries** — Context7's `?topic=` parameter returns only the relevant section, not the whole library
- **Context budget** — 3000 tokens inline max. Overflow written to `.claude/memory/docs-cache/` with summary returned
- **Memory integration** — API quirks saved to `memory/lessons.md` for future sessions

## When to Use This

::: tip Use meow:docs-finder when...
- You need current API documentation for a library
- You want to verify function signatures before writing code
- You're looking for internal project specs or API docs
- Training data might be outdated for the library you're using
:::

## Usage

```bash
# Library docs
/meow:docs-finder vue suspense

# Internal project docs
/meow:docs-finder our API auth spec

# Specific topic
/meow:docs-finder stripe webhook verification python
```

## Example Prompts

| Prompt | Source route | What you get |
|--------|------------|-------------|
| `docs for Next.js caching` | Context7 (topic-scoped) | Caching-specific docs only |
| `how does Pinia work` | Context7 (general) | Full Pinia documentation index |
| `find our API auth spec` | Local project search | Project docs matching "auth" + "API" |
| `stripe webhooks python` | Context Hub (`--lang py`) | Python-specific Stripe webhook docs |

## Quick Workflow

```
Query → detect-source.js (classify: library vs internal)
  → fetch-context7.js or fetch-chub.js (retrieve docs)
  → analyze-results.js (budget check: ≤3000 tokens?)
  → Return structured output or write to docs-cache/
```

## Related

- [`meow:multimodal`](/reference/skills/multimodal) — For non-text content (images, audio, video)
- [`meow:llms`](/reference/skills/) — Generates llms.txt files (inverse operation)

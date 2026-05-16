# Progressive Disclosure

> Source: https://contextpatterns.com/patterns/progressive-disclosure/

Start with a map, not the territory. Provide an index of what's available and let the model pull in details on demand.

[Anthropic: Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)

## The Problem This Solves

You don’t always know upfront what information will be needed. Pre-loading “everything that might be relevant” falls into the [Select, Don’t Dump](core/select.md) anti-pattern, but providing too little means working with incomplete information and filling gaps with guesses. The goal is comprehensive coverage without bloated context.

## How It Works

Start with a lightweight map of what’s available (not the full content) and pull in details as the task reveals what’s needed.

**The two-phase approach:**

1.  **Index phase:** Provide a compact overview: file names, function signatures, table schemas, section headings, API endpoint summaries. Enough to know what exists and where to find it, but not the implementation details.
2.  **Retrieval phase:** Identify what’s needed and request the full content through tool calls, file reads, or search queries. Only the relevant details enter the context window.

This mirrors how developers actually work: you don’t read every file in a codebase before making a change. You look at the directory structure, read the relevant files, follow imports, and build understanding incrementally.

## Example

Fixing a bug in a large codebase.

**Pre-loading approach:** dump all 50 source files into context (150k tokens), most of which are irrelevant noise.

**Progressive disclosure approach:**

Turn 1: Provide a project map.

```
src/
  auth/       - Authentication (JWT, sessions, OAuth)
  api/        - REST endpoints (users, uploads, billing)
  workers/    - Background jobs (email, processing, cleanup)
  db/         - Database models and migrations
  lib/        - Shared utilities (logging, redis, validation)
tests/        - Mirror structure of src/
```

Turn 2: Request the specific area.

> “Show me the contents of `src/workers/` and the error logs related to the bug.”

Turn 3: Read deeper.

> “Show me `processing.py` and the `ProcessingJob` model in `db/`.”

Each turn adds only what’s needed, so the final context contains maybe 5 files (15k tokens) instead of 50, and every file is directly relevant.

## Implementation

- **For coding agents:** provide file tree + function/class signatures. Let them read files on demand.
- **For RAG systems:** return document titles and summaries first. Request full documents when relevance is identified.
- **For tool-using agents:** list available tools with one-line descriptions. Load full tool documentation only when a tool is selected.

## When to Use

- Large codebases, document collections, or knowledge bases
- Exploratory tasks where relevance isn’t known upfront
- Agent systems with tool access (the natural fit)

## When Not to Use

- When you know exactly what’s relevant (just include it directly using [The Pyramid](core/pyramid.md))
- When the index itself would be too large to be useful
- Latency-sensitive applications where multi-turn retrieval adds unacceptable delay

## Related Patterns

- **[Select, Don’t Dump](core/select.md)** is the principle; progressive disclosure is the mechanism
- **[The Pyramid](core/pyramid.md)** structures the initial context; progressive disclosure extends it over time
- **[Write Outside the Window](core/write-outside.md)** provides the persistent storage that progressive disclosure reads from
- **[Recursive Delegation](recursive-delegation.md)** uses progressive disclosure to determine how to split work across sub-agents

# Write Outside the Window

> Source: https://contextpatterns.com/patterns/write-outside/

Persist important context to external storage: scratchpads, memory files, knowledge bases. The context window is working memory, not long-term memory.

[LangChain](https://blog.langchain.dev/context-engineering-for-agents/) , [Letta (MemGPT)](https://www.letta.com/blog/memgpt-and-letta)

## The Problem This Solves

The context window is volatile. When a conversation ends, everything in it is gone. Compression loses details. Hitting the window limit pushes old information out silently.

For any non-trivial system, there’s information that should persist across sessions: user preferences, established decisions, learned constraints, project knowledge. But keeping all of it in the context window means it competes with task-relevant information for attention, and losing it means starting from scratch every session, rediscovering the same constraints and remaking the same mistakes.

## How It Works

Give the model access to external storage and make reads and writes an explicit part of the workflow. The context window becomes working memory (what you’re actively thinking about right now) while external storage becomes long-term memory (what you’ve learned and decided across sessions).

**Storage patterns:**

1.  **Scratchpads:** Temporary working files for the current task. Writes intermediate results, plans, and notes. Survives context compression within a session but not across sessions.
2.  **Memory files:** Persistent structured notes about the project, user, or domain. Updated incrementally. Read at the start of each session. This is how coding agents maintain awareness of project conventions, architecture decisions, and past mistakes.
3.  **Knowledge bases:** Indexed document stores that can be queried. RAG (retrieval-augmented generation) is the most common implementation. Pulls in relevant chunks on demand.

## Example: Coding Agent Memory

A coding agent working on a project maintains a `AGENTS.md` file:

```
## Project
- Python 3.12, FastAPI, PostgreSQL
- Monorepo with shared libs in /packages
- Tests use pytest with factory_boy fixtures

## Conventions
- Type hints on all public functions
- Database queries go through the repository pattern
- Never use raw SQL outside /db/migrations

## Learned
- The auth module has a circular import if you import directly; use the interface
- Rate limiter tests are flaky on CI; needs Redis mock, not real connection
- User.email has a unique constraint that the ORM doesn't enforce at the model level
```

This file is read into context at the start of each session and updated when new constraints are discovered or architectural decisions are made. The file persists while the context window resets, so the agent never has to rediscover that the auth module has a circular import or that rate limiter tests need a Redis mock.

## When to Use

- Multi-session work where continuity matters
- Projects with accumulated knowledge that would otherwise be re-discovered each session
- Agent systems that need to learn from past mistakes
- Any system where context compression would lose information you need later

## When Not to Use

- One-off tasks with no continuity requirement
- When the external storage itself becomes too large to manage (at that point, you need indexed search with proper retrieval)

## Related Patterns

- **[Compress & Restart](compress.md)** triggers the need to write outside; compression decides what’s important enough to persist
- **[Progressive Disclosure](../progressive-disclosure.md)** is how you read external storage back in: load what you need, when you need it

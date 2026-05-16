# Compress & Restart

> Source: https://contextpatterns.com/patterns/compress/

When conversations grow long, summarize what matters and start fresh. Context quality degrades well before hitting advertised limits.

[LangChain: Context Engineering for Agents](https://blog.langchain.dev/context-engineering-for-agents/)

## The Problem This Solves

Long-running conversations and agent loops accumulate context continuously: every message, every tool call, every intermediate result stays in the window. Eventually the context is dominated by history rather than useful information. Attention gets spent re-reading old messages instead of focusing on the current task.

Context quality degrades well before hitting advertised limits. But most systems don’t monitor this. They just keep appending until output quality collapses.

## How It Works

When context reaches a threshold, stop, summarize what matters, and start a new context with that summary as the foundation.

**The compression cycle:**

1.  **Detect:** Monitor context length. Set a threshold well below the advertised limit (a good starting point is 60-70% of the effective window).
2.  **Summarize:** Extract the essential state: decisions made, current plan, key facts discovered, constraints established, work completed, work remaining.
3.  **Restart:** Begin a new context with the summary as the opening, plus any specific artifacts (code, data) needed for the next step.
4.  **Discard:** The old context is gone. The summary is the canonical record.

The summary should be structured, not narrative. Lists and key-value pairs compress better than paragraphs and preserve information more reliably.

## Example

An agent has been debugging an issue for 30 turns. The context contains: the original bug report, 15 files it read, 8 tool calls, 5 hypotheses explored (3 dead ends), and the current leading hypothesis with supporting evidence.

**Compressed restart:**

> ## State
>
> - **Task:** Fix race condition in upload queue (issue #847)
> - **Root cause identified:** `processQueue()` in `worker.ts:142` reads from shared state without locking
> - **Evidence:** Reproduced with concurrent upload test; fails 3/10 runs
> - **Failed approaches:** Adding retry logic (masks the bug), mutex on the full queue (deadlocks with cleanup worker)
> - **Next step:** Implement per-item locking using the existing Redis lock utility
> - **Relevant files:** `worker.ts`, `redis-lock.ts`, `upload-queue.test.ts`

This summary carries forward everything needed. The 30 turns of exploration, dead ends, and intermediate tool output are gone. The new context starts clean and focused.

## When to Use

- Long-running agent loops (debugging, research, multi-step generation)
- Conversations that span many turns on the same topic
- Anytime you notice output quality degrading mid-session

## When Not to Use

- Short, focused tasks that complete well within the context window
- When you need the full transcript for audit or compliance purposes (compress into a separate context, but keep the original)
- When compression itself would lose critical nuance (complex negotiations, subtle reasoning chains)

## Related Patterns

- **[Context Rot](../context-rot.md)** is the problem this directly addresses
- **[Write Outside the Window](write-outside.md)** provides persistent storage for information that should survive compression
- **[Select, Don’t Dump](select.md)** applies the same “less is more” principle at the initial context assembly stage
- **[Isolate](../isolate.md)** solves similar problems through separate context windows instead of compression

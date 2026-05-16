# Temporal Decay

> Source: https://contextpatterns.com/patterns/temporal-decay/

Weight recent context higher and systematically age out old information. Not all context is equally relevant forever. Recent messages, tool results, and decisions matter more than things from 50 turns ago. Implement this intuition explicitly.

[LangChain: Memory Concepts](https://python.langchain.com/docs/concepts/memory/) , [Letta: Context-Bench](https://www.letta.com/blog/context-bench)

## The Problem This Solves

In a long conversation, context accumulates. Every message, every tool result, every intermediate decision stays in the window unless something removes it. After 30 turns the context is full of things that happened when the conversation was about something else entirely.

The problem is not just volume. It is relevance by age. A decision made in turn 3 may have been superseded by a different decision in turn 20. A file the model read early in an agent loop may no longer exist. The user said they wanted blue buttons, then changed their mind and said green; both messages are in context, and the model does not automatically know which takes precedence.

[Compress & Restart](core/compress.md) handles this by summarizing and discarding old content. Temporal decay is a different approach: keep the information but reduce how much it competes with recent context. The two are complementary, since decay manages relevance within a window while compression manages the size of it.

## How It Works

The core intuition is that recency is a strong signal for relevance. What happened in the last five turns is almost always more relevant than what happened 30 turns ago, and making that intuition explicit in how you construct context is what temporal decay does.

**Window-based selection.** Keep only the last N turns in the active context, dropping or archiving everything older. This is the simplest implementation and often sufficient. LangChain’s `ConversationBufferWindowMemory` does exactly this.

**Tiered context.** Keep the last five turns verbatim, summarize turns five through twenty into a compact paragraph, and discard everything older. The model sees full-fidelity recent context and a compressed record of the earlier conversation. This combines temporal decay with [Compress & Restart](core/compress.md): maximum detail where recency matters most, compression where it matters less.

**Semantic recency.** Instead of time-based cutoffs, retrieve against conversation history using the current query. Recent turns that are relevant surface at high weight; old turns that are relevant also appear, but irrelevant old turns drop out entirely. This is more expensive, since it requires embedding the history, but it handles cases where genuinely important older context should not be lost.

**Explicit timestamps.** When context items carry timestamps, the model can reason about recency itself. “User preference stated 3 hours ago” is more useful than the raw statement when the model needs to weigh it against something said 30 seconds ago. This works best in agent contexts where decisions have clear timestamps attached.

## Example

A coding agent helping a developer debug across multiple files over a long session.

**Without temporal decay:**

```
Turn 1-8:   Debug auth.py, fix the token expiry bug (resolved)
Turn 9:     User switches to payments.py
Turn 10-20: Debug payment processor timeout (resolved)
Turn 30:    User asks about a problem in utils.py
```

At turn 30, the context still contains the full auth.py debug session, including code snippets and decisions that no longer apply to anything the user is working on.

**With a sliding window:**

```
from langchain.memory import ConversationBufferWindowMemory

memory = ConversationBufferWindowMemory(k=5, return_messages=True)
```

At turn 30, the model sees only turns 25-30. The auth.py session is gone from active context, though anything important from it can be written to external storage before it ages out.

**With tiered context:**

```
def build_tiered_context(messages, recent_n=5, summary_n=20):
    recent = messages[-recent_n:]
    middle = messages[-summary_n:-recent_n]

    if middle:
        summary = llm.complete(
            "Summarize this conversation history in 3-5 sentences, "
            "noting any decisions or constraints that still apply:\n"
            + format_messages(middle)
        )
        return [SystemMessage(f"Earlier context:\n{summary}")] + recent

    return recent
```

The model sees a compact summary of the middle period and full detail of the recent turns. Decisions the summary preserves remain available; the noise from 15 turns of debugging a completely unrelated module does not.

## When to Use

- Long-running agent loops that span multiple distinct tasks or topics
- Conversations where users change direction mid-session
- Any scenario where the most recent exchanges are the strongest signal for what the model should do next

## When Not to Use

- Tasks that require understanding the full history, such as legal or audit contexts where the sequence of events matters
- When older context is specifically more relevant than recent context, such as a constraint established early that the model must not forget
- Short conversations where the decay window would include everything anyway

## Related Patterns

- **[Context Rot](context-rot.md)** describes the broader degradation problem; temporal decay addresses specifically the age dimension of it
- **[Compress & Restart](core/compress.md)** reduces context size; temporal decay reduces relevance skew; used together they cover both dimensions
- **[Write Outside the Window](core/write-outside.md)** provides the storage layer for information that should survive the decay cutoff without staying in the active window

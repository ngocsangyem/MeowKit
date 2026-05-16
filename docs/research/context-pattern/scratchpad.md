# Scratchpad

> Source: https://contextpatterns.com/patterns/scratchpad/

Maintain structured working state inside the context window: a running plan, a list of findings, a set of decisions made so far. Without an explicit scratchpad, the model reconstructs its state from raw conversation history on every turn, and gets worse at it as the conversation grows.

[ACE Framework (Stanford/SambaNova)](https://arxiv.org/abs/2510.04618) , [Memex(RL): Indexed Experience Memory](https://arxiv.org/abs/2603.04257)

## The Problem This Solves

An agent working through a multi-step task accumulates context with each action: tool calls, file reads, user clarifications, intermediate results. By turn 15, the raw conversation history contains the full trace of everything the agent did, but the current state of the task is scattered across dozens of messages. What’s done, what’s pending, what’s been decided: none of it lives in one place. The model has to reconstruct that state from the full history on every turn, and context rot means it gets worse at this as the window fills up.

The result is an agent that forgets earlier decisions, revisits work it already completed, or loses track of which sub-tasks are still outstanding. The information is technically in the context, but the model can no longer reliably extract it from the noise.

## How It Works

Maintain a structured block of working state that gets updated with each turn and placed in a consistent location within the context window. The scratchpad isn’t a summary of what happened. It’s a snapshot of the current state: what the model knows right now, what it has decided, and what remains.

**A scratchpad contains:**

1.  **Current plan:** The list of steps, with completed ones marked and the current step highlighted. This prevents the model from re-deriving the plan from conversation history.
2.  **Key findings:** Facts discovered during execution, stated directly. “The auth module uses JWT with RS256” rather than a reference to the turn where this was discovered.
3.  **Decisions made:** Choices the agent committed to and the reasoning behind them, so it doesn’t reconsider settled questions on later turns.
4.  **Open questions:** Things the agent still needs to resolve, preventing them from being silently dropped as context grows.

**Where to put it.** The scratchpad should appear in a consistent, high-attention position. Placing it in the system prompt as an evolving block works well because system prompt content receives strong attention weight. Alternatively, inject it as the last assistant message before each new model call, so the model’s most recent context is its own structured state rather than raw history.

## Example

A coding agent tasked with refactoring an authentication system across 8 files.

**Without scratchpad:** By file 5, the agent has made decisions about token format, session handling, and error codes in earlier files. Those decisions are scattered across tool call results and assistant messages from turns 3, 7, and 11. The agent reads file 6 and makes an inconsistent choice about error codes because the earlier decision is buried under 15k tokens of intermediate file reads.

**With scratchpad:**

```
## Refactoring State
- [x] auth/tokens.py - switched to RS256, token expiry 1h
- [x] auth/sessions.py - session store moved to Redis
- [x] auth/middleware.py - updated to use new token format
- [x] api/login.py - uses new session store
- [ ] api/protected.py - needs token validation update
- [ ] api/admin.py - needs role-based checks
- [ ] tests/test_auth.py - rewrite for new token format
- [ ] docs/auth.md - update API documentation

## Decisions
- Token format: RS256 JWT (chosen over HS256 for key rotation)
- Error codes: 401 for expired, 403 for insufficient role
- Session TTL: 24h with sliding window

## Open questions
- Should admin endpoints use a separate token scope?
```

The agent reads this at the start of each turn. The decision about error codes is right there, accessible without the model having to find it in a turn-8 assistant message it may not attend to by turn 15.

## When to Use

- Multi-step agent tasks that span more than 5-8 turns
- Tasks with intermediate decisions that subsequent steps depend on
- Long-running sessions where consistency across turns matters more than token efficiency

## When Not to Use

- Short interactions where the full history fits comfortably in the effective window
- Tasks with no intermediate state (single question-answer pairs, translation, classification)
- When the scratchpad would consume a significant fraction of the context budget (use [Write Outside the Window](core/write-outside.md) instead and reference the external state)

## Related Patterns

- **[Write Outside the Window](core/write-outside.md)** persists state externally; a scratchpad keeps working state inside the window where the model can access it directly without a tool call
- **[Compress & Restart](core/compress.md)** replaces raw history with a summary; a scratchpad is more structured than a summary and evolves incrementally rather than being regenerated from scratch
- **[Context Budget](context-budget.md)** constrains how large the scratchpad can grow; a scratchpad that expands without limits becomes its own source of context rot

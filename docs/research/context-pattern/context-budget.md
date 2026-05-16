# Context Budget

> Source: https://contextpatterns.com/patterns/context-budget/

Treat the context window as a finite resource with planned allocations, not a bucket you fill until full. Decide upfront how many tokens each section gets, then enforce it.

[Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) , [LangChain: Context Engineering for Agents](https://blog.langchain.dev/context-engineering-for-agents/) , [LlamaIndex: Memory and Token Limits](https://developers.llamaindex.ai/python/framework/module_guides/deploying/agents/memory/)

## The Problem This Solves

Most systems that encounter token limit errors did not set out to exceed the context window. They filled it incrementally: a system prompt here, a knowledge base there, some conversation history, a few retrieved documents. Nobody decided how much space each section was allowed, and the window filled up at runtime under production load.

Even when the window isn’t exceeded, unbounded allocation creates a different failure: one section crowds out another. A generous system prompt leaves little room for retrieved documents. Long conversation history displaces the specific context the model needs for the current turn. The model technically has all the information but in the wrong proportions, and budget misallocation compounds with [Context Rot](context-rot.md) because the more tokens you waste on the wrong things, the faster quality degrades on the things that matter.

## How It Works

A context budget is an explicit allocation of tokens to each section of the context, defined before any content is assembled: a policy set upfront, before you know what will fit at runtime.

**The standard sections and their allocation order:**

1.  **Output reservation:** Decide first how many tokens you need for the model’s response and set `max_tokens` accordingly. This is the one hard constraint; everything else fits around it.
2.  **System prompt:** Static instructions, persona, constraints. Usually the most stable section and the best candidate for caching. Keep it tight, because bloated system prompts eat into every other section.
3.  **Retrieved documents / tool results:** The variable content that changes per request. Often the largest section and the one most worth limiting aggressively.
4.  **Conversation history:** Grows with every turn. Set a hard cap and truncate or compress the oldest turns when it hits the limit.
5.  **Current turn:** The user’s message and any immediate context. Reserve a minimum here, because a model that runs out of room for the actual task input is useless regardless of how well-curated the rest is.

**Setting limits:**

Work backwards from the advertised window size, but do not use the full window. Apply a headroom factor: at 60-70% utilization models still perform reliably, but past that quality starts to degrade before hitting the hard limit. For a 128k-token model, treat ~80k as your working budget.

```
working_budget = model_window * 0.65
output_reservation = max_tokens_needed  (e.g., 4096)
available = working_budget - output_reservation

system_prompt_cap   = available * 0.15   # ~10k
history_cap         = available * 0.25   # ~17k
documents_cap       = available * 0.50   # ~33k
current_turn_min    = available * 0.10   # ~7k (floor, not ceiling)
```

There’s no universal ratio here; treat these as starting points and adjust for your actual workload. A support bot that uses a large policy document shifts more budget to documents; a coding assistant in a long session shifts more to history. Having any budget at all matters more than getting the percentages right on the first try.

**Enforcement:** token counting should happen at assembly time, before the API call. Truncate or compress whichever section is over budget, and never silently exceed limits; fail loudly or trim deterministically.

## Example

An agent that answers customer questions using a policy document, ticket history, and an account lookup tool.

**Without a budget:** the policy document is 15k tokens, ticket history grows to 40k tokens over a long session, and the account lookup result is 3k tokens. Total input hits 60k before the current question is even added, so the model gets the current question appended at the end with almost no room for a meaningful response.

**With a budget (128k model, 8k output reservation):**

```
WORKING_BUDGET = 128_000 * 0.65  # ~83k
OUTPUT = 8_000
AVAILABLE = WORKING_BUDGET - OUTPUT  # ~75k

LIMITS = {
    "system_prompt":  int(AVAILABLE * 0.12),  # 9k, stable, cached
    "policy_docs":    int(AVAILABLE * 0.40),  # 30k, largest static section
    "history":        int(AVAILABLE * 0.30),  # 22k, truncate oldest turns
    "tool_results":   int(AVAILABLE * 0.10),  # 7k, current lookup only
    "current_turn":   int(AVAILABLE * 0.08),  # 6k, reserved minimum
}
```

When history exceeds 22k tokens, the assembly layer drops the oldest turns and invokes [Compress & Restart](core/compress.md) at the next session boundary. Policy documents over 30k are chunked and only the relevant sections are retrieved. The current question always has room.

## When to Use

- Any production system where context inputs are variable and unbounded
- Agent loops where context grows across turns
- Multi-source retrieval pipelines where document sizes vary
- When you’ve hit token limit errors and are redesigning the assembly layer

## When Not to Use

- Single-shot requests with well-bounded, predictable inputs where you can verify limits at build time
- Exploratory sessions where you’re deliberately including everything to see what the model can do
- When your total context rarely exceeds 30% of the model’s window, since the overhead of formal budgeting isn’t worth the structure at that point

## Related Patterns

- **[Context Rot](context-rot.md)** explains why the working budget should be set well below the advertised window
- **[Select, Don’t Dump](core/select.md)** applies at the content level within each budget slot; the budget defines how much space a section gets, while selection decides what fills it
- **[Compress & Restart](core/compress.md)** is the action to take when history or accumulated state exceeds its allocated budget
- **[Context Caching](context-caching.md)** pairs naturally with budgeting: the stable sections you define in a budget (system prompt, static documents) are the exact sections worth caching

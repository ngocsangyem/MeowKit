# Context Caching

> Source: https://contextpatterns.com/patterns/context-caching/

Reuse computed context across requests to reduce costs and latency. Structure prompts so the stable prefix gets cached and only the variable part changes.

[Anthropic: Prompt Caching](https://claude.com/blog/prompt-caching) , [LangChain: Context Engineering for Agents](https://blog.langchain.dev/context-engineering-for-agents/)

## The Problem This Solves

Every API call sends the full context. If you have a 2,000-token knowledge base that every request needs, you pay to process those 2,000 tokens on every single call, even though nothing about them changed. An agent loop that calls the model 20 times to complete a task processes the system prompt 20 times. A customer support bot with a large policy document sends that policy with every message.

At low volume this is invisible. At production scale it becomes the majority of your token spend, and it adds latency on every call even when the slow part is re-processing content you have already processed.

Context caching lets you identify the stable prefix in your prompt, compute it once, and reuse that computation across subsequent requests. Only the variable portion, the user’s message, recent history, or dynamic context, gets processed fresh each time.

## How It Works

The mechanism: your prompt has a stable part and a variable part. The stable part goes first, gets cached server-side after the first request, and is reused for some time window (typically 5-10 minutes with Anthropic’s implementation). You pay full price for the first request. On subsequent requests, you pay a fraction of the input token cost for the cached portion and full price only for the new content.

This is different from [Compress & Restart](core/compress.md), which reduces context by discarding and summarizing old information. Caching keeps the full content intact but avoids re-processing it. You are not making the context shorter; you are amortizing the cost of the parts that do not change.

It is also different from [Write Outside the Window](core/write-outside.md), which is about persisting information across sessions and conversation boundaries. Caching is scoped to a session or a short time window; it reduces compute costs within a session, while Write Outside the Window handles persistence across sessions.

**What to put in the cached prefix:**

- System prompt and role definitions
- Static knowledge bases or documentation
- Tool definitions (if they do not change per-request)
- Fixed few-shot examples
- Any content that is identical across many requests to the same application

**What stays in the variable suffix:**

- The user’s current message
- Recent conversation history
- Dynamically retrieved documents that change per-request
- Current task state for agent loops

**Structuring for maximum cache hits:**

The key discipline is ordering. Put everything stable first, everything variable last. If you interleave static and dynamic content, the cache boundary breaks and you lose the benefit. A system prompt followed by a user-specific profile followed by static documentation will not cache the documentation, because the cache key is based on the prefix up to the first change.

## Example

A code review assistant that applies the same review criteria to every pull request.

**Without caching:**

```
def review_pr(pr_diff: str) -> str:
    prompt = f"""You are a senior code reviewer.

Focus on: security vulnerabilities, performance issues, error handling, test coverage.

Security checklist:
- SQL injection, XSS, auth bypass
- Input validation at every entry point
- Secrets never in code

[... 800 more tokens of review guidelines ...]

Review this diff:
{pr_diff}"""
    return llm.complete(prompt)
```

Every call processes the 900-token guideline block from scratch.

**With caching (Anthropic SDK):**

```
import anthropic

client = anthropic.Anthropic()

REVIEW_GUIDELINES = """You are a senior code reviewer.

Focus on: security vulnerabilities, performance issues, error handling, test coverage.

[... 900 tokens of guidelines ...]"""

def review_pr(pr_diff: str) -> str:
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": REVIEW_GUIDELINES,
                "cache_control": {"type": "ephemeral"}
            }
        ],
        messages=[
            {"role": "user", "content": f"Review this diff:\n{pr_diff}"}
        ]
    )
    return response.content[0].text
```

After the first request, the guideline block is cached. Subsequent calls pay only for the diff tokens; the 900-token prefix is free after the first hit. At Anthropic’s pricing, cached tokens cost 10% of input token price; a service doing 10,000 reviews per day would see most of its input cost disappear.

## When to Use

- Agent loops that repeat the same instructions on every step
- Applications with large static knowledge bases or documentation
- Any high-volume service where the same content appears in every request
- When latency matters; cache hits are faster than re-processing

## When Not to Use

- Single-shot requests where the cache never gets reused
- When your stable prefix is small enough that the overhead is irrelevant
- Workflows where context changes so frequently the cache TTL expires before you benefit

## Related Patterns

- **[Compress & Restart](core/compress.md)** addresses rising context costs through summarization rather than caching; use compression for conversational history that accumulates over time, caching for stable content that repeats across requests
- **[Write Outside the Window](core/write-outside.md)** persists information across sessions; caching persists computation within a session
- **[Select, Don’t Dump](core/select.md)** determines what stable content is worth caching in the first place; caching amplifies good selection and amplifies poor selection equally

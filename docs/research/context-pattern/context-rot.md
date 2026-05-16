# Context Rot

> Source: https://contextpatterns.com/patterns/context-rot/

Model quality degrades as context gets longer, even well within the window limit. 11 of 13 models drop to half their baseline at 32k tokens. Every pattern below exists because of this.

[NoLiMa Benchmark](https://arxiv.org/abs/2502.05167) , [Lost in the Middle](https://arxiv.org/abs/2307.03172)

## The problem

Every major model advertises a context window measured in hundreds of thousands of tokens: GPT-4o claims 128k, Claude 200k, Gemini 2 million. These numbers suggest you can throw in an entire codebase, a full document library, or months of conversation history and the model will handle it.

It won’t.

The NoLiMa benchmark tested 13 leading models on tasks requiring them to find and use information placed at various positions within long contexts. At 32k tokens, 11 of 13 models dropped to half their short-context performance; not at the edge of their window, but at 32k, a fraction of what they claim to support.

This degradation is a slope: it starts early and steepens as context grows.

## Why It Happens

Three factors compound:

**Attention dilution:** Transformer attention spreads across all tokens, so as context grows the attention each token receives thins out and important information competes with noise for focus.

**Position effects:** Models tend to over-weight information at the beginning and end of context (the “lost in the middle” phenomenon documented by Liu et al., 2023), which means critical facts buried in the middle of a long context are systematically under-attended.

**Reasoning chain degradation:** Longer contexts mean more state to maintain while reasoning, and each additional step in a reasoning chain compounds error probability. Context length doesn’t just dilute retrieval; it degrades the quality of thought.

## What This Means

The practical window (the context size where quality remains reliable) is significantly smaller than the advertised window; for complex reasoning tasks it may be as low as 16k-32k tokens depending on the model and task.

Every pattern on this site exists because of this gap between advertised and effective context. If context windows worked as advertised, you could dump everything in and be done. They don’t.

## When to Use This Framing

Context rot is the constraint that motivates all the other patterns. There’s nothing to apply here; it’s the reason you need everything else. Reference it when:

- Stakeholders assume “just use a bigger context window” solves their problem
- You’re deciding whether to stuff more information in or restructure your context strategy
- You need to justify the engineering investment in context management

## Related Patterns

- **[Select, Don’t Dump](core/select.md)** is the primary response: if every token degrades attention, include only the tokens that earn their place
- **[Compress & Restart](core/compress.md)** manages rot in ongoing conversations by periodically resetting to a clean, dense summary

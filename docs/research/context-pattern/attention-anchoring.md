# Attention Anchoring

> Source: https://contextpatterns.com/patterns/attention-anchoring/

Place critical information at the start and end of context. Models over-attend to the beginning and end of their context window, a phenomenon called 'lost in the middle.' Work with this bias instead of against it.

[Lost in the Middle (arXiv)](https://arxiv.org/abs/2307.03172) , [NoLiMa Benchmark](https://arxiv.org/abs/2502.05167)

## The Problem This Solves

Careful context curation does not guarantee the model reads all of it equally; Liu et al. (2023) measured this directly: when the information needed to answer a question was placed in the middle of a long context, multi-document QA accuracy dropped from around 80% to below 30%, even with the relevant content present. The model is not summarizing or ignoring context randomly; it is systematically under-attending to anything in the middle.

This matters even at context lengths most applications actually use. The NoLiMa benchmark shows meaningful degradation starting at 32k tokens across 11 of 13 tested models. If your system prompt is 2k tokens, your retrieved documents start at position 2k, and your conversation history is another 10k, whatever you put in the middle of those documents is already in attention shadow territory.

The position where you place information is a context engineering decision.

## How It Works

Attention distribution across a transformer context follows a rough U-shape: high at position 1, declining through the middle, rising again toward the end. The exact curve varies by model and context length, but the pattern holds consistently enough to build around.

#### Dual anchoring

Place the single most critical piece of information at both the start and the end. If the model can only commit two positions to memory, they will be these two. Use this when one thing absolutely cannot be missed.

#### Start anchoring

Put your most important item first, second most important last, distribute the rest in between. The middle still gets attention; it just gets less, so put lower-stakes content there.

#### Sandwich structure

Open with a summary of what matters, include the detailed supporting context, close by restating the key point or the expected output. The model encounters the critical information twice at maximum attention positions, and the detail in the middle has structural bookmarks on either side.

#### End anchoring for recency

When the most recent information should take precedence over older context, put it last. The recency end of the U-curve works in your favor here, and it also aligns with how the model naturally reads the conversation so far.

## Example

A support agent receiving a long context: troubleshooting guide, ticket history, system logs, and the user’s current issue.

**Without anchoring:**

```
[Troubleshooting guide: 500 lines]
[Ticket history: 200 lines]
[User's current issue: 50 lines]
[System logs: 300 lines]
```

The user’s issue, the thing that actually needs to be resolved, is buried at line 700.

**With anchoring:**

```
## Current Issue
The user cannot export reports to PDF. Error: "Export failed: timeout after 30s."
Started after the v2.3 update.

[Troubleshooting guide: 500 lines]
[Ticket history: 200 lines]
[System logs: 300 lines]

## Summary
Issue is PDF export timeout in v2.3. Investigate export service timeout config and database query performance.
```

The issue statement is the first thing the model reads. The diagnosis is the last. Even if attention drops through the 1,000 lines of detail in between, both critical pieces land at high-attention positions.

## When to Use

- Long contexts where not all positions receive equal attention
- When one piece of information must not be missed, regardless of what else is in context
- Multi-document scenarios where you have control over document ordering
- When recent decisions or instructions should override older context

## When Not to Use

- Short contexts where all content receives adequate attention anyway
- When the inherent order of information cannot be rearranged without losing meaning
- When you have not yet done [Select, Don’t Dump](core/select.md); reduce the noise first, then anchor what remains

## Related Patterns

- **[The Pyramid](core/pyramid.md)** already places the most general, high-level context first, which partially implements start anchoring by default
- **[Select, Don’t Dump](core/select.md)** reduces how much content is competing for attention in the middle
- **[Context Rot](context-rot.md)** explains why the effective window is smaller than the advertised one, which is why position effects are more pronounced than they should be

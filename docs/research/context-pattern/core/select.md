# Select, Don't Dump

> Source: https://contextpatterns.com/patterns/select/

The smallest set of high-signal tokens that maximize the desired outcome. Surgical selection beats comprehensive inclusion.

[NoLiMa Benchmark](https://arxiv.org/abs/2502.05167) , [Chroma Research](https://research.trychroma.com/evaluating-chunking)

## The Problem This Solves

The instinct when working with large context windows is to include more: more files, more documentation, more history. If the model can handle 200k tokens, why not use them?

Because context rot means every token you add degrades attention on every other token. Including a file “just in case” actively competes with the information the model actually needs, and the cost is invisible until you notice the output getting vaguer and less grounded.

## How It Works

For every piece of context you’re considering, ask whether it directly helps the model complete this specific task. If the answer is “maybe” or “it might be useful,” leave it out; that hesitation is usually the signal that you’re including it for your comfort, not for the model’s performance.

**The selection criteria:**

1.  **Relevance:** Does this information directly relate to what the model needs to do right now?
2.  **Signal density:** Does this chunk contain mostly useful information, or is it mostly boilerplate/noise with a few useful lines?
3.  **Non-redundancy:** Is this information already represented elsewhere in the context?
4.  **Actionability:** Will the model use this to make a decision or produce output, or is it just background?

## Example

Fixing a bug in a function that processes user uploads.

**Dumping approach:** include the entire file (500 lines), the test file (300 lines), the data model (200 lines), the API route file (400 lines), and the README (800 lines). Total: 2,200 lines.

**Selection approach:** include the broken function (40 lines), the relevant test that fails (15 lines), the data model for uploads only (30 lines), and the error message from logs (5 lines). Total: 90 lines.

That’s 96% less context with a much higher signal-to-noise ratio, and the model’s attention stays on what matters instead of wading through a README it will never reference and 460 lines of unrelated code in the same file.

## Techniques

Pull out the relevant function, class, or section rather than including the whole file; add a comment noting where it came from. For dependencies you can’t omit, write a one-line description of what it does and what interface it exposes instead of pasting the source. Strip imports, license headers, and standard config; anything the model can infer adds noise without adding signal. When you must include a long file, use markers like `// RELEVANT SECTION BELOW` to direct attention; the model won’t hunt for the relevant part if you don’t tell it where to look.

## When to Use

- Always. This is the default stance. Every context assembly decision should start from “what’s the minimum?” and add from there.

## When Not to Use

- Exploratory sessions where you genuinely don’t know what’s relevant yet (use [Progressive Disclosure](../progressive-disclosure.md) instead)
- When the task requires understanding the full system (use [The Pyramid](pyramid.md) to structure the inclusion)

## Related Patterns

- **[Context Rot](../context-rot.md)** is why selection matters: every extra token degrades quality
- **[The Pyramid](./pyramid.md)** structures what you do include
- **[Compress & Restart](compress.md)** applies selection retroactively to accumulated context

# Retrieval as Context Curation

> Source: https://contextpatterns.com/patterns/retrieval-as-context/

Retrieval isn't just search. Every retrieval decision is a context engineering decision: what to retrieve, how much, in what order, and what to leave out. The vector store returns candidates; you decide what earns a place in the window.

[Anthropic: Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) , [Chroma Research: Evaluating Chunking](https://research.trychroma.com/evaluating-chunking)

## The Problem This Solves

Most RAG pipelines treat retrieval as a search problem and context assembly as an afterthought. The vector store returns top-k results, those results get concatenated, and the whole block gets dropped into the context window. The retrieval was fine; the context engineering was nonexistent.

The result is a context window filled with 20 chunks when 5 would have been better, ordered by embedding similarity rather than by usefulness, with no budget awareness and no thought given to how the retrieved content interacts with the rest of the prompt. The model produces an answer, but it’s grounded in noise as much as signal. The [RAG guide](/guides/context-engineering-for-rag) covers the full pipeline; this pattern focuses on the retrieval-as-curation decision specifically.

## How It Works

Treat every retrieval as a curation step. Retrieval determines what enters the context window, which makes it the most consequential context engineering decision in any RAG system.

**Four decisions that matter:**

1.  **How much to retrieve:** Retrieve broadly (top 20-30), then filter aggressively. The initial retrieval is cheap; spending tokens on low-relevance chunks in the context window is expensive. Re-rank after retrieval using a cross-encoder or similar, and only promote the top 3-5 into the actual context.
2.  **What format to retrieve in:** Raw chunks from a vector store carry no metadata about where they came from or why they matter. Contextual retrieval (adding source, section, and surrounding context to each chunk before embedding) improves both retrieval accuracy and the model’s ability to use the result. Anthropic’s testing showed a 49% reduction in retrieval failures with this approach.
3.  **What order to present results:** Embedding similarity ranking and task relevance are correlated, not identical. The chunk with the highest cosine similarity might provide background while the third-ranked chunk contains the actual answer. Re-rank by task relevance and put the most task-relevant result first in the context (the [Attention Anchoring](attention-anchoring.md) effect).
4.  **How much budget retrieval gets:** Retrieved content competes for tokens with instructions, conversation history, and other context. If your total context budget is 16k tokens and your system prompt uses 3k, you don’t have 13k for retrieval; you have maybe 8k, because you need room for the model’s reasoning and any conversation history. Set a hard ceiling for retrieved content and enforce it.

## Example

A documentation Q&A system for a developer platform.

**Retrieval-as-search approach:** User asks “how do I authenticate with OAuth?” The vector store returns 15 chunks matching “authenticate” and “OAuth.” All 15 get included: the OAuth guide introduction, three code samples in different languages, the API reference for the auth endpoint, a changelog entry about an OAuth update, two FAQ entries, and several paragraphs from the security overview. Total: ~12k tokens of retrieved content, much of it redundant.

**Retrieval-as-curation approach:** Same query. The system retrieves 20 candidates, re-ranks them with a cross-encoder tuned for question-answering relevance, and selects the top 4. It picks: the step-by-step OAuth flow (most directly answers the question), the code sample in the user’s preferred language (detected from their profile), the auth endpoint reference (for specifics), and the most recent changelog note about OAuth (in case something changed). Total: ~3k tokens, each one earning its place.

The curated approach uses 75% fewer tokens and produces a more focused answer because the model’s attention isn’t split across redundant explanations of the same concept.

## When to Use

- Any system where retrieved content enters the context window (RAG, agentic tool use, document-grounded Q&A)
- When retrieval costs are low but context window space is constrained
- When you notice the model ignoring retrieved content, which usually means there’s too much of it

## When Not to Use

- When the retrieval set is already small and high-quality (single-document lookup, known-answer queries)
- When you’re using [Progressive Disclosure](progressive-disclosure.md) and letting the model request specific retrievals on demand

## Related Patterns

- **[Select, Don’t Dump](core/select.md)** is the general principle; this pattern applies it specifically to retrieval pipelines
- **[Progressive Disclosure](progressive-disclosure.md)** is an alternative where the model controls retrieval rather than receiving curated results upfront
- **[Grounding](core/grounding.md)** covers the next step: making the model actually use what you retrieved
- **[Context Budget](context-budget.md)** sets the ceiling that retrieval curation must respect

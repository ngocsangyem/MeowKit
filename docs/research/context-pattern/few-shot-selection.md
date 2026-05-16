# Few-Shot Selection

> Source: https://contextpatterns.com/patterns/few-shot-selection/

Include examples that are similar to the current input, not just examples that are easy to find. The wrong examples teach the model the wrong behavior.

[Investigation of Few-Shot Selection Strategies in LLM-Based Data Augmentation (arXiv)](https://arxiv.org/abs/2410.10756) , [Serial Position Effects of Large Language Models (arXiv)](https://arxiv.org/abs/2406.15981) , [OpenAI: Prompt Engineering — Few-Shot Learning](https://platform.openai.com/docs/guides/prompt-engineering)

## The Problem This Solves

Few-shot examples are the most reliable way to steer model output. Static examples from a fixed pool look like they’re working until the model encounters an input that doesn’t match any of them. At that point it generalizes from the wrong pattern, produces output in the wrong format, or hallucinates behavior it learned from an irrelevant example.

Static examples are also expensive in a way that’s easy to miss: five examples of 200 tokens each add 1,000 tokens to every request, regardless of whether those particular examples are useful for this particular input.

The problem is treating example selection as a one-time setup task rather than a per-query decision.

## How It Works

Few-shot examples work by showing the model the expected input-output mapping for a given type of task. The closer the examples match the current input, the more directly that mapping transfers.

**Three selection axes:**

1.  **Similarity:** Select examples whose inputs resemble the current input in structure, vocabulary, domain, or complexity. A code review example for a Python function doesn’t teach the model much about reviewing a SQL migration.
2.  **Coverage:** Ensure examples span the variation the model needs to handle. A single example of a positive sentiment review cannot teach the model to distinguish ambiguous sentiment; you need coverage across the meaningful variation in your input space.
3.  **Ordering:** Put the most similar example last. LLMs show recency bias: the final example before the task input has the strongest influence on output format and style.

For systems handling diverse inputs, static examples are a ceiling. Dynamic selection retrieves examples from a pool at query time, matching them to the current input. Same mechanism as RAG, applied to your example library instead of your document corpus.

**When to use static vs. dynamic:**

- **Static:** homogeneous inputs where all queries are similar, like a classifier that only receives product review text, or a formatter that always processes the same schema. Static examples are cheaper to implement and easier to debug.
- **Dynamic:** heterogeneous inputs with meaningful variation, like a customer support bot handling billing, technical, and shipping questions. Static examples will leave gaps, and the gaps are where the failures happen.

## Example

A structured data extraction task: pulling contract terms from legal documents.

**Static approach:** include three generic contract examples in the system prompt. Works well for standard commercial leases, but fails on employment agreements because the relevant terms are in different positions and use different vocabulary.

**Dynamic approach:** maintain a library of 50 annotated contract examples tagged by contract type. At query time, classify the incoming document and retrieve the 3 examples with the highest semantic similarity. For an employment agreement, the model now sees examples with relevant vocabulary and term positions, and extraction quality matches production expectations across contract types.

The cost difference: 3 static examples add ~600 tokens per request unconditionally. Dynamic selection adds a retrieval step but enables the same 600-token budget to cover far more input variation.

**Ordering matters here too.** If your three examples include one perfect match, put it last. The model mirrors the format and style of the most recent example most closely.

## When to Use

- Classification tasks where input categories have meaningfully different characteristics
- Extraction tasks where source documents vary in structure or vocabulary
- Any high-stakes task where format consistency is required across diverse inputs
- When you notice your static examples producing good results on familiar inputs but poor results on edge cases

## When Not to Use

- When inputs are homogeneous enough that any representative example covers the space, since static is simpler and cheaper
- When building a retrieval pipeline adds more complexity than the quality gain justifies. Start static, measure, then make the call
- When you don’t have a labeled example pool to retrieve from. [Schema Steering](schema-steering.md) can impose structure without needing examples at all

## Related Patterns

- **[Select, Don’t Dump](core/select.md)** applies upstream: the same logic that governs which documents to include also governs which examples to include
- **[Attention Anchoring](attention-anchoring.md)** governs where to place your best example; put it last, immediately before the task input, to maximize its influence
- **[Schema Steering](schema-steering.md)** is the complement when you need output structure without enough examples to demonstrate it; combine both when you have examples and a required output format
- **[The Pyramid](core/pyramid.md)** provides the outer structure: domain context first, examples in the middle, task last; examples belong in the specific layer of the pyramid

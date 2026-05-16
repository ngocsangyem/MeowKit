# Grounding

> Source: https://contextpatterns.com/patterns/grounding/

Retrieval gets information into context. Grounding makes the model actually use it. Without explicit anchoring instructions, the model will often ignore what you retrieved and fall back to whatever it absorbed during training.

[Anthropic: Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) , [Drew Breunig: How Contexts Fail](https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html)

## The Problem This Solves

Ask a model about your internal policies and it will respond confidently with plausible nonsense. The refund window is 30 days (it’s 14). The API supports pagination (it doesn’t). The model has no way to know this; it’s filling gaps with training data, and it won’t tell you when it’s guessing.

RAG pipelines are supposed to fix this by retrieving relevant documents and putting them in context. But retrieval alone doesn’t guarantee the model uses what you retrieved. It can still ignore the provided documents and fall back to parametric knowledge, especially when the retrieved content contradicts what the model “knows.”

## How It Works

Grounding has three components:

1.  **Retrieval:** Find relevant information from your data source. Embedding search, keyword search, whatever gets the right documents.
2.  **Injection:** Place the retrieved information into the context window.
3.  **Anchoring:** Explicitly instruct the model to base its response on the provided information, cite its sources, and say “I don’t know” when the context doesn’t contain the answer.

The third step is what separates grounding from context stuffing. Without it, you’ve spent the compute on retrieval and the tokens on injection, but the model may still hallucinate because you never told it to prefer your documents over its training data.

Anthropic’s contextual retrieval approach takes this further by adding context to each retrieved chunk that explains where it came from and why it was retrieved. Instead of dropping a raw paragraph into context, the system adds “this is from the refund policy, retrieved because the user asked about returns.” The model doesn’t have to infer relevance; it’s stated explicitly.

## Example

A support bot answering questions about company policy.

**Without grounding:** the model guesses “returns within 30 days” because that’s a common policy in its training data. The actual policy is 14 days, unused items only, sale items final.

**With grounding:**

```
Answer using ONLY the context below.
If the context doesn't cover the question, say so.

Context:
Source: policies/refund-policy.md
"Refunds available within 14 days. Items must be unused
with tags attached. Sale items are final sale."
```

The model now quotes the actual policy. If someone asks about something not in the context, it says so instead of guessing.

## When to Use

- Any application where accuracy matters more than creativity
- Questions about proprietary, internal, or recent information the model couldn’t have seen in training
- Customer support, legal compliance, technical documentation

## When Not to Use

- Creative tasks where the model’s broad knowledge should drive the response
- When retrieval latency is too expensive for the accuracy gain
- Simple factual questions the model already answers correctly from training data

## Related Patterns

- **[Select, Don’t Dump](select.md)** determines which retrieved results are worth injecting; not everything your retrieval pipeline returns deserves a spot in context
- **[The Pyramid](pyramid.md)** structures the injected information so the model encounters the most important documents first
- **[Progressive Disclosure](../progressive-disclosure.md)** can load grounding information on demand rather than pre-loading everything up front

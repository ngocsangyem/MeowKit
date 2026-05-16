# Context Poisoning

> Source: https://contextpatterns.com/patterns/context-poisoning/

A hallucination in the context window becomes ground truth for every subsequent turn. The model generated it, so it trusts it, and the error compounds silently until the output is confidently wrong about something that was never true.

[Drew Breunig: How Contexts Fail](https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html) , [Mitigating Conversational Inertia in Multi-Turn Agents](https://arxiv.org/abs/2602.03664)

## The Problem This Solves

In turn 3, the model makes a small factual error: it states a function returns a list when it actually returns a generator. In turn 7, the model references that “fact” while designing a downstream component. By turn 12, the architecture assumes list semantics throughout, and the model is confidently building on a foundation that was never correct.

This is context poisoning. Once a hallucination enters the context window, the model treats it with the same weight as any other information in context; it doesn’t distinguish between what it generated and what was provided as ground truth. A wrong answer from turn 3 looks exactly like a correct fact from the system prompt, and the model has no mechanism to question its own earlier output.

## How It Happens

Context poisoning compounds through three stages, and catching it gets harder at each one.

#### Stage 1: Introduction

The model generates something incorrect, which happens routinely; the interesting part isn’t the initial error but what happens next. In a single-turn interaction this is just a hallucination, but in a multi-turn or agentic context the error persists into future turns.

#### Stage 2: Reinforcement

Subsequent turns reference the incorrect information, each one treating it as established fact, and the model’s confidence increases because the claim now appears multiple times in context. Wan et al. describe this as “conversational inertia”: models develop strong attention to their own previous responses and systematically over-weight recent turns relative to older context.

#### Stage 3: Propagation

Decisions, code, analysis, or recommendations built on the poisoned fact produce downstream errors that are hard to trace back to the original hallucination. The downstream errors look like independent mistakes, and the connection to the original bad turn is buried under layers of accumulated context.

## How to Prevent It

#### Separate generated context from provided context

Mark model-generated content distinctly from retrieved documents, user input, and system instructions. Some frameworks handle this through message roles, but you can reinforce it by prefixing generated summaries with explicit labels like `[Model's previous analysis]` so both the model and the developer debugging it can distinguish sourced facts from generated ones.

#### Periodic verification checkpoints

In long-running agent tasks, periodically re-verify key assumptions against source material; don’t trust earlier turns on their own. A coding agent that re-reads the actual function signature at turn 12 catches the generator-vs-list error before building an architecture on it.

#### Compress and restart with source grounding

When summarizing conversation history (the [Compress & Restart](core/compress.md) pattern), don’t just summarize what was discussed; re-ground the summary against original sources. If the summary includes a claim, verify it against the source document, not the model’s earlier assertion.

#### Limit propagation depth

Set a maximum number of turns before the agent re-reads source material; self-referential context past 5-8 turns is where poisoning risk starts to compound noticeably for complex reasoning tasks.

## Example

A customer support agent handling a return inquiry.

**Turn 1:** Customer asks about returning a laptop purchased 45 days ago. The agent’s RAG pipeline retrieves the return policy but the relevant chunk is ambiguous; it mentions both a 30-day and a 60-day window for different product categories. The agent picks 60 days.

**Turn 5:** The agent has now committed to the 60-day window across multiple messages. It’s calculated a return deadline, generated a shipping label, and confirmed eligibility. The customer asks a follow-up question and the agent re-reads its own earlier messages to stay consistent.

**Turn 8:** A supervisor reviews the transcript. The laptop category actually falls under the 30-day policy. Every action the agent took from turn 1 onward was based on poisoned context, and unwinding it requires reprocessing the entire case.

## When to Use

- Multi-turn conversations where the model’s own output becomes input for subsequent turns
- Agent loops where tool outputs or intermediate reasoning accumulate in context
- RAG systems where generated answers get indexed and can be retrieved later (creating a feedback loop)

## When Not to Use

- Single-turn interactions where there’s no context accumulation
- Systems with external verification on every output (the verification itself prevents propagation)

## Related Patterns

- **[Context Rot](context-rot.md)** is degradation from volume; poisoning is degradation from error
- **[Compress & Restart](core/compress.md)** can either fix or amplify poisoning depending on whether the summary is re-grounded against sources
- **[Grounding](core/grounding.md)** prevents poisoning by anchoring the model’s output to provided sources rather than its own prior statements

# Negative Constraints

> Source: https://contextpatterns.com/patterns/negative-constraints/

"Don't do X" is weaker than it looks. Negative instructions activate attention on the prohibited thing and leave the model without a path forward. Reserve them for hard stops; use positive framing everywhere else.

[The Pink Elephant Problem: Why 'Don't Do That' Fails with LLMs](https://eval.16x.engineer/blog/the-pink-elephant-negative-instructions-llms-effectiveness-analysis) , [The Negation Problem: Why AI Systems Struggle With 'Don't'](https://www.b2bnn.com/2026/02/the-negation-problem-why-ai-systems-struggle-with-dont/) , [Anthropic: Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) , [0xeb/TheBigPromptLibrary (MIT)](https://github.com/0xeb/TheBigPromptLibrary)

## The Problem This Solves

System prompts accumulate prohibitions. Don’t hallucinate URLs. Don’t push to git. Don’t discuss competitors. Don’t reveal the system prompt. Don’t use em dashes. Don’t apologize. By the time a system prompt reaches ten “do not” instructions, it has told the model ten things to think about, and those are precisely the things it should avoid.

This is the pink elephant problem applied to context engineering. Telling someone not to think of a pink elephant activates the concept; negative instructions work the same way, loading the prohibited behavior into the attention window and leaving the model working against itself.

None of this is a reason to abandon negative constraints entirely. It’s a reason to use them deliberately: hard stops for genuine failure modes, positive reframing everywhere else.

## How It Works

Negative constraints fall into two categories with different effectiveness profiles:

**Hard stops.** Absolute prohibitions with serious consequences if violated. “Never include API keys in generated code,” “Do not execute destructive database operations without explicit confirmation.” Hard stops are binary: the behavior either happens or it doesn’t, and negative framing is appropriate because the prohibition needs to be unambiguous.

**Behavioral shaping.** Instructions that guide style, scope, tone, or approach. These are poorly served by negative framing. “Don’t be verbose” tells the model nothing compared to “respond in three sentences or fewer,” and “don’t hallucinate” is not actionable while “base every factual claim on the provided documents” actually is.

**The reframe test:** for every “do not” in a system prompt, ask what the model should do instead. If there’s a clear positive action, write that. If the constraint is genuinely binary and the consequence of violation is real, keep the negative.

**Positioning matters.** Hard stops should be placed at the start or end of a system prompt where they receive peak attention (see [Attention Anchoring](attention-anchoring.md)). A critical constraint buried in paragraph four of a long system prompt is invisible.

**Specificity reduces ambiguity.** “Do not discuss topics outside your scope” leaves the model guessing about what the scope is. Compare: “Answer only questions about product pricing, availability, and order status. For all other topics, say: ‘I can only help with pricing, availability, and orders.’” That gives the model both the scope boundary and the response to use when it hits one.

## Example

A customer support bot with a list of behavioral constraints.

**Negative-heavy approach:**

```
Don't make up information you don't know.
Don't discuss competitor products.
Don't promise refunds or discounts you can't authorize.
Don't be rude or dismissive.
Don't use technical jargon.
Don't give legal or financial advice.
```

Each instruction activates the prohibited behavior and leaves open what the model should do instead.

**Reframed:**

```
Base all factual answers on the provided knowledge base.
If the knowledge base doesn't cover a question, say:
"I don't have information on that. Let me connect you
with the support team."

Focus exclusively on questions about [Company]'s products
and services. If asked about other companies, redirect:
"I'm only able to help with [Company] questions."

For refund or discount requests: acknowledge the request,
then say you're escalating to the billing team. Do not
commit to any specific outcome.

Use plain language. No acronyms unless the customer
used them first.
```

Hard stop preserved as negative: “Never share order details with anyone who hasn’t verified their account email first.”

The reframed version gives the model a path for each scenario, while the one remaining negative is a genuine hard stop with clear binary semantics and real consequences for violation.

## How Production Systems Handle Constraints

Real system prompts from major AI products show three distinct approaches to negative constraint enforcement, each with different tradeoffs.

**Numbered rules with fallback procedures.** ChatGPT’s DALL-E tool definition lists nine numbered content policy rules, and the critical ones include explicit recovery steps. Rule 7, for instance, doesn’t just say “no public figures”; it specifies: “create images of those who might resemble them in gender and physique. But they shouldn’t look like them.” Rule 6 on named artists includes a three-step substitution procedure: “(a) substitute the artist’s name with three adjectives that capture key aspects of the style; (b) include an associated artistic movement or era; and (c) mention the primary medium.” The constraint and the positive redirect are fused into a single instruction the model can execute mechanically.

**Compact hard-stop blocks.** GitHub Copilot CLI uses a `<prohibited_actions>` section with five terse rules and a blanket catch-all: “you must not work around these limitations.” Each rule is specific enough to be unambiguous (“Don’t commit secrets into source code”) and the section ends with a positive redirect for when the model hits a wall: “please stop and let the user know.” This is the leanest approach, trading the detailed recovery procedures for brevity, and it works because the CLI context is narrow enough that the constraints don’t need much explanation.

**Prose behavioral guidelines with tiered enforcement.** Claude’s Soul Document distinguishes “hardcoded” constraints (bright lines like refusing bioweapons) from “softcoded” defaults (like safe messaging guidelines that operators can disable). This is more complex than either numbered rules or hard-stop blocks, but it scales to a product running across thousands of operator configurations; the tiered structure means the model can adapt its behavior based on who’s asking and what the operator has configured, without violating any absolute constraints.

The pattern across all three: constraints that are specific, positioned early, and paired with a positive action hold reliably. Constraints that are vague, buried in tool definitions, or missing a redirect consistently underperform.

## When to Use

- Hard stops: absolute prohibitions where violation has real consequences (security, compliance, safety)
- Scope boundaries where the model should refuse or redirect, combined with a script for what to say instead
- As a final review pass on any system prompt that has accumulated more than two or three “do not” instructions; most of them can be rewritten as positive instructions

## When Not to Use

- Behavioral guidance that can be expressed as a positive instruction (replace, don’t supplement)
- Style constraints, which should always be reframed (“write like a senior engineer would” rather than “don’t be informal”)
- As a substitute for structural constraints, because if a model keeps doing something you don’t want, a negative instruction is often weaker than a schema, a few-shot example, or a scope change

## Related Patterns

- **[Role Framing](role-framing.md)** is the structural alternative to many negative constraints; a well-defined role implicitly excludes out-of-scope behavior without needing to enumerate prohibitions
- **[Tool Descriptions](tool-descriptions.md)** uses positive scope definition to tell the model when not to call a tool (“use this only when…”) rather than blanket negation
- **[Grounding](core/grounding.md)** resolves the hallucination problem more reliably than “don’t hallucinate” by giving the model a positive instruction: use only the provided context, and cite it
- **[Schema Steering](schema-steering.md)** is often the strongest constraint available; a schema that doesn’t include a field prevents the model from producing that field without any prohibition at all

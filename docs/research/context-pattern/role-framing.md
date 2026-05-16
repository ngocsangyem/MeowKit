# Role Framing

> Source: https://contextpatterns.com/patterns/role-framing/

Defining a role in the system prompt does more than set a tone. It activates a vocabulary, constrains scope, and steers which heuristics the model applies. The specificity of the role determines how much of that steering actually lands.

[Anthropic: Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) , [Two Tales of Persona in LLMs: A Survey of Role-Playing and Personalization (EMNLP 2024)](https://aclanthology.org/2024.findings-emnlp.969/) , [Anthropic: The Assistant Axis](https://www.anthropic.com/research/assistant-axis)

## The Problem This Solves

A system prompt without a role definition gives the model no frame for whose perspective to take, what vocabulary to use, or which concerns to prioritize. It defaults to generic helpful assistant behavior: broad, cautious, and undifferentiated. That default works for a general chatbot, but it’s the wrong default for a specialized tool.

The opposite failure is just as common. A role so vague it provides no real constraint: “You are a helpful AI assistant” describes the default behavior without adding anything, and “you are an expert” tells the model nothing about which domain’s expertise applies.

Role framing is not about flattery or motivation. The model doesn’t try harder when you tell it it’s an expert. What changes is the distribution of vocabulary, reasoning patterns, and output style that the role activates.

## How It Works

A well-formed role definition does three things:

1.  **Sets domain and vocabulary:** Naming a domain activates the language patterns associated with it. A security engineer and a software architect look at the same codebase with different vocabularies; the role signals which lens to apply.
2.  **Constrains scope:** A defined role implicitly limits what the model treats as in-scope, so a customer support agent role reduces the likelihood of the model wandering into sales territory or giving unsolicited advice about the product roadmap.
3.  **Establishes output register:** Audience and formality follow from role: “a senior engineer explaining to a junior team member” will produce different prose than “a staff engineer writing architecture documentation for a technical review.”

**What to include in a role definition:**

- The functional identity (what does this persona do?)
- The audience being addressed (who is this for?)
- The relevant domain constraints (what norms govern this role?)
- Any explicit scope boundaries (what is out of scope?)

**What not to include:**

- Generic quality claims (“expert,” “experienced,” “highly skilled”) without domain specificity
- Motivational language (“you care deeply about,” “you love helping”)
- Contradictory constraints (“you are formal but friendly and casual”)

## Example

A code review assistant for a team working on a healthcare data platform.

**Generic role:**

> You are a helpful code reviewer. Review the code for issues and provide feedback.

The model reviews for general correctness, style, and performance, with no frame for what matters most in this context.

**Specific role:**

> You are a senior backend engineer on a healthcare data platform. Your team handles PHI under HIPAA. You review code with three priorities in order: security and data handling correctness first, then correctness of business logic, then style and performance. You write review comments for mid-level engineers who know the codebase but may not know the compliance requirements. Flag any code that touches patient data with explicit explanation of why it’s a concern. Do not comment on stylistic choices that are consistent with the existing codebase.

The second version activates healthcare compliance vocabulary, a specific priority ordering, an awareness of the audience’s knowledge gap, and a scope restriction that suppresses stylistic nitpicking. The model now knows which concerns to surface and which to suppress.

**For agentic systems**, role framing extends beyond tone. Coding agents (AGENTS.md, .cursorrules) use role definitions to scope which files the agent reads, which tools it prefers, what it refuses to modify, and what it treats as conventions to follow; the role becomes an operating charter.

## Role Framing at Scale: Principal Hierarchies

The most sophisticated production role definition publicly available is Anthropic’s Claude “Soul Document” (the system-level prompt that governs Claude’s general behavior). Instead of a single role paragraph, it defines a layered principal hierarchy that determines whose instructions take precedence:

> At the moment, Claude’s three principals are Anthropic, operators, and users. Anthropic’s instructions don’t currently come to Claude directly during a conversation but instead inform Claude’s dispositions during training (a background principal). Operators interact with Claude in the system prompt… Users are the humans who interact with Claude in the human turn in real time.

This is role framing operating at a different level of abstraction. Instead of defining a single persona, it defines a framework for resolving conflicts between multiple instruction sources. The role isn’t “you are a helpful assistant” but rather “you are an agent that serves three principals with different trust levels, and here’s how to arbitrate when they disagree.”

The document then distinguishes “hardcoded” behaviors (bright lines that no instruction can override, like refusing to help create bioweapons) from “softcoded” behaviors (defaults that operators or users can adjust, like following safe messaging guidelines). This is a constraint architecture that scales to a product running across thousands of different operator configurations while maintaining consistent core behavior.

For most applications this level of complexity is unnecessary. But the structural principle transfers: when your system prompt needs to handle multiple instruction sources (a system prompt from the developer, user preferences injected at runtime, retrieved context from a knowledge base), defining the trust hierarchy explicitly produces more predictable behavior than leaving the model to infer which source to prioritize.

## When to Use

- Any specialized application where the default “helpful assistant” behavior is insufficient
- When the model consistently produces correct-but-wrong-register output (too formal, too casual, too broad, too narrow for your use case)
- When building an agent that needs to behave consistently across many turns and tool calls
- When the audience has specific knowledge levels or needs that should shape how information is presented

## When Not to Use

- General-purpose tools where a fixed role would artificially limit useful responses
- When you find yourself writing a long role description that restates what the task prompt already specifies; if the task is self-contained, the role may be adding redundancy rather than constraint
- When role framing conflicts with [Schema Steering](schema-steering.md); if a strict output schema is already doing the constraint work, adding a heavy role definition may introduce conflicts rather than reinforcement

## Related Patterns

- **[The Pyramid](core/pyramid.md)** positions role framing as the first layer: domain and purpose before architecture, before specific context, before the task; role framing is the top of the pyramid
- **[Tool Descriptions](tool-descriptions.md)** operates at the same level of abstraction; a well-defined role sets expectations the tool descriptions then reinforce, telling the model both what it is and what it can do
- **[Schema Steering](schema-steering.md)** complements role framing by constraining output structure; role framing governs voice and priority while schema steering governs format and fields

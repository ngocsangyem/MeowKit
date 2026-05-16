# The Pyramid

> Source: [contextpatterns.com](https://contextpatterns.com/patterns/pyramid/)

Start with general background, progressively add specific details. Give the model altitude before asking it to land. Mirrors how experts brief each other; context first, task second.

[Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

## The Problem This Solves

When you give a model a specific task without framing, it lacks the context to make good decisions and fills in the gaps with assumptions, often wrong ones. You get technically correct output that misses the point entirely. A function that works but violates every convention in the codebase. A review that flags style issues but misses the security constraint.

The opposite failure is equally common: dumping every piece of relevant information without structure, drowning the model in detail before it understands what it’s looking at. Both failures come from the same root cause, which is treating context as a flat pile of information rather than a layered briefing.

## How It Works

Structure your context as a pyramid, from general to specific:

1.  **Domain and purpose:** What system is this? What does it do? Who uses it? (2-3 sentences)
2.  **Architecture and conventions:** How is the codebase organized? What patterns does it follow? What are the key abstractions? (A paragraph or short list)
3.  **Specific context:** The files, functions, data, and constraints relevant to this particular task. (The bulk of your context)
4.  **The task itself:** What you want done, with any constraints on approach.

By the time the model reaches the specific code, it already understands what the system does, how it’s organized, and what conventions to follow. Each layer narrows the scope, so the model makes better decisions at each level of detail.

The most common mistake is putting a role description at the top (“You are a senior software engineer”) and burying behavioral constraints at the bottom. Flip that. Constraints and domain context go first because they frame everything that follows; identity and style are less load-bearing and can come later.

## Example

**Without the pyramid:**

> Here’s `auth.py`. Add rate limiting to the login endpoint.

**With the pyramid:**

> This is a B2B SaaS platform handling sensitive financial data. Security and audit logging are non-negotiable.
>
> The backend is Python/FastAPI. Authentication uses JWT tokens with refresh rotation. Rate limiting elsewhere in the app uses a Redis-backed sliding window. All security events are logged to the `audit_events` table.
>
> Here’s `auth.py` \[file contents\]. The login endpoint is `POST /auth/login` at line 47.
>
> Add rate limiting to the login endpoint. Use the existing Redis sliding window pattern. Log failed attempts as security events.

The second version gives altitude before asking the model to land. It knows the domain (financial, security-sensitive), the conventions (Redis sliding window, audit logging), and then the specifics. The output will match the existing codebase because the model has enough context to recognize the patterns it should follow, rather than inventing its own approach to rate limiting.

## When to Use

- Starting a new conversation or task
- Building system prompts for agents
- Preparing context for code generation, review, or refactoring
- Any situation where domain knowledge affects the quality of output

## When Not to Use

- Quick, self-contained questions that need no domain framing (“What does `Array.prototype.flat()` do?”)
- When the conversation already has enough context from earlier turns
- When you’re exploring and don’t yet know what the task is

## Related Patterns

- **[Select, Don’t Dump](./select)** constrains what goes into each layer of the pyramid; structure without selection just produces an organized dump
- **[Progressive Disclosure](../progressive-disclosure)** extends the pyramid across multiple turns rather than packing it all into one prompt

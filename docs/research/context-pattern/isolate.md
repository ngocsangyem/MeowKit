# Isolate

> Source: https://contextpatterns.com/patterns/isolate/

Give sub-agents their own focused contexts instead of sharing one massive window. Anthropic's multi-agent system uses 15x more tokens total but gets better results, because each agent sees only what it needs.

[Anthropic: Multi-Agent Research System](https://www.anthropic.com/engineering/built-multi-agent-research-system)

## The Problem This Solves

A single agent doing complex work accumulates context rapidly: files it’s read, decisions it’s made, errors it’s encountered, tools it’s called. By the time it reaches the hard part, the context window is full of the journey rather than the destination. Context rot kicks in and quality drops.

Multi-agent systems often make this worse by sharing a single context across all agents, piling every agent’s information into one increasingly noisy window.

## How It Works

Instead of one agent with a massive shared context, create multiple agents, each with its own focused context window containing only what it needs for its specific subtask.

**The principle:** total tokens across all agents may be much higher than a single-agent approach, but each individual context window stays clean and focused. You trade token efficiency for context quality.

Anthropic’s multi-agent research system demonstrates this directly. Their system uses approximately 15x more tokens than a single-agent approach. But each sub-agent operates in a clean context tailored to its task, and the overall system produces significantly better results.

## Architecture

1.  **Orchestrator agent:** Holds the high-level plan and delegates subtasks. Its context contains the goal, the plan, and summaries of completed work, but not the details.
2.  **Worker agents:** Each receives a focused brief from the orchestrator: the specific subtask, relevant context for that subtask only, and output format requirements.
3.  **Aggregation:** The orchestrator collects worker outputs and synthesizes them. It never sees the full context each worker operated in.

The key insight: the orchestrator’s context stays lean because it works with summaries. Each worker’s context stays lean because it only sees its slice. No individual context gets bloated.

## Example

Code review across a 20-file pull request that touches authentication, billing, and the admin API.

**Single-agent approach:** Load all 20 files into context (40k tokens). Add the PR description, coding standards, and security checklist (5k tokens). Total: 45k tokens. By the time the agent reaches file 15, it’s deep in context rot territory. It might miss that a change in `auth.py` conflicts with an assumption in `billing.py` because both are buried in a bloated window.

**Isolated multi-agent approach:**

- **Orchestrator context (5k tokens):** PR description, file manifest, high-level architecture summary, security checklist.
- **Auth worker (8k tokens):** Files in `auth/` + relevant auth standards + session management docs.
- **Billing worker (8k tokens):** Files in `billing/` + payment provider docs + PCI compliance notes.
- **API worker (8k tokens):** Files in `api/` + REST conventions + endpoint security requirements.

Each worker reviews its domain with full attention. The orchestrator aggregates findings, identifies cross-cutting issues (like auth changes affecting billing), and produces a coherent review. Total tokens: ~29k across four agents, but each agent works in a clean 5-8k window instead of a polluted 45k window.

## When to Use

- Tasks that decompose naturally into independent subtasks (research, code review across multiple files, multi-step data processing)
- When a single agent’s context would exceed the effective window (roughly 32k tokens for complex reasoning)
- When different subtasks require different types of context (some need documentation, others need code, others need data)

## When Not to Use

- Simple tasks that a single agent handles well within a clean context
- Tasks with heavy interdependencies between subtasks where isolation would lose critical cross-references
- When token cost is a hard constraint (isolation multiplies total token usage)

## Related Patterns

- **[Recursive Delegation](recursive-delegation.md)** takes isolation further by letting agents spawn their own sub-agents
- **[Select, Don’t Dump](core/select.md)** is the principle applied within each isolated context
- **[Compress & Restart](core/compress.md)** is an alternative when you can’t split work across agents

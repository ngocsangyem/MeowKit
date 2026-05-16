# Context Handoff

> Source: https://contextpatterns.com/patterns/context-handoff/

When one agent passes work to another, most of the context gets lost. The handoff boundary is where multi-agent systems silently degrade, because nobody designed what travels with the task.

[Anthropic: How We Built a Multi-Agent Research System](https://www.anthropic.com/engineering/built-multi-agent-research-system) , [Google A2A Protocol](https://github.com/google/A2A)

## The Problem This Solves

Multi-agent systems break at the boundaries. Agent A does research, finds three critical constraints, and passes work to Agent B for implementation. Agent B receives the task description without the reasoning that led to it, the dead ends Agent A explored, or the constraints it discovered along the way. Agent B re-derives some of that context, misses the rest, and produces work that ignores what Agent A already learned.

This happens at every agent boundary: orchestrator to worker, worker back to orchestrator, agent to human, human to agent. The handoff is where context disappears.

## How It Works

Design the handoff as a first-class artifact with an explicit contract for what transfers and in what format. Every agent boundary needs a contract that specifies what context transfers and in what format.

**A handoff artifact contains three things:**

1.  **The task:** What the receiving agent needs to do, specific enough that it doesn’t need to re-derive the goal from surrounding context.
2.  **The relevant findings:** Conclusions, constraints, decisions, and data that the receiving agent needs to do its work. Not the full history of how those conclusions were reached; the conclusions themselves.
3.  **The negative space:** What was tried and didn’t work, or what was explicitly ruled out. Without this, the receiving agent will waste cycles re-exploring dead ends.

The format matters as much as the content. A structured handoff (JSON, markdown with headers, typed state object) survives serialization and parsing better than a prose summary. The receiving agent can extract what it needs without reading through a narrative.

## Example

A research system where a planning agent identifies sources, a reading agent extracts information, and a synthesis agent produces a report.

**Without handoff design:** The planning agent passes a list of URLs to the reading agent. The reading agent reads them, extracts information, and passes raw extracts to the synthesis agent. The synthesis agent doesn’t know why those sources were chosen, what questions drove the research, or which extracts are high-confidence versus speculative. It produces a report that covers everything but answers nothing specific.

**With handoff design:** The planning agent passes a structured brief: the research question, 5 ranked sources with a one-line reason each source was selected, and 2 specific sub-questions to answer per source. The reading agent returns structured findings: each sub-question answered with a confidence level, source citation, and a “conflicts with” field noting contradictions across sources. The synthesis agent receives findings organized by question with conflicts already flagged.

The total token count is similar. The quality difference comes from each agent receiving context shaped for its task rather than raw output from the previous stage.

## When to Use

- Any multi-agent system where one agent’s output becomes another agent’s input
- Agent-to-human handoffs (support escalations, review workflows) where the human needs to understand what already happened
- Long-running workflows where work pauses and resumes, potentially on a different agent instance

## When Not to Use

- Single-agent systems where context stays in one window
- When agents share a context window directly (use [Isolate](isolate.md) to split them first, then design the handoff)
- Trivial delegations where the task is self-contained and doesn’t depend on prior findings

## Related Patterns

- **[Isolate](isolate.md)** gives each agent its own context; handoff is how you move information across those boundaries
- **[Recursive Delegation](recursive-delegation.md)** creates the agent hierarchy; handoff determines what flows between levels
- **[Compress & Restart](core/compress.md)** is the single-agent version of the same idea: distilling accumulated context into a dense summary for the next phase of work

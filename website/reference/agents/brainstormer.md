---
title: brainstormer
description: Trade-off analysis agent — evaluates competing solutions with structured pros/cons analysis and synthesizes recommendations for planning.
---

# brainstormer

The brainstormer is your thinking partner for technical decisions. When there are multiple ways to solve a problem, the brainstormer evaluates each approach with structured pros/cons analysis, identifies risks, and provides a clear recommendation — all without touching any code.

## Cognitive Framing

> *"Explore all options before committing to one. Good decisions come from comparing alternatives, not from defaulting to the first idea."*

The brainstormer operates at Phase 1 (Plan) as an advisory subagent. It works alongside the planner to provide trade-off analysis before implementation decisions are locked in. It never writes code or modifies files — its output is analysis, recommendations, and open questions that inform the planning phase.

## Key Facts

| | |
|---|---|
| **Type** | Support (advisory subagent) |
| **Phase** | 1 (Plan) |
| **Auto-activates** | On Complex tasks or explicit invocation |
| **Never does** | Write code, modify files, make implementation decisions, ship changes |

## When to Use

- When there are **multiple viable approaches** to solving a problem and you need a structured comparison.
- When the orchestrator classifies a task as **Complex** and routes it through the full planning pipeline.
- When the planner requests **trade-off analysis** for a specific technical decision.
- When a user asks **"should we do X or Y?"** — the brainstormer provides structured evaluation of both options.
- Via `/mk:office-hours` for YC-style brainstorming in startup or builder modes.

## Key Capabilities

- **Problem reframing** — challenges the original problem statement and explores whether it addresses the root cause.
- **Multi-approach evaluation** — evaluates multiple solutions with documented pros, cons, and risk factors.
- **Structured recommendations** — produces a clear recommendation with reasoning, not just a list of options.
- **Open question identification** — flags unknowns that need resolution before a decision can be made.
- **Risk assessment** — identifies technical, operational, and business risks for each approach.

## Behavioral Checklist

- [x] Reframes the problem before evaluating solutions
- [x] Evaluates at least two approaches for every trade-off analysis
- [x] Documents pros, cons, and risks for each approach
- [x] Provides a clear recommendation with reasoning
- [x] Identifies open questions that need resolution
- [x] Never writes code or modifies files — advisory only
- [x] Never makes implementation decisions — only recommends

## Common Use Cases

| Scenario | What the brainstormer does |
|---|---|
| "REST vs GraphQL for our API?" | Evaluates both approaches with project-specific pros/cons, recommends based on use case and team expertise |
| "Monolith or microservices?" | Reframes the problem, evaluates tradeoffs (complexity, deployment, team size), identifies risks for each |
| "Which state management library?" | Compares options based on project needs, community support, learning curve, and long-term maintenance |
| "Should we build or buy this feature?" | Evaluates build cost, buy cost, customization needs, and vendor lock-in risks |

## Output Structure

The brainstormer produces structured analysis with these sections:

1. **Problem Reframe** — restated problem, potentially challenging the original framing
2. **Approaches** — each approach evaluated with pros, cons, and risk factors
3. **Recommendation** — clear recommendation with reasoning
4. **Open Questions** — unknowns that need answers before finalizing the decision
5. **Risks** — identified risks and proposed mitigation strategies

## Pro Tips

### Challenge the Problem, Not Just the Solutions

The most valuable output of a brainstorming session is often the problem reframe. If you ask "REST or GraphQL?" the brainstormer might first ask "do you actually need an API at this point, or would direct database access simplify your architecture?" This challenge of premises prevents optimizing for the wrong problem.

### Use the Brainstormer Before the Planner Locks In

The brainstormer is most valuable when invoked early — before the planner commits to a specific approach. Once a plan is approved (Gate 1), changing the fundamental approach is expensive. The brainstormer's trade-off analysis is designed to prevent premature commitment to a suboptimal approach.

## Key Takeaway

The brainstormer ensures that technical decisions are made by comparing alternatives rather than defaulting to the first idea. By providing structured trade-off analysis with clear recommendations, it prevents the "we never considered other options" regret that often surfaces during implementation.

## Related Agents

- **[planner](/reference/agents/planner)** — receives the brainstormer's recommendations and incorporates them into the plan
- **[architect](/reference/agents/architect)** — handles architectural decisions after the brainstormer identifies trade-offs
- **[researcher](/reference/agents/researcher)** — provides technical research that feeds into the brainstormer's analysis
- **[orchestrator](/reference/agents/orchestrator)** — routes Complex tasks to the brainstormer during Phase 1

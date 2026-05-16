# Context Engineering for Autonomous Agents

Autonomous agents face context challenges that chatbots and coding assistants don't: open-ended exploration, unpredictable tool outputs, sessions that run for hundreds of turns, and no human in the loop to course-correct when the context degrades.

## Why Autonomous Agents Are Different

A chatbot handles a conversation that lasts 10-20 turns, and a coding agent works on a task that might take 50-100 turns but operates within a well-defined codebase. An autonomous agent (research agent, browsing agent, task automation system) faces a fundamentally different challenge: it explores an open-ended space, accumulates context from unpredictable sources, and runs long enough that context management becomes the primary engineering problem.

LOCA-bench, the first benchmark specifically designed for long-running agentic scenarios, confirmed what practitioners already suspected: agents that accumulate context without active management degrade dramatically over time, and the degradation is worse than what single-turn context rot benchmarks predict. The interaction between exploration, tool output accumulation, and multi-step reasoning compounds the problem in ways that static context rot doesn’t capture.

## Observation Management

The biggest source of context bloat in autonomous agents is tool output. A web search returns 10 results with snippets, a page fetch returns the full HTML, a file listing dumps directory contents; each observation is potentially useful for the current step, but most of it becomes noise within a few turns.

**Summarize observations immediately**: When an agent receives tool output, compress it to the relevant findings before adding it to context. A web search that returned 10 results should become 2-3 sentences about what was found. Ten URL-title-snippet blocks consume 500 tokens each and add nothing once the agent has read them. The raw output served its purpose the moment the agent processed it.

**Separate observation storage from working context**: Write raw tool outputs to an external log (Write Outside the Window) and keep only structured summaries in the context window. The external log is there if the agent needs to revisit a specific observation; the context window holds only the interpretation.

**Budget tool outputs**: Set a maximum token allocation for tool results in the context window and enforce it. When new observations push past the budget, compress or drop the oldest ones. Without a hard limit, observation tokens will consume the majority of the context window within 20-30 turns, leaving minimal room for the agent’s own reasoning.

## Planning Context

Autonomous agents need a plan, and the plan needs to live somewhere the model can reference it without reconstructing it from conversation history on every turn. The Scratchpad pattern addresses this directly.

**Maintain an evolving plan block**: At the start of each turn, the agent should see its current plan with completed steps marked, the current step highlighted, and remaining steps listed. This prevents the agent from re-deriving its approach from scratch, which is where most long-running agents start looping or losing track of what they’ve already done.

**Update the plan, don’t just append**: When the agent discovers something that changes the plan (a dead end, a new approach, additional requirements), update the plan block in place. The plan should always reflect the current state of the task; the conversation history can hold the detail of how it got there.

**Include decision rationale**: When the plan changes, record why. “Switched from API approach to scraping because the API requires authentication we don’t have” prevents the agent from circling back to the API approach 20 turns later when the original decision has scrolled out of effective attention range.

## Error Recovery

Autonomous agents fail frequently (API calls time out, web pages don’t load, file operations hit permissions issues, intermediate reasoning steps produce wrong results), and the context engineering question is what the agent needs in its window to recover without carrying the full weight of every failure.

**Keep error context short and diagnostic**: When a tool call fails, the agent needs the error message and enough context to decide whether to retry, try an alternative, or skip the step. It doesn’t need the full stack trace or the complete request/response payload. A one-line error summary with the action that caused it is usually sufficient.

**Limit retry history**: If the agent has tried the same operation three times and failed, it doesn’t need all three failure records in context. Keep the most recent attempt and a count: “Failed 3 times, last error: timeout after 30s.” Three full error traces in context consume tokens and signal “keep trying” rather than “try something different.”

**Maintain a failure log externally**: Write detailed error information to an external log and keep only actionable summaries in the context window. If the agent needs to investigate a pattern of failures, that’s a deliberate read from the external log; working context holds the summary.

## When to Compress vs. When to Restart

The longest-running agent sessions face a fundamental decision: compress the existing context and continue, or start a fresh context with a summary of findings so far. The right choice depends on how much the remaining work depends on the accumulated state.

**Compress when the work is sequential**: If the agent is partway through a structured task (step 5 of 8) and the remaining steps build directly on earlier findings, compress the history and continue. The compressed summary preserves the state needed for subsequent steps.

**Restart when the work is parallel**: If the remaining sub-tasks are independent of each other, start fresh contexts for each one. A research agent that has identified three topics to investigate should spawn three focused contexts rather than continuing in a bloated window that carries context from all three topics.

**Set a compression trigger**: Don’t wait until the context window is full. Set a threshold at 60-70% of the model’s effective window (not the advertised window) and trigger compression or restart when the agent crosses it. For a 128k model, that means triggering around 40-50k tokens, well before the quality degradation becomes severe. LOCA-bench data shows that proactive context management at these thresholds substantially outperforms reactive management that waits until quality visibly degrades.

## Common Mistakes

**No observation budget**: Letting tool outputs accumulate without compression or eviction. By turn 30, the context window is 80% raw observations and 20% useful reasoning.

**Reconstructing state from history**: Relying on the model to re-read conversation history to figure out where it is. Maintain explicit state in a scratchpad instead. This works for 10 turns; it fails at 50.

**Single-context for compound task**s: Running a complex, multi-topic investigation in a single context window when it should be decomposed into focused sub-contexts with Isolate. The token cost of isolation is lower than the quality cost of a polluted context.

**No plan persistence**: Starting with a plan in the first turn and relying on the model to remember it. Plans should be re-injected or maintained as structured state, because the model’s ability to attend to early turns decreases as the session grows.

# Improving Deep Agents with Harness Engineering

## The Goal of Harness Engineering

The goal of a harness is to mold the inherently spiky intelligence of a model for tasks we care about. Harness Engineering is about systems, you’re building tooling around the model to optimize goals like task performance, token efficiency, latency, etc. Design decisions include the system prompt, tool choice, and execution flow.

But how should you change the harness to improve your agent?

At LangChain, we use [Traces](https://docs.langchain.com/langsmith/observability-quickstart) to understand agent failure modes at scale. Models today are largely black-boxes, their inner mechanisms are hard to interpret. But we can see their inputs and outputs in text space which we then use in our improvement loops.

We used a simple recipe to iteratively improve [deepagents-cli](https://docs.langchain.com/oss/python/deepagents/cli/overview) (our coding agent) 13.7 points from 52.8 to 66.5 on Terminal Bench 2.0. We only tweaked the harness and kept the model fixed, gpt-5.2-codex.

## Experiment Setup & The Knobs on a Harness

We used [Terminal Bench](https://www.tbench.ai/) 2.0, a now standard benchmark to evaluate agentic coding. It has 89 tasks across domains like machine learning, debugging, and biology. We use [Harbor](https://www.harborframework.com/) to orchestrate the runs. It spins up sandboxes ([Daytona](https://www.daytona.io/)), interacts with our agent loop, and runs verification + scoring.

Every agent action is stored in [LangSmith](https://smith.langchain.com/). It also includes metrics like latency, token counts, and costs.

## The Knobs we can Turn

An agent harness has a lot of knobs: system prompts, tools, hooks/middleware, skills, sub-agent delegation, memory systems, and more. We deliberately compress the optimization space and focus on three: System Prompt, Tools, and Middleware (our term for hooks around model and tool calls).

We start with a default prompt and standard tools+middleware. This scores 52.8% with GPT-5.2-Codex. A solid score, just outside the Top 30 of the leaderboard today, but room to grow.

1. Baseline (The Starting Point)

- **Performance:** $52.8\%$
- **Context:** This represents a standard LLM call with a static system prompt. It likely struggles with "hallucinations" or lack of environmental awareness, as it relies purely on the internal knowledge of the model to plan and code.

2. Infrastructure Layer Optimization (Custom Prompt & Middleware)

- **Performance:** $63.6\%$ ($+10.8\%$ gain)
- **Engineering Implementation:** \* **Build-Verify Loop:** Instead of a single "fire and forget" generation, the system now incorporates a **feedback loop**. It writes code, attempts to build it, and uses the compiler/linter errors to self-correct.
  - **Context Injection:** The middleware likely scrapes the local file structure or environment variables, giving the model "eyes" on the actual project state.
  - **Safety Mechanisms:** Adding **Loop Protection** and **Timeout Warnings** is a classic reliability pattern to prevent the agent from getting stuck in infinite recursion or burning excessive tokens.

3. Cognitive Layer Optimization (Adaptive Reasoning)

- **Performance:** $66.5\%$ ($+2.9\%$ additional gain)
- **Engineering Implementation:**
  - **Dynamic Compute:** "xhigh+high reasoning" suggests that the system is now varying its internal "thinking time" or reasoning depth based on the complexity of the task.
  - **Adaptive Strategy:** Rather than using the same heavy reasoning for simple tasks (like renaming a variable), it allocates more "cognitive" resources to complex logic changes, optimizing for both accuracy and likely cost/latency.

## The Trace Analyzer Skill

We wanted trace analysis to be repeatable, so we made it into an Agent Skill. This became our recipe to analyze errors across runs and make improvements to the harness. The flow is:

1. Fetch experiment traces from LangSmith
2. Spawn parallel error analysis agents → main agent synthesizes findings + suggestions
3. Aggregate feedback and make targeted changes to the harness.

This works similarly to boosting which focuses on mistakes from previous runs. A human can be pretty helpful in Step 3 (though not required) to verify and discuss proposed changes. Changes that overfit to a task are bad for generalization and can lead to regressions in other Tasks.

Automated trace analysis saves hours of time and made it easy to quickly try experiments. We’ll be publishing this skill soon, we’re currently testing it for prompt optimization generally.

1. Data Ingestion Layer (Fetch)
   The entry point is a **Source Connector** (specifically referencing LangSmith).

- **Mechanism:** The system performs a bulk fetch of $N$ Traces.
- **Engineering Perspective:** This represents the retrieval of raw telemetry data. From a performance standpoint, this likely involves paginated API calls or a streaming fetch to gather the dataset into a "Raw Data" buffer/state.

2. Distributed Processing Layer (Analyze)
   This is the core of the system, utilizing a **Scatter-Gather pattern** to handle scale.

- **Batching & Parallelization:** To avoid hitting LLM context window limits or to reduce total latency, the raw data is partitioned into "Batches."
- **Worker Sub-Agents:** The system spins up parallel worker nodes (Sub-Agents). Each agent is specialized for **Error Analysis**. By isolating batches, we achieve horizontal scaling.
- **Aggregation (Main Agent):** This acts as the "Reducer." It collects the independent outputs from all sub-agents and performs **Synthesis**. The goal here is to identify patterns, recurring bugs, or systemic performance bottlenecks that a single batch might not reveal.

3. Feedback & Governance Layer (Review)
   The pipeline transitions from an automated process to a **Human-in-the-Loop (HITL)** pattern.

- **Inference Output:** The Main Agent produces structured output: _Findings_ (what went wrong) and _Suggestions_ (how to fix it).
- **Manual Gate:** The "Human Review" step acts as a final validation gate. This is a critical engineering safeguard to ensure that the "next experiment" or system change is logically sound before deployment.

## What Actually Improved Agent Performance

Automated Trace analysis allowed us to debug where agents were going wrong. Issues included reasoning errors, not following task instructions, missing testing and verification, running out of time, etc. We go into these improvements in more details in the sections below.

## Build & Self-Verify

Today’s models are exceptional self-improvement machines.

Self-verification allows agents to self-improve via feedback within a run. However, they don’t have a natural tendency to enter this build-verify loop.

The most common failure pattern was that the agent wrote a solution, re-read its own code, confirmed it looks ok, and stopped. Testing is a key part of autonomous agentic coding. It helps test for overall correctness and simultaneously gives agents signal to hill-climb against.

We added guidance to the system prompt on how to approach problem solving.

1. **Planning & Discovery**: Read the task, scan the codebase, and build an initial plan based on the task specification and how to verify the solution.
2. **Build**: Implement the plan with verification in mind. Build tests, if they don’t exist and test both happy paths and edge cases.
3. **Verify**: Run tests, read the full output, compare against what was asked (not against your own code).
4. **Fix**: Analyze any errors, revisit the original spec, and fix issues.

We really focus on testing because it powers the changes in every iteration. We found that alongside prompting, deterministic context injection helps agents verify their work. We use a PreCompletionChecklistMiddleware that intercepts the agent before it exits and reminds it to run a verification pass against the Task spec. This is similar to a Ralph Wiggum Loop where a hook forces the agent to continue executing on exit, we use this for verification.

1. The Build Phase (Generation)
   In this initial step, the agent acts as the **developer**. Based on a requirement or prompt, it generates a candidate solution—whether that is a block of code, a configuration file, or a UI component. At this stage, the output is considered an "unverified draft."

2. The Verification Gate (Automated Testing)
   This is the most critical phase for reliability. Instead of relying on the LLM to "guess" if its code works, the system plugs the output into a **real execution environment**.

- **Static Analysis:** Checking against specifications (types, linting, schema validation).
- **Dynamic Analysis:** Running actual unit or integration tests.
- **Result:** This step produces a clear pass/fail signal along with stack traces or error logs.

3. The Refinement Phase (Self-Correction)
   If the verification fails, the error logs are fed back into the agent's context.

- **Contextual Debugging:** The agent doesn't just "retry"; it analyzes the specific failure (e.g., a `NullPointerException` or a failed assertion) to understand _why_ the previous attempt failed.
- **Re-generation:** It refines the logic to address the specific bug identified in step 2.

4. Convergence (Iterate Until Correct)
   The loop repeats until the verification gate returns a "Success" signal or a predefined retry limit is reached.

- **Engineering Benefit:** This significantly reduces the need for human code review on trivial syntax or logic errors.
- **Safety:** It ensures that no code is "shipped" or merged unless it has passed the automated test suite, effectively creating a self-healing CI/CD pipeline within the agent's execution run.

## Giving Agents Context about their Environment

Part of harness engineering is building a good delivery mechanism for context engineering. Terminal Bench tasks come with directory structures, built-in tooling, and strict timeouts.

1. **Directory Context & Tooling**: A LocalContextMiddleware runs on agent start to map the cwd and other parent+children directories. We run bash commands to find tools like Python installations. Context discovery and search are error prone, so injecting context reduces this error surface and helps onboard the agent into its environment.
2. **Teaching Agents to Write Testable Code**: Agents don’t know how their code needs to be testable. We add prompting say their work will be measured against programatic tests, similar to when committing code. For example, Task specs that mention file paths should be followed exactly so the solutions works in an automated scoring step. Prompting that stresses edge-cases helps the agent avoid only checking “happy path” cases. Forcing models to conform to testing standards is a powerful strategy to avoid “slop buildup” over time.
3. **Time Budgeting**: We inject time budget warnings to nudge the agent to finish work and shift to verification. Agents are famously bad at time estimation so this heuristic helps in this environment. Real world coding usually doesn’t have strict time limits, but without adding any knowledge of constraints, agents won’t work within time bounds.

The more that agents know about their environment, constraints, and evaluation criteria, the better they can autonomously self-direct their work.

> The purpose of the harness engineer: prepare and deliver context so agents can autonomously complete work.

## Encouraging Agents to Step Back & Reconsider Plans

Agents can be myopic once they’ve decided on a plan which results in “doom loops” that make small variations to the same broken approach (10+ times in some traces).

We use a LoopDetectionMiddleware that tracks per-file edit counts via tool call hooks. It adds context like “…consider reconsidering your approach” after N edits to the same file. This can help agents recover from doom loops, though the model can continue down the same path if it thinks it’s correct.

Important note. This is a design heuristic that engineers around today’s perceived model issues. As models improve, these guardrails will likely be unnecessary, but today helps agents execute correctly and autonomously.

## Choosing How Much Compute to Spend on Reasoning

Reasoning models can run autonomously for hours so we have to decide how much compute to spend on every subtask. You can use the max reasoning budget on every task, but most work can benefit from optimizing reasoning compute spend.

Terminal Bench timeout limits create a tradeoff. More reasoning helps agents evaluate each step, but can burn over 2x more tokens/time. gpt-5.2-codex has 4 reasoning modes, low, medium, high, and xhigh.

We found that reasoning helps with planning to fully understand the problem, some Terminal Bench tasks are very difficult. A good plan helps get to a working solution more quickly.

Later stage verification also benefits from more reasoning to catch mistakes and get a solution submitted. As a heuristic, we choose a xhigh-high-xhigh "reasoning sandwich" as a baseline.

1. The High-Context Header: Plan & Understand

- **Resource:** `xhigh reasoning` (e.g., a heavy-duty reasoning model).
- **Budget:** First $25\%$.
- **Engineering Goal:** **System Architecture and Scoping.** This phase is where the "thinking" happens. The agent needs maximum cognitive capability to parse complex requirements, identify edge cases, and map out a dependency graph. If the plan is flawed here, the entire run will fail.

2. The Execution Body: Build & Iterate

- **Resource:** `high reasoning` (e.g., a faster, more cost-effective model).
- **Budget:** Middle $50\%$.
- **Engineering Goal:** **Implementation and Throughput.** Once the architecture is set, the system shifts into a "production mode." This stage involves the "Build-Verify Loop" discussed earlier—writing code, running tests, and fixing syntax errors. Because the heavy lifting of _planning_ is done, the system can trade off some reasoning depth for higher speed and lower latency.

3. The Validation Footer: Final Verification

- **Resource:** `xhigh reasoning`.
- **Budget:** Last $25\%$.
- **Engineering Goal:** **Quality Assurance and Sanity Check.**
  The final step brings back the heavy-hitter model to audit the completed work. It acts as a **Senior Lead Developer** performing a final code review. It looks for subtle logic bugs or security vulnerabilities that a faster model might have missed during the iteration phase.

Running only at xhigh scored poorly at 53.9% due to agent timeouts compared to 63.6% at high. There weren’t large differences in trial runs across reasoning budget splits so we stuck with our approach which pushed the score to 66.5%.

The natural approach for models is Adaptive Reasoning, seen with Claude and Gemini models where the model decides how much compute to spend on reasoning.

In a multi-model harness, balancing reasoning budgets could play out as using a large model for planning and handing off to a smaller model for implementation.

## Practical Takeaways for Building Agent Harnesses

The design space of agents is big. Here are some general principles from our experiments and building deepagents overall.

1. **Context Engineering on Behalf of Agents**. Context assembly is still difficult for agents today, especially in unseen environments. Onboarding models with context like directory structures, available tools, coding best practices, and problem solving strategies helps reduce the error surface for poor search and avoidable errors in planning.
2. **Help agents self-verify their work**. Models are biased towards their first plausible solution. Prompt them aggressively to verify their work by running tests and refining solutions. This is especially important in autonomous coding systems that don’t have humans in the loop.
3. **Tracing as a feedback signal**. Traces allow agents to self-evaluate and debug themselves. It’s important to debug tooling and reasoning together (ex: models go down wrong paths because they lack a tool or instructions how to do something).
4. **Detect and fix bad patterns in the short term**. Models today aren’t perfect. The job of the harness designer is to design around today’s shortcomings while planning for smarter models in the future. Blind retries and not verifying work are good examples. These guardrails will almost surely dissolve over time, but to build robust agent applications today, they’re useful tools to experiment with.
5. **Tailor Harnesses to Models**. The Codex and Claude prompting guides show that models require different prompting. A test run with Claude Opus 4.6 scored 59.6% with an earlier harness version, competitive but worse than Codex because we didn’t run the same Improvement Loop with Claude. Many principles generalize like good context preparation and a focus on verification, but running a few rounds of harness iterations for your task helps maximize agent performance across tasks.

There’s more open research to do in harness design. Interesting avenues include multi-model systems (Codex, Gemini, and Claude together), memory primitives for continual learning so agents can autonomously improve on tasks, and measuring harness changes across models.

For the outer loop of improving agents, we’re looking at methods like RLMs to more efficiently mine traces. We’ll be continuing work to improve the harness and openly share our research.

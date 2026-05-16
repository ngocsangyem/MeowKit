> Source: https://goonnguyen.substack.com/p/harness-engineering-la-gi
> Translate by Gemini
> https://substack.com/@goonnguyen

# What is Harness Engineering?

# What is Harness Engineering?

### About 1-2 years ago we had Prompt Engineering; just as we mastered it, the AI world moved to Context Engineering. While fumbling through Context Engineering, we're now hearing about: Harness Engineering...

Everything is changing very fast: 1-2 years ago we had Prompt Engineering; by the time you mastered it, the AI world had moved to Context Engineering; while you were still fumbling and hadn't mastered Context Engineering, now there is Harness Engineering...

![](<[https://substackcdn.com/image/fetch/$s_!eiG3!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fe10ae097-4473-4734-936d-2845c45bad73_1484x1317.png](https://substackcdn.com/image/fetch/$s_!eiG3!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fe10ae097-4473-4734-936d-2845c45bad73_1484x1317.png)>)

Don't worry, as I've said in previous posts, these are all just fancy, `cool-sounding` names people come up with. If you understand the essence, it'll be fine (actually, I only learned this term recently).

**In this post, let's explore Harness Engineering**—of course... according to my own understanding! 🤣

---

## 1/ What is Harness Engineering?

**Harness Engineering is the technique of building the entire "environment" around an AI model**—including tools, access permissions, memory, feedback loops, guardrails, context management, and session handoffs—everything **except** the model itself.

This term was coined by Mitchell Hashimoto—the HashiCorp tycoon and father of Terraform—in early February 2026. He defined it very simply:

> _“Anytime you find an agent makes a mistake, you take the time to engineer a solution such that the agent never makes that mistake again.”_

Roughly translated: **Every time an agent makes a mistake, you don't pray for it to do better next time—you build a solution so it NEVER makes that mistake again.**

Sounds simple, right?

But 90% of those using AI are still just focusing on writing better prompts or choosing better models, while forgetting the most important thing: **designing the environment** for it to perform better.

![](https://substackcdn.com/image/fetch/$s_!mY8e!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F11b49657-f4d2-467b-8df3-cbd88e026260_1419x657.png)

Think of it this way—the three stages of evolution:

- **Prompt Engineering (2022-2024)**: “How to ask AI correctly?” - focus on the question.
- **Context Engineering (2025)**: “What information to give AI so it answers well?” - focus on input data.
- **Harness Engineering (2026)**: “How does the entire system around the AI operate?” - focus on **the entire ecosystem** around the model.

**Prompt engineering** is writing an email.

**Context engineering** is attaching the right files to the email.

**Harness engineering** is **designing the entire office**—processes, people, tools, quality control—so the work actually gets done.

---

## 2/ Why is the AI model NOT the most important thing?

This is the key point that many still haven't "absorbed."

I know—it sounds counterintuitive. AI labs are racing to see who has the better model, higher benchmarks, and longer context windows. But reality from research shows something entirely different:

**With the same model, the same task, and the same compute budget—just by changing the "environment" design—performance increases by 64%.**

This isn't a number I made up. This is the result from the [SWE-agent paper by the Princeton NLP group](https://arxiv.org/abs/2405.15793), published at NeurIPS 2024—one of the most prestigious conferences in the AI world.

**64% improvement.**

That is the difference between a tool that works and one that is useless.

And it comes ENTIRELY from environment design, not from any improvements to the model.

![](https://substackcdn.com/image/fetch/$s_!Ij8I!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F761a9fd0-c495-4b2b-ac11-1487e4036119_1090x1154.png)

Rohit Verma—a fairly prominent AI engineer on X—wrote a [very detailed thread](https://x.com/rohit4verse/status/2033945654377283643) on this topic (over 1 million views). He summarized it with a quote I really like:

> “The model is what thinks. The harness is what it thinks about. Getting that distinction right is the entire game.”

Understanding this difference—you win.

---

## 3/ Lessons from SWE-agent: +64% performance just by interface design

The SWE-agent paper introduces a very cool concept: **Agent-Computer Interface (ACI)**—the interface between an AI agent and the computer. Just as HCI (Human-Computer Interface) designs interfaces for humans, ACI designs interfaces for AI agents.

And here is the critical insight: **AI agents do not think like humans**. They process tokens sequentially, are sensitive to information order, have limited working memory, and are easily "distracted" by irrelevant information in the context window. Good interface design means understanding these limitations and building AROUND them, rather than AGAINST them.

![](https://substackcdn.com/image/fetch/$s_!bN3-!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fbd013103-8f4f-48d8-a711-c39988443467_1267x766.png)

The [Princeton NLP](https://arxiv.org/abs/2405.15793) group built 4 main components in their ACI:

**a) Search with limited results**

When you run `grep` on a large codebase and it returns 10,000 lines—you aren't giving the agent more information. You are **flooding** its working memory with trash. The agent will thrash—run more greps, create more noise, gradually fill the context window, and then either fail or get stuck.

The solution? **Limit results to a maximum of 50 items.** If it exceeds 50, the tool reports "too many results, please refine your query." Sounds "offensively" simple, right? But this is one of the highest-leverage decisions in the entire paper. **It forces the agent to be more specific instead of vague and rambling.**

**b) File viewer with line numbers**

Displaying 100 lines at a time—the "Goldilocks" number—has a specific name.

Less (30 lines) and the agent loses surrounding context. More and the agent forgets where it is. And importantly: **prepend line numbers** to every line. Simple, yet extremely useful—when the agent needs to edit lines 47-52, it reads the line numbers directly instead of having to count. This saves working memory for more important tasks.

**c) Editor with integrated linter**

After every edit, the tool automatically runs a linter. If an edit creates a syntax error—**reject it immediately** before applying, with a clear error message. This prevents cascading failures—where an agent creates a syntax error, runs a test, sees it fail elsewhere, spends 10 steps chasing a "ghost" bug, and finally runs out of context without fixing anything.

**d) Context management**

History older than 5 turns is compressed into a 1-line summary. The agent still knows what it did but isn't buried in the full history of every command ever run.

---

## 4/ Anthropic teaches us how to build long-running apps

OK, SWE-agent solves the problem of "how to design an interface for a single session." But what about reality? Most real software projects are **too large** to be completed within one context window.

Anthropic's engineering team (specifically [Prithvi Rajasekaran](./harness-design-long-running-apps.md) from Anthropic Labs) published two excellent blog posts on how they solve this. In their latest post (published 3/24/2026), they pushed the boundaries further with a 3-agent architecture.

### Two common failure modes

In internal experiments, the Anthropic team discovered two recurring failure patterns:

- **Pattern 1: "Doing too much at once"** - An agent receives the prompt "build a clone of claude.ai" and immediately tries to implement everything at once. One feature isn't finished before it jumps to the next, runs out of context window mid-way, and the next session receives a mess of half-finished code, no documentation, and no clue what state anything is in.
- **Pattern 2: "Declaring victory too early"** - After some features are built, a new agent instance looks around, sees code exists, concludes "done!", and stops. This isn't stupidity—it's logical reasoning based on incomplete information. The agent has no way of knowing what "done" means for this project.

There is also the issue of **self-evaluation**: when asked to evaluate the quality of its own work, an agent almost always gives praise—even when the output is clearly bad. This is especially true for subjective tasks like design, where there is no binary pass/fail.

### The solution: multi-agent architecture

**Version 1 (2025)**: Two agents - Initializer + Coding Agent

- **Initializer agent**: A specialized first session whose sole purpose is to set up the environment—create `init.sh`, create a feature list (200+ specific features, each initially `"passes": false`), create `claude-progress.txt`, and make the first git commit.
- **Coding agent**: Every subsequent session—handles 1 feature, tests, commits, updates the progress file, and cleans the state.

A notable detail: the feature list is saved as **JSON instead of Markdown**. The reason is interesting—empirically, the model is less prone to arbitrarily modifying or overwriting JSON files compared to Markdown. JSON has a rigid structure that resists messy edits. A small detail, but a large consequence.

![](<[https://substackcdn.com/image/fetch/$s_!KlXm!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6c6bcb69-436b-49ae-9264-257b35c7268c_1452x1223.png](https://substackcdn.com/image/fetch/$s_!KlXm!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6c6bcb69-436b-49ae-9264-257b35c7268c_1452x1223.png)>)

**Version 2 (3/2026 - latest)**: Three agents - Planner + Generator + Evaluator

Inspired by GANs (Generative Adversarial Networks), the Anthropic team added a 3rd agent:

- **Planner**: Takes a 1-4 sentence prompt → expands it into a full product spec. Instructed to be ambitious about scope but focused on product context, avoiding deep technical details (because if the planner gets a technical detail wrong → errors cascade down to implementation).
- **Generator**: Builds in sprints, one feature at a time. Uses React + Vite + FastAPI + SQLite/PostgreSQL.
- **Evaluator**: Uses Playwright MCP to actually click through the running app, testing like a real user, and scoring based on 4 criteria (design quality, originality, craft, functionality).

The result? A 1-sentence prompt "Create a 2D retro game maker" → solo agent runs for 20 mins, $9, game DOES NOT RUN. Full harness runs for 6 hours, $200, game runs, has AI-powered features, and coherent design.

With a leaner version using Opus 4.6, the prompt "Build a fully featured DAW in the browser" → 4 hours, $124.70 → results in a complete DAW program with arrangement view, mixer, transport, and an AI agent that can compose music.

I rate Anthropic's harness engineering approach: **9/10**. Truly solid methodology.

---

## 5/ The Claude Code source code leak - and shocking discoveries

On March 31, 2026, Anthropic accidentally shipped a 59.8 MB source map file in the `@anthropic-ai/claude-code` version 2.1.88 package on npm. Within hours, about 512,000 lines of TypeScript were mirrored across GitHub and thousands of developers began analyzing it.

Phew. Anthropic confirmed this was a "packaging error due to human error, not a security breach." No customer data or credentials were exposed.

But... this leak accidentally PROVED the harness engineering argument more strongly than ever. Because what was leaked **wasn't model weights**—it was the **agentic harness**—the shell around the model. And looking at it, you'll understand why Claude Code is so good.

![](<[https://substackcdn.com/image/fetch/$s_!ndJ6!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fd1573777-2ca9-47e9-b646-85af2e07a7f7_1479x921.png](https://substackcdn.com/image/fetch/$s_!ndJ6!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fd1573777-2ca9-47e9-b646-85af2e07a7f7_1479x921.png)>)

### Notable findings:

**a) 5 context management strategies:**

MicroCompact → AutoCompact → Full Compact → Session Memory → Truncation. This is how Claude Code solves "context rot"—where as the context window fills, quality degrades. They have 5 levels of compression applied depending on the situation.

**b) 3-tier memory - extremely smart design:**

- Tier 1: `MEMORY.md` - only ~200 tokens, always loaded. This is the "index" pointing to other knowledge.
- Tier 2: Topic files - loaded on-demand when needed.
- Tier 3: Full session transcripts - searchable.

There is also an `autoDream` mode—like "sleeping to consolidate memory." When the user is idle, a forked subagent runs in the background to merge observations, resolve logical contradictions, and compress insights into clearer facts. Exactly like the memory consolidation mechanism in human sleep—but implemented for an AI agent!

**c) 3 subagent models:**

- **Fork**: Shares KV cache with parent (parallelism is almost free!)
- **Teammate**: Communicates via mailbox.
- **Worktree**: Separate Git branch.

**d) 40+ tools with individual permission-gating:**

The model decides what it wants to do, but the tool system decides what it is allowed to do. These two are architecturally separate. 23 layers of validation for bash commands. Each tool has explicit permission requirements checked before execution.

**e) Frustration detection via regex:**

Claude Code detects user frustration using regex pattern matching—"wtf", "so frustrating", "this is broken"—and adjusts its response tone. No LLM call needed. A $0 regex beats a $0.01 model call when accuracy is comparable. This is a core harness engineering principle: **use the cheapest, fastest tool that solves the problem.**

**f) Claude Code generates $2.5 billion ARR:**

And much of that value comes from the harness, not the model.

> _You have to admit, Anthropic's engineering team built a very fine harness. And this leak, while an unfortunate incident, became the best practical lesson in harness engineering the AI industry has ever had._

---

## 6/ ClaudeKit & GoClaw: “harness in harness” - harness²

OK, enough about others, let's talk about "home" for a bit 😁

![](<[https://substackcdn.com/image/fetch/$s_!9mHB!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F962645fd-ef90-422b-bb7e-75e7f07245e6_1419x801.png](https://substackcdn.com/image/fetch/$s_!9mHB!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F962645fd-ef90-422b-bb7e-75e7f07245e6_1419x801.png)>)

### ClaudeKit - harness² for coding

Claude Code itself is already a very good harness (Layer 7 in the taxonomy). So what does ClaudeKit do? ClaudeKit adds **another layer of harness on top** of Claude Code—creating what I call "harness in harness" or harness².

It's like: Claude Code is already wearing armor, and ClaudeKit puts another suit of armor on the outside. The effect? Massive compounding.

ClaudeKit has 5 layers of harness:

1/ **Structured workflows** - `/cook` 7 steps, `/fix` 6-8 steps. Instead of letting the agent roam free, it forces it through proven processes.

2/ **Persistent state** - Plan files + Native Tasks + Hydration Pattern. State survives context window boundaries—the exact problem Anthropic pointed out above.

3/ **Quality gates** - DAG enforcement. Prevents the agent from skipping steps or "declaring victory early."

4/ **Multi-agent coordination** - `/scout` for parallel research, `/team` for Agent Teams. Sub-agents act as a "context firewall"—keeping the parent thread clean.

5/ **Progressive disclosure** - 200 tokens metadata → 3K instructions → dynamic resources. Much more token-efficient than MCP because it doesn't load all tools upfront.

Mapping according to the 7-layer taxonomy:

| Layer | Who holds it? | What do they do?                   |
| :---- | :------------ | :--------------------------------- |
| L1    | Builder (you) | Approve, review, steer             |
| L2    | ClaudeKit     | `/plan` skill                      |
| L3    | ClaudeKit     | `/cook` + hydration pattern        |
| L4    | ClaudeKit     | Native Tasks integration           |
| L5    | ClaudeKit     | `/team` + `/scout` parallel agents |
| L6    | ClaudeKit     | Skills architecture                |
| L7    | Claude Code   | Context mgmt + Tools + Sessions    |

—

### GoClaw - harness for production agents

![](<[https://substackcdn.com/image/fetch/$s_!7fPt!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F7b33597f-7399-4993-90f2-2f3c6ae9018d_1443x608.png](https://substackcdn.com/image/fetch/$s_!7fPt!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F7b33597f-7399-4993-90f2-2f3c6ae9018d_1443x608.png)>)

What about GoClaw? GoClaw is an AI agent system for enterprises, rebuilt in Go with multi-tenant isolation, 5-layer security, and native concurrency. It also has a high-quality harness:

- **Agent Teams** - multiple agents collaborating, shared task board with `blocked_by` dependencies.
- **5-layer security** - security-first architecture.
- **Hooks system** - 25+ lifecycle events.
- **7 channels** - multi-channel communication (Telegram, Messenger, Web, API,...).
- **20+ LLM providers** - no lock-in to a single model.
- **Skills/MCP** - extensible tool system.
- **Context pruning** - automated context management.
- **SOUL.md/AGENTS.md** - persistent instructions.

If Claude Code + ClaudeKit is harness² for coding, then GoClaw is the harness for production AI agents at enterprise scale.

Two different problems, but the same philosophy: **the model is a commodity; the harness is the product.**

---

## [Rambling Corner] Harness Engineering vs. Context Engineering - what's the difference?

This is the question I get asked most. To be honest, the line is quite blurry, and the community hasn't 100% agreed.

In my understanding:

**Context Engineering** is a subset of Harness Engineering.
Context Engineering focuses on "providing the right information, at the right time, in the right format into the context window." It answers the question: **"What does the Agent need to see?"**

**Harness Engineering** includes context engineering but is much broader.

It also includes:

- Tool design (what tools does the agent use, what are the permissions?)
- Feedback loops (where are errors caught, how is feedback given?)
- State management (how does state survive across sessions?)
- Multi-agent coordination (how do agents work together?)
- Security & permissions (who is allowed to do what?)
- Verification & testing (how is output verified?)
- Architecture enforcement (how is the architecture maintained?)

It answers the question: **"How does the entire system operate?"**

The HumanLayer team (authors of 12-Factor Agents) put it well: context engineering was named by Dex—their cofounder—and harness engineering is a subset of context engineering specifically focused on coding agent harnesses.

> _But I think the opposite—context engineering is a subset of harness engineering 😄_

Regardless, this is just speculation. More importantly, understand the essence: **when models are good enough, the bottleneck shifts from "what the model can do" to "what the system allows the model to do."** Call it whatever you want, as long as you understand the essence.

![A Simple Guide to the Versions of the Inception Network | by Bharath Raj |  TDS Archive | Medium](https://substackcdn.com/image/fetch/$s_!2y64!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc7302b25-5218-47a6-8d72-85121b424098_512x265.jpeg)

Additionally, Stanford recently published a paper on **[Meta-Harness](https://arxiv.org/abs/2603.28052)** [(arxiv 2603.28052, April 2026)](https://arxiv.org/abs/2603.28052)—using AI to automatically optimize the harness for AI. Harness optimizing harness. Harness-ception (so exhausting) 🤯

---

## 8/ Conclusion

If you only remember one thing from this post, let it be this:

**The model is what thinks.**
**The harness is what it thinks ABOUT.**
**And the harness is what determines the final result.**

Harness engineering, at its heart, is just **systems thinking** applied to AI agent environments.

It's the skill of system design, API design, error handling, testing strategy—the things good software engineers / solution architects already know.

Only the domain is different: designing environments for LLM agents instead of interfaces for humans.

The bottom line:

If you want to build your own AI Agent system,
you need to understand Harness Engineering.

That's it, simple enough, right?

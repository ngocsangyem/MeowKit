---
name: mk:context-engineering
description: "Runtime context calls: ask, delegate, compact. NOT for mk:context-audit."
keywords:
  - context-engineering
  - context-budget
  - compaction
  - isolation
  - read-set
  - lost-in-middle
  - context-rot
  - lazy-loading
  - triage
  - just-in-time
  - sub-agent
when_to_use: "Near budget."
user-invocable: true
phase: on-demand
trust_level: kit-authored
injection_risk: low
owner: research
criticality: medium
status: active
runtime: claude-code
---

# mk:context-engineering — Runtime Context Router

Decide the next context move for the task in front of you: read more, stop, ask,
assume, or delegate — then load at most one pattern reference to execute it. This
skill routes decisions; it does not preload a knowledge library.

**Boundary vs `mk:context-audit`:** that skill audits *structural* `.claude/` overhead
(what is statically loaded every session). This skill decides *runtime* context moves
for one task. Structural question → context-audit. Runtime question → here. If a request
is ambiguous between the two (e.g. "this project's context is messy"), ask ONE question —
structural `.claude/` setup or this session's runtime context? — then route.

## When to Use

- Context is near its working ceiling and phases remain — decide what to keep.
- A long session is drifting or output quality is slipping.
- You must choose the minimal read-set before a task (Plan/Build/Review).
- You are choosing between `/compact`, `/clear`, and spawning a sub-agent.
- A known pattern applies (lost-in-middle, RAG dump, few-shot drift) and you want the routing.

## When NOT to Use

- Auditing `.claude/` token overhead → `mk:context-audit`.
- Persisting a learning or reading memory topic files → `mk:memory`.
- Finding *where* code lives → `mk:scout` (or `Read` for one known file).
- USD run cost → `mewkit budget`.
- A trivial 1–2 file task — no routing needed; just do it.

## Four Operations

The whole surface reduces to four moves. Name the one you need, then triage.

- **Write** — push durable state out of the window (memory file, scratchpad, handoff brief) so it survives compaction. Route via the persistence patterns.
- **Select** — load the smallest high-signal set; extract the function, not the file. Default stance for every read.
- **Compress** — summarize essential state and restart when the window degrades; re-ground the summary against sources.
- **Isolate** — give a sub-agent its own focused window for an independent slice; return a distilled result, not raw context.

## Decision Framework

Pick the move; each rule below points at its owner rather than restating it.

- **Read more**: only when a retrieval trigger in `.claude/skills/agent-detector/references/context-budget-rules.md` matches. No trigger, no read. If that file is absent, read only what a named acceptance criterion requires.
- **Stop**: you have enough to act, or two consecutive reads changed no decision, or the phase and tier read ceiling is reached. "Seems right" without evidence is not stop; verify.
- **Ask**: an ungreppable fact, a spec-versus-code conflict, or a business or irreversible decision. Scout first: if grep or a read answers it, do not ask.
- **Assume**: cheap-to-fix uncertainty. List your assumptions ("ASSUMPTIONS I'M MAKING ...") and proceed; never guess silently.
- **Delegate**: an independent sub-scope that would bloat this window goes to a sub-agent that returns a distilled result.

Keep it small: the smallest read-set that satisfies the acceptance criteria, no new pattern without an observed failure. Never quote an API, number or config from memory when it is greppable: read it.

When unsure which move fits, a short triage helps: which phase and tier; is the window near its ceiling, drifting, or poisoned by an earlier claim; what is the minimal read-set for this step; which one section of `references/pattern-index.md` matches. The size heuristic is to compact around 60 to 70% of the effective window; it is a signal, not a measurement. State the decision and the reason in a sentence.

## Pattern Routing Table

Match the runtime intent, load that ONE section of `references/pattern-index.md`. Never
load several.

| Intent (runtime signal) | Load section |
| --- | --- |
| Too much loaded; cut before adding | [less-noise](references/pattern-index.md#less-noise) |
| Long session, output drifting | [degraded-session](references/pattern-index.md#degraded-session) |
| State must survive compaction / new session | [persistence](references/pattern-index.md#persistence) |
| Decompose across sub-agents | [delegation](references/pattern-index.md#delegation) |
| RAG / index-first / grounding | [retrieval](references/pattern-index.md#retrieval) |
| Prompt ordering, trust levels, constraints | [prompt-structure](references/pattern-index.md#prompt-structure) |
| Few-shot, structured output, tool selection | [examples-tools](references/pattern-index.md#examples-tools) |
| Images / video in context | [multimodal](references/pattern-index.md#multimodal) |
| Key fact ignored mid-context | [critical-position](references/pattern-index.md#critical-position) |
| A model-generated claim treated as truth | [safety](references/pattern-index.md#safety) |

If no intent matches, note "no matching pattern" and proceed with the Four Operations
+ Decision Framework — do not stall or invent a reference.

## Host operations

| Situation | Move |
| --- | --- |
| Window long, task continues, keep the thread | Summarize in place; it costs latency, so skip it on small tasks. On Claude Code, `/compact` |
| Switching to an unrelated task | Start fresh, only after durable state is written out. On Claude Code, `/clear` |
| Independent sub-scope that would bloat this window | Hand it to a sub-agent |

## Gotchas

- Bad routing turns this into "a dump with extra steps" — load ONE reference section per decision, never several.
- The thresholds here are heuristics, not measured baselines: do not quote them as data.

## Related Skills

- `mk:context-audit` — use instead for structural `.claude/` overhead (tokens/% statically loaded).
- `mk:memory` — use instead to actually record or prune an entry in `.meowkit/memory/`; this skill only decides a write is warranted.
- `mk:scout` — use instead to discover *where* code lives; this skill decides *how much* to read.
- `mk:agent-detector` — use the canonical agent inventory for routing and on-demand instruction loading.

---
name: "context-engineering"
description: "Runtime router for context decisions during a task — decide read-more / stop / ask / assume / delegate, pick a minimal read-set, and time compaction. Front-page mental model is Write / Select / Compress / Isolate; a lazy pattern index routes to 25 context-engineering patterns, one reference per decision. Use when context is near budget, a long session is degrading, you must choose what to read for a task, or you are deciding /compact vs /clear vs a sub-agent. NOT for structural .codex/ overhead"
---

# mk:context-engineering — Runtime Context Router

Decide the next context move for the task in front of you: read more, stop, ask,
assume, or delegate — then load at most one pattern reference to execute it. This
skill routes decisions; it does not preload a knowledge library.

**Boundary vs `mk:context-audit`:** that skill audits *structural* `.codex/` overhead
(what is statically loaded every session). This skill decides *runtime* context moves
for one task. Structural question → context-audit. Runtime question → here. If a request
is ambiguous between the two (e.g. "this project's context is messy"), ask ONE question —
structural `.codex/` setup or this session's runtime context? — then route.

## When to Use

- Context is near its working ceiling and phases remain — decide what to keep.
- A long session is drifting or output quality is slipping.
- You must choose the minimal read-set before a task (Plan/Build/Review).
- You are choosing between `/compact`, `/clear`, and spawning a sub-agent.
- A known pattern applies (lost-in-middle, RAG dump, few-shot drift) and you want the routing.

## When NOT to Use

- Auditing `.codex/` token overhead → `mk:context-audit`.
- Persisting a learning or reading memory topic files → `mk:memory`.
- Finding *where* code lives → `mk:scout` (or `Read` for one known file).
- USD run cost → `mk:budget`.
- A trivial 1–2 file task — no routing needed; just do it.

## Four Operations

The whole surface reduces to four moves. Name the one you need, then triage.

- **Write** — push durable state out of the window (memory file, scratchpad, handoff brief) so it survives compaction. Route via the persistence patterns.
- **Select** — load the smallest high-signal set; extract the function, not the file. Default stance for every read.
- **Compress** — summarize essential state and restart when the window degrades; re-ground the summary against sources.
- **Isolate** — give a sub-agent its own focused window for an independent slice; return a distilled result, not raw context.

## Decision Framework

Pointer-style — the rules below own the detail; do not restate them here.

- **Read more** — only when a Retrieval Trigger in `context-budget-rules.md` matches (schema/contract change, security surface, cross-cutting refactor, failed verification, resume). No trigger → no read. (Rule file is present in a toolkit install; if absent downstream, fall back to: read only what a named acceptance criterion requires.)
- **Stop** — you have enough to act, OR two consecutive reads changed no decision, OR the phase/tier read ceiling is reached. "Seems right" without evidence is not stop — verify.
- **Ask** — an ungreppable fact, a spec-vs-code conflict, or a business/irreversible decision (`core-behaviors.md` #2, if present). Scout first: if grep/read answers it, don't ask.
- **Assume** — cheap-to-fix uncertainty. Emit an `ASSUMPTIONS I'M MAKING` block (format in Output Format below; matches `core-behaviors.md` #1 where present) and proceed; never silently guess.
- **Delegate** — an independent sub-scope that would bloat this window → Isolate into a sub-agent.

Anti-overengineering (keep it small): pick the smallest read-set that satisfies the
acceptance criteria; do not introduce a new pattern or abstraction without an observed
failure; prefer the boring move.

Anti-hallucination (don't invent): never quote an API, number, or config from memory
when it is greppable — read it. An unverifiable fact is an **Ask** or an explicit
**Assume**, never a silent guess.

## Triage (copy this checklist)

```
Context triage:
- [ ] 1. Phase + tier — which of Orient/Plan/Test/Build/Review/Ship/Reflect, and low/standard/complex?
- [ ] 2. Context risk — near ceiling? drifting? poisoned by a prior claim? key fact buried? (labeled heuristics, not measured)
- [ ] 3. Minimal read-set — the smallest set for THIS step (see context-budget-rules.md phase×tier, if present)
- [ ] 4. Route — load exactly ONE section of references/pattern-index.md matching the intent
- [ ] 5. Apply + emit the output contract (Context decision: …)
```

Step 2 thresholds are **labeled heuristics** (e.g. "compact around ~60–70% of the
effective window") — signals to act on, not measured facts. Do not present them as
measured.

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

## Host-Runtime Operations (host-specific)

The only host-coupled choices. Everything else above is host-agnostic.

| Situation | Move | Why |
| --- | --- | --- |
| Window long, task continues, keep thread | `/compact` | Summarize in place; costs latency — skip on small tasks. |
| Switching to an unrelated task | `/clear` | Fresh window; only after durable state is Written out. |
| Independent sub-scope, would bloat this window | Sub-agent | Isolated window; returns a distilled result. |

## Output Format

When this skill drives a decision, emit one line:

```
Context decision: <read-more | stop | ask | assume | delegate> — <one-line reason>
```

For **assume**, follow it with the `ASSUMPTIONS I'M MAKING` block and `→ Correct me now
or I'll proceed with these.`

## Gotchas

- Compacting at ~50% is safe but wastes latency on small tasks — the threshold is a heuristic, not a rule.
- Bad routing turns this into "a dump with extra steps" — load ONE reference section per decision, never several.
- The risk thresholds here are labeled heuristics, not measured baselines — don't quote them as data.

## Related Skills

- `mk:context-audit` — use instead for structural `.codex/` overhead (tokens/% statically loaded).
- `mk:memory` — use instead to actually read/write canonical `.meowkit/memory/` JSON stores; this skill only decides a write is warranted.
- `mk:scout` — use instead to discover *where* code lives; this skill decides *how much* to read.
- `mk:agent-detector` — use the canonical agent inventory for routing and on-demand instruction loading.
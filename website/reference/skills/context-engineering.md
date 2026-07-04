---
title: "mk:context-engineering"
description: "Runtime router for context decisions — read-more / stop / ask / assume / delegate, pick a minimal read-set, and time compaction, routing to 25 context patterns one reference at a time."
---

# mk:context-engineering

## What This Skill Does

Decides the next context move for the task in front of you — read more, stop, ask, assume, or delegate — then loads at most one pattern reference to execute it. It is a thin **router**, not a knowledge library: the 25 context-engineering patterns live in a lazy index and only the one relevant section is ever loaded, so the skill that manages context does not itself bloat context.

The whole surface reduces to four operations — **Write** (push durable state out of the window), **Select** (load the smallest high-signal set), **Compress** (summarize and restart when the window degrades), **Isolate** (give a sub-agent its own window).

## When to Use

- **Context is near its working ceiling and phases remain** — decide what to keep vs cut.
- **A long session is drifting** or output quality is slipping.
- **You must choose the minimal read-set** before a task (Plan / Build / Review).
- **You are choosing** between `/compact`, `/clear`, and spawning a sub-agent.
- **A known pattern applies** (lost-in-the-middle, RAG dump, few-shot drift) and you want the routing.

## When NOT to Use

- Auditing `.claude/` token overhead → `mk:context-audit`.
- Persisting a learning or reading memory topic files → `mk:memory`.
- Finding *where* code lives → `mk:scout` (or `Read` for one known file).
- USD run cost → `mk:budget`.
- A trivial 1–2 file task — no routing needed; just do it.

## Boundaries

| Question | Use this instead |
| --- | --- |
| How much of `.claude/` is statically loaded? (structural) | `mk:context-audit` |
| Actually read/write memory topic files | `mk:memory` |
| Where does code X live? | `mk:scout` |
| What does a run cost in USD? | `mk:budget` |
| **What should I read / when do I stop, ask, compact, delegate? (runtime)** | **`mk:context-engineering`** (this skill) |

One-line rule: a *structural* question about the always-on setup → `mk:context-audit`; a *runtime* question about this task → here. If a request is ambiguous ("this project's context is messy"), the skill asks one question — structural setup or this session's runtime context? — then routes.

## Usage

```bash
/mk:context-engineering
```

Then follow the triage checklist and emit the decision line.

## How It Works

A 5-step triage keeps each decision cheap:

1. **Phase + tier** — which workflow phase, and low / standard / complex?
2. **Context risk** — near ceiling? drifting? poisoned by a prior claim? key fact buried? (labeled heuristics, not measured)
3. **Minimal read-set** — the smallest set for *this* step (honors the phase×tier read-budget where present).
4. **Route** — load exactly ONE section of the pattern index matching the intent.
5. **Apply + emit the output contract.**

Every activated decision emits one line:

```
Context decision: <read-more | stop | ask | assume | delegate> — <one-line reason>
```

For `assume`, it is followed by an `ASSUMPTIONS I'M MAKING` block so cheap-to-fix uncertainty is surfaced, not silently guessed.

## Examples

**1. Context near full, phases remaining**

> "Context is nearly full and I still have 3 phases — what do I keep?"

```
Context decision: compress — long session near budget with phases left; summarize essential state and re-ground before continuing
→ loads pattern-index: degraded-session
```

**2. Choosing the minimal read-set before coding**

> "What's the minimum I should read before implementing task X?"

```
Context decision: read-more — no read yet; select the smallest set for this Build step
→ loads pattern-index: less-noise (select)
```

**3. Compact vs clear vs sub-agent**

> "Should I /compact, /clear, or split this into a sub-agent?"

```
Context decision: delegate — independent sub-scope would bloat this window
→ answered by the Host-Runtime Operations table (no pattern load needed)
```

**4. A key fact is being ignored mid-context**

> "Important info is buried in the middle of context and the model keeps skipping it."

```
Context decision: read-more — reorder, don't add; anchor the key fact at the recency-favored end
→ loads pattern-index: critical-position
```

**5. Ambiguous — one disambiguation question**

> "This project's context is messy."

```
Ask ONE question: do you mean the .claude/ structural setup (→ mk:context-audit) or this session's runtime context (→ this skill)?
```

## Pattern Index (routed, never all-loaded)

Ten intents map 1:1 to a section of `references/pattern-index.md`; the skill loads one section per decision:

`less-noise` · `degraded-session` · `persistence` · `delegation` · `retrieval` · `prompt-structure` · `examples-tools` · `multimodal` · `critical-position` · `safety`

Each section summarizes its patterns (when to load / triggers / produces / gotcha) so the underlying research files never enter context.

## Pro Tips

- **Load one reference per decision, never several** — routing to many sections turns the router into "a dump with extra steps."
- **Thresholds are labeled heuristics** (e.g. "compact around ~60–70% of the effective window") — act on them, but don't quote them as measured facts.
- **Pairs with `mk:context-audit`** — that skill owns the structural overhead question; this one owns the runtime-decision question. Together they cover both halves of "context."

> **Canonical source:** `.claude/skills/context-engineering/SKILL.md`

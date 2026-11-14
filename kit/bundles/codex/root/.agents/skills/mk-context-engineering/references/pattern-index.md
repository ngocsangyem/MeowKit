# Context Pattern Index

Routing map over 25 context-engineering patterns. Load this file when a triage step points here,
then read only the ONE intent section that matches. Each entry is a self-contained summary — enough
to know *when* to reach for the pattern and *what* it produces. The technique itself is standard;
this index is the routing layer, not a tutorial.

Load discipline: one intent section per decision. If two intents seem to apply, the task is really
two decisions — handle them one at a time.

## Contents

- [less-noise](#less-noise) — too much loaded; cut before adding
- [degraded-session](#degraded-session) — long session, output drifting
- [persistence](#persistence) — state must survive compaction or a new session
- [delegation](#delegation) — decompose across sub-agents
- [retrieval](#retrieval) — RAG, index-first, grounding
- [prompt-structure](#prompt-structure) — ordering, trust levels, constraints
- [examples-tools](#examples-tools) — few-shot, structured output, tool selection
- [multimodal](#multimodal) — images and video in context
- [critical-position](#critical-position) — a key fact is being ignored mid-context
- [safety](#safety) — a model-generated claim is treated as truth

Each entry: **When** (load condition) · **Triggers** · **Produces** · **Gotcha** · *Source* (prose).

---

## less-noise

Too much is loaded, or you are about to load "just in case". Default stance: cut first.

### select
- **When:** any context-assembly decision — the always-on default before adding anything.
- **Triggers:** "signal density", "surgical selection", "just in case".
- **Produces:** trimmed context — the extracted function/section, not the whole file; a one-line dep description, not full source.
- **Gotcha:** the "maybe useful" hesitation is itself the signal to leave it out. If the task genuinely needs whole-system understanding use `pyramid`; if relevance is unknown use `progressive-disclosure`.
- *Source: NoLiMa benchmark; Chroma Research.*

### context-budget
- **When:** designing an assembly layer whose inputs (docs, history, tool results) are variable and unbounded.
- **Triggers:** "token limit", "budget allocation", "headroom".
- **Produces:** explicit per-section token caps (system / docs / history / current turn) enforced at assembly time.
- **Gotcha:** ratios are workload-specific — tune them; without enforcement one section silently crowds out the rest. In this kit the phase×tier read-budget rule (if present) is the concrete ceiling.
- *Source: Anthropic — Effective Context Engineering for AI Agents.*

---

## degraded-session

The session has run long and output quality is visibly slipping.

### compress
- **When:** context crosses ~60-70% of the effective window, or quality degrades mid-session.
- **Triggers:** "summarize and restart", "compression threshold", "discard old".
- **Produces:** a structured (list / key-value, not narrative) state summary that becomes the new foundation.
- **Gotcha:** re-ground the summary against original sources or it amplifies `context-poisoning` instead of fixing rot.
- *Source: LangChain — Context Engineering for Agents.*

### context-rot
- **When:** justifying "don't just add more" or setting a working ceiling below the advertised window.
- **Triggers:** "effective window", "degradation with length".
- **Produces:** framing/justification only — it motivates the other patterns, no direct artifact.
- **Gotcha:** it is the diagnosis, not a fix; do not misread it as "context windows don't matter".
- *Source: NoLiMa benchmark; Lost in the Middle.*

### temporal-decay
- **When:** a long session spans several distinct topics and old turns crowd out current relevance.
- **Triggers:** "sliding window", "tiered context", "semantic recency".
- **Produces:** windowed / tiered context (recent verbatim, older summarized or dropped).
- **Gotcha:** wrong when old context is *more* important (an early-established constraint, an audit/legal sequence).
- *Source: LangChain — Memory concepts; Letta — Context-Bench.*

---

## persistence

Something must outlive the volatile window — a compaction, a handoff, or a new session.

### write-outside
- **When:** durable knowledge must survive past this session, or compression would otherwise lose it.
- **Triggers:** "external memory", "persistent notes", "across sessions".
- **Produces:** an external memory file / store updated incrementally and read back at session start.
- **Gotcha:** if the external store itself grows large it needs indexed search, not a flat read-in. Route the actual write to `mk:memory` — this skill only decides that a write is warranted.

### scratchpad
- **When:** a multi-step task (5-8+ turns) has intermediate decisions later steps depend on.
- **Triggers:** "working state", "current plan block", "decisions made".
- **Produces:** a structured state block (plan / findings / decisions / open-Qs) updated each turn, kept at a high-attention position.
- **Gotcha:** an unbounded scratchpad becomes its own rot source — cap its budget.
- *Source: ACE framework (arXiv); indexed experience-memory research.*

### context-handoff
- **When:** one agent's (or a human's) output becomes another's input across a boundary.
- **Triggers:** "handoff", "agent boundary", "dead ends".
- **Produces:** a structured brief — task + conclusions + what was ruled out (negative space).
- **Gotcha:** omitting the dead-ends makes the receiver re-explore paths already eliminated.
- *Source: Anthropic — Multi-Agent Research System; A2A protocol.*

---

## delegation

The work decomposes and a single window would bloat.

### isolate
- **When:** a task splits into independent subtasks and one agent's context would exceed ~32k effective tokens.
- **Triggers:** "sub-agent context", "orchestrator/worker", "clean context".
- **Produces:** an orchestrator (lean plan) + workers (focused slices) + an aggregation step.
- **Gotcha:** multiplies total token cost several-fold; wrong for heavily interdependent subtasks that need cross-reference.
- *Source: Anthropic — Multi-Agent Research System.*

### recursive-delegation
- **When:** scope is too large for even the orchestrator to survey upfront to plan the split.
- **Triggers:** "recursive spawn", "depth limit", "tree aggregation".
- **Produces:** a depth-capped agent tree, synthesized bottom-up.
- **Gotcha:** needs spawn + code-execution infra and adds a round-trip per level; wrong for interdependent work.
- *Source: recursive language-model research (arXiv, 2025).*

### context-handoff
- Same pattern as under [persistence](#persistence) — in delegation it is the brief passed *between* the orchestrator and workers. Load once.

---

## retrieval

Pulling external content in — make every retrieval a curation decision.

### retrieval-as-context
- **When:** a RAG pipeline dumps raw top-k chunks unranked into context.
- **Triggers:** "re-ranking", "cross-encoder", "retrieval budget".
- **Produces:** a curated top 3-5 re-ranked chunks with contextual metadata, ordered by task relevance.
- **Gotcha:** dumping all of top-k grounds the answer in noise as much as signal.
- *Source: Anthropic — Contextual Retrieval; Chroma Research.*

### progressive-disclosure
- **When:** relevance is unknown upfront (exploratory task, large codebase or doc set).
- **Triggers:** "index first", "file-tree map", "retrieve on demand".
- **Produces:** a two-phase flow — a compact overview turn, then targeted detail-retrieval turns.
- **Gotcha:** adds latency (multi-turn); useless if the index itself is too large. (This very index is the pattern applied.)
- *Source: Anthropic — Contextual Retrieval.*

### grounding
- **When:** a RAG answer must reflect the retrieved docs, not the model's training-data guesses.
- **Triggers:** "cite sources", "answer using ONLY the context".
- **Produces:** an anchoring instruction (+ optionally source-labeled chunks) → citation-grounded answers.
- **Gotcha:** retrieval alone doesn't guarantee use — without explicit anchoring the model still falls back to parametric knowledge.
- *Source: Anthropic — Contextual Retrieval.*

### context-caching
- **When:** a high-volume or repeated-call service re-sends the same system prompt / docs each request.
- **Triggers:** "prompt caching", "stable prefix", "cache hit".
- **Produces:** a reordered prompt (static first, dynamic last) so the prefix is cached and only the suffix is processed fresh.
- **Gotcha:** interleaving static and dynamic content breaks the cache boundary — order discipline is mandatory.
- *Source: Anthropic — Prompt Caching.*

---

## prompt-structure

Ordering, trust boundaries, and constraint style in the prompt itself.

### pyramid
- **When:** starting a task / conversation / system prompt where domain knowledge affects output.
- **Triggers:** "general to specific", "domain first", "altitude before landing".
- **Produces:** a prompt ordered role/constraints at top, task at bottom, specifics layered between.
- **Gotcha:** the common mistake is putting the role description *above* behavioral constraints — flip that; skip entirely for quick self-contained questions.
- *Source: Anthropic — Effective Context Engineering for AI Agents.*

### instruction-hierarchy
- **When:** context mixes trust levels (system / user / retrieved / tool output) or injection is a risk.
- **Triggers:** "prompt injection", "priority order", "delimiters".
- **Produces:** an explicit priority statement + delimiter-wrapped untrusted content.
- **Gotcha:** without reinforcement, later user/tool text overrides the system prompt through position and recency bias.
- *Source: OpenAI — The Instruction Hierarchy; Anthropic — system-prompt guidance.*

### negative-constraints
- **When:** a prompt has accumulated several "do not" instructions that could be positive actions.
- **Triggers:** "pink elephant", "hard stop vs shaping", "reframe".
- **Produces:** a rewrite — positive actions for behavioral shaping, negatives reserved for binary/safety hard stops.
- **Gotcha:** "don't X" activates attention on X and gives no forward path; it is the wrong tool for style/scope guidance.
- *Source: Anthropic — prompting best practices.*

### role-framing
- **When:** the default "helpful assistant" register/scope is wrong for a specialized use.
- **Triggers:** "domain vocabulary", "scope constraint", "functional identity".
- **Produces:** a role rewrite — functional identity + audience + domain constraints + scope boundary.
- **Gotcha:** vague roles ("expert", "helpful") add nothing; a role can fight `schema-steering` if both try to constrain output.
- *Source: Anthropic — prompting best practices; EMNLP 2024 persona research.*

---

## examples-tools

Few-shot examples, structured output, and tool selection.

### few-shot-selection
- **When:** a static example pool starts failing on inputs whose vocabulary/structure it doesn't match.
- **Triggers:** "dynamic few-shot", "example retrieval", "ordering".
- **Produces:** a per-query retrieved example set (top-N by similarity), the most-similar example placed last.
- **Gotcha:** static examples cap performance on heterogeneous inputs; ordering matters — best example goes last.
- *Source: few-shot selection research; serial-position-effect research (arXiv).*

### schema-steering
- **When:** unstructured output needs fragile parsing, or extraction/classification needs consistent fields.
- **Triggers:** "structured outputs", "enum constraint", "field descriptions".
- **Produces:** a JSON schema (typed fields, enums, descriptions) that drives both reasoning order and output shape.
- **Gotcha:** wrong for creative/open-ended tasks where structure constrains useful thinking; useless before the target shape is known.
- *Source: Anthropic — tool use; OpenAI — Structured Outputs.*

### tool-descriptions
- **When:** the model picks the wrong tool or wrong args in a multi-tool setup.
- **Triggers:** "tool selection failure", "usage boundary", "anti-trigger".
- **Produces:** a rewritten tool definition — name + scoped description (trigger + anti-trigger) + params + return description.
- **Gotcha:** omitting the "does NOT do X" boundary causes over-routing (e.g. a tool for math the model could do mentally).
- *Source: Anthropic — tool use; Anthropic — Effective Context Engineering.*

---

## multimodal

### multi-modal-context
- **When:** a pipeline sends multiple/repeated images and token cost or latency spikes.
- **Triggers:** "image tokens", "OCR extraction", "modality selection".
- **Produces:** a representation matched to task need — raw bytes vs caption vs structured (JSON) extraction.
- **Gotcha:** the wrong modality either wastes tokens (raw when extraction would do) or loses fidelity (extraction when spatial/visual reasoning is the point).
- *Source: Anthropic — vision docs; multimodal-RAG guidance.*

---

## critical-position

A key fact is present but the model keeps ignoring it.

### attention-anchoring
- **When:** a long context is unavoidable and one fact must not be lost in the middle.
- **Triggers:** "lost in the middle", "dual anchoring", "recency".
- **Produces:** reordered context with the key fact at the start and/or the recency-favored end.
- **Gotcha:** only works after noise is cut via `select`; can't help if the document order genuinely can't be rearranged.
- *Source: Lost in the Middle (arXiv); NoLiMa benchmark.*

### anchor-turn
- **When:** a long agentic session (10+ turns) repeatedly consults a known fixed set of source docs.
- **Triggers:** "anchor turn", "front-load reads", "stable cache prefix".
- **Produces:** a turn-1 consolidated summary that becomes the cached reference for all later turns.
- **Gotcha:** wrong for exploratory tasks where sources aren't known upfront; too-large source sets need per-cluster anchoring.
- *Source: Anthropic — Prompt Caching.*

---

## safety

A model-generated or retrieved claim risks being treated as verified truth.

### context-poisoning
- **When:** a multi-turn/agentic session may be building on an earlier unverified model claim (esp. past 5-8 turns).
- **Triggers:** "conversational inertia", "hallucination compounding", "propagation".
- **Produces:** a verification checkpoint re-reading source material, or a re-grounded compression summary.
- **Gotcha:** poisoning surfaces as independent-looking downstream errors — hard to trace to the origin turn.
- *Source: "How Contexts Fail" (Drew Breunig); conversational-inertia research (arXiv).*

### grounding
- Same pattern as under [retrieval](#retrieval) — in a safety framing it is the guard against parametric fallback. Load once.

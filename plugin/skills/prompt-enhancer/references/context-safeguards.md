# Context-Engineering Safeguards

> Loaded by `mk:prompt-enhancer` JIT — only when the input prompt shows
> long-horizon signals (>5 turns referenced, NOTES.md / plan files mentioned,
> ≥50KB of accumulated context, or the user explicitly asks about context-loss
> resilience).
>
> All six safeguards are **model-agnostic by construction**: Anthropic's own
> research (Effective Context Engineering for AI Agents) states context rot
> "emerges across all models" — architectural property of transformers, not a
> Claude artifact.

## Contents

1. [Right-altitude tone](#1-right-altitude-tone)
2. [Identifier-based context](#2-identifier-based-context)
3. [Long-horizon defenses](#3-long-horizon-defenses)
4. [Tool-result clearing](#4-tool-result-clearing)
5. [Bloat avoidance](#5-bloat-avoidance)
6. [Eval discipline](#6-eval-discipline)

---

## 1. Right-altitude tone

Specific enough to guide; flexible enough to allow heuristics.

- **Goal sentence:** one measurable outcome — not a paragraph, not a single verb.
  - Too brittle: "Edit lines 42–58 of src/auth.ts as follows: …" (over-specified hardcoding).
  - Too vague: "Improve auth." (under-specified; agent invents scope).
  - Right altitude: "Reduce p50 latency on `[FILL-IN: endpoint]` to under 200ms via caching, preserving response shape."
- **Context:** enough to ground; no full file dumps if a reference suffices.
- **Constraints:** hard limits only. Soft preferences belong nowhere — they create false acceptance criteria.

**Validation:** golden-rule clarity test (claude-prompting-best-practices "Be clear and direct"). If a colleague with no project context would be confused, the model will be too. Re-read before sending.

**Source:** ANT "anatomy" (system prompts); claude-prompting-best-practices; skill-authoring-guidelines (freedom-level matching).

---

## 2. Identifier-based context

CONTEXT carries paths and queries — never inline file bodies — unless the file
is small (<30 lines) and central to the ask.

Patterns:

- `src/api/products.ts:42` — line reference (universal across Claude/GPT/Codex/Gemini).
- `docs/project-context.md` — paged-in by the agent on demand.
- `[FILL-IN: <description> (suggested: <path>)]` — placeholder when the user can't supply the value (deep-mode adds the suggestion).

Inline content dumps cost tokens twice: once when read, once when echoed back
in a rewrite. Identifiers cost it once.

**Source:** ANT "retrieval" (just-in-time vs upfront); skill-authoring-guidelines (progressive disclosure); synthesis.

---

## 3. Long-horizon defenses

For tasks running >5 turns or >50KB of accumulated context.

| Defense | What it preserves | What it discards |
|---|---|---|
| **Compaction** — summarize prior turns into a 1–4KB summary; reinitialize | Architectural decisions, unresolved bugs, implementation invariants | Redundant tool outputs, intermediate scratch reasoning |
| **NOTES.md / plan file** — agent writes; harness re-injects on next turn | External persistent state | In-context reasoning lost on reset |
| **Sub-agent handoff** — delegate focused subtasks; receive 1–2KB distilled summaries | Lead-context lean; sub-agent's distilled return | Sub-agent's full exploration trace |

The skill **documents** these as safeguards. **Triggering** belongs to the
harness (`harness-rules.md` Rule 11 in the toolkit handles compaction-cache; the
prompting framework does not auto-compact).

When the input prompt mentions any of these mechanisms (or similar — "checkpoint", "resumable", "long task"), surface the relevant pattern as a recommendation in section 3 of the output.

**Source:** ANT "long-horizon" (compaction, structured note-taking, sub-agent architectures); CEG "States" (state buckets to preserve across turns).

---

## 4. Tool-result clearing

For agents with persistent message history: once a tool call is settled and the
next decision no longer needs the raw result, drop the result body. Keep the
call summary.

- Cuts attention budget by 30–60% on multi-tool sessions (ANT "long-horizon").
- Especially valuable for `Read` / `Grep` calls where the file content was already
  digested into a decision.

When the input prompt is itself a long agentic transcript, suggest tool-result
clearing as a CONSTRAINTS line: "After each tool call, summarize the result in
one line and drop the raw body from context."

**Source:** ANT "long-horizon" (Compaction → tool result clearing).

---

## 5. Bloat avoidance

Three named bloat sources:

- **Tool sets:** keep minimum viable. Remove tools whose use case is ambiguous (ANT "anatomy/tools": "if a human engineer can't definitively say which tool should be used, an AI agent can't be expected to do better").
- **System prompt:** load `docs/project-context.md` as on-demand context, not as a permanent system-prompt bullet list. The rewrite should reference, not inline.
- **CLAUDE.md / agent instructions:** keep evergreen; legacy notes go in a collapsed "old patterns" section (skill-authoring-guidelines). Time-sensitive content erodes signal-to-noise.

When the input prompt enumerates 10+ tools or contains a multi-paragraph block
of "always remember…" rules, flag bloat as detection #7 (laundry-list) and
suggest pruning to canonical examples.

**Source:** ANT "anatomy" (tools, system prompts); skill-authoring-guidelines (evergreen).

---

## 6. Eval discipline

Before authoring extensive instruction text, write 3+ canary scenarios with
gold-standard verdicts. Iterate on instructions, not on canaries.

Workflow:

1. Identify what the prompt should do (3+ representative cases).
2. Write expected outputs for each case (gold standard).
3. Run the draft prompt; diff actual vs expected.
4. Adjust instruction text. Canaries stay pinned.
5. After every model-tier change, replay canaries; flag drift >5% (rubric-rules.md Rule 6).

When the input prompt is itself a skill / system prompt / agent instruction set
(meta-prompting case), surface eval discipline as a CONSTRAINTS line: "Add 3+
canary scenarios with expected outputs before broadening this prompt."

**Source:** skill-authoring-guidelines (eval-driven authoring); rubric-rules.md Rule 6 (drift check on model upgrade); synthesis.

---

## When this file is loaded

Trigger conditions (any one):

- Input prompt length >5000 chars.
- Input mentions "long task", "checkpoint", "resumable", "compact", "session restart", "NOTES.md", "agentic loop", "multi-turn".
- Input enumerates 10+ tools or 5+ system-prompt rules (bloat signal).
- User explicitly asks about context-loss resilience.
- Detection items #7 (laundry-list), #8 (mixed instructions/data), #9 (wrong section ordering) all FOUND on the same input — indicates structural failure that warrants the full safeguard set.

### Precedence vs detections #7 / #8 / #9 (no double-firing)

A *single* detection (#7, #8, or #9 alone) fires only its own `playbook.md`
fix — the embedded CONSTRAINTS / fence / re-order line in the rewrite. It does
**not** pull in this file. This safeguards file loads only on the explicit
long-horizon signals above, OR when #7 **and** #8 **and** #9 fire together on
the same input (the structural-failure case). So a lone laundry-list (#7) does
not double-fire both the playbook fix and the full safeguard set — the playbook
fix handles it; the safeguard set is reserved for the long-horizon / structural
cases.

When triggered, the skill cites the relevant safeguard in section 3 of the
output and (when applicable) embeds the recommendation as a CONSTRAINTS line in
the rewritten prompt.

# Task-Type Recipes

> Loaded by `mk:prompt-enhancer` at Step 3 (Map) when the complexity classifier
> (`references/complexity-classifier.md`) matches a non-trivial type. Each recipe
> reshapes the EMPHASIS of the universal kernel sections — it never adds a role,
> never changes the kernel, and never performs the task the rewritten prompt asks
> for. All recipes are model-agnostic (no XML, no vendor token, no reasoning
> trigger); target-specific tuning is `references/target-notes.md` only.
>
> The architecture-review recipe has its own detailed file
> (`references/architecture-review-mode.md`) — this file covers the rest.

## Contents

1. [How a recipe works](#how-a-recipe-works)
2. [Recipe table](#recipe-table)
3. [Role boundary (hard)](#role-boundary-hard)
4. [Other shapes](#other-shapes)

---

## How a recipe works

A recipe is a per-type emphasis map over the five kernel sections (GOAL /
CONTEXT / CONSTRAINTS / ACCEPTANCE CRITERIA / OUTPUT FORMAT). It answers "which
section carries the weight for this task type, and what does the OUTPUT FORMAT
ask the downstream agent to produce". It preserves the user's core ask verbatim
and uses `[FILL-IN]` for anything the user did not state.

Simple-rewrite prompts use no recipe — minimal kernel only.

---

## Recipe table

| Type | Section emphasis (what to foreground) | Freedom | Must ask FOR (OUTPUT FORMAT) |
|---|---|---|---|
| **Coding implementation** | CONTEXT: affected files/modules; CONSTRAINTS: back-compat + forbidden deps; AC: binary + a verification command | MEDIUM | Modified files + 1-line rationale each; tests; run/verify command |
| **Code review** | GOAL: artifact + decision the review informs; CONSTRAINTS: review fences / non-goals | HIGH | Findings as `severity — claim (evidence: file/symbol)`; no code edits unless asked |
| **Research task** | GOAL: the question; CONTEXT: allowed sources; CONSTRAINTS: citation policy | HIGH | Answer + citations + confidence levels + conflicts + unresolved questions; data-first ordering |
| **Planning task** | GOAL: outcome; CONTEXT: current state; enforce "no implementation" when stated | MEDIUM | Phases + dependencies + risks + acceptance + non-goals |
| **Long-context analysis** | CONTEXT first (long data at top); GOAL/question LAST; source labels | HIGH | Locate/quote evidence before synthesis; compression policy for long input |
| **Migration task** | CONSTRAINTS: back-compat surface + untouchable contracts; AC: per-step verification | **LOW** | Ordered steps; preserve public contract; per-step verify command; rollback note |
| **Debugging task** | CONTEXT: symptom + repro + evidence; keep hypotheses AS hypotheses | MEDIUM | Symptom / repro / evidence / ranked hypotheses / non-goals / how to verify the fix |
| **Design / frontend task** | CONTEXT: audience + product context; CONSTRAINTS: visual + interaction states | MEDIUM | Components + interaction states + responsive/verification criteria |
| **Multi-agent / orchestration** | CONTEXT: work context + reports path; CONSTRAINTS: one owner per file | MEDIUM | Role split + file ownership globs + handoff format + integration check |

Freedom values reference `SKILL.md` "Freedom Level Auto-Suggestion" — the recipe
suggests, the user overrides.

---

## Role boundary (hard)

Every recipe reshapes a prompt that ASKS the downstream agent to do the work. The
enhancer itself must NEVER:

- emit a review finding, severity, or recommendation (that is `mk:review`);
- perform research, retrieval, or fetch a source (that is the downstream agent / `mk:scout`);
- assert a root cause for a bug (keep it a hypothesis to investigate);
- produce a plan's phases as if executing them (that is `mk:plan-creator`);
- write the design / code / copy the prompt requests.

Guarded by recipe canaries (architecture-review + research role-boundary, and the
new no-implementation / debugging-hypothesis canaries).

---

## Other shapes

Writing/report and image/design-generation prompts follow the same principle —
reshape emphasis, ask the downstream agent to produce the artifact, never produce
it here:

- **Writing / report:** GOAL: thesis + audience; CONSTRAINTS: tone + citation
  policy; OUTPUT FORMAT: structure + section order.
- **Image / design generation:** GOAL: subject; CONTEXT: style references;
  CONSTRAINTS: composition + aspect/size; OUTPUT FORMAT: iteration criteria.

If a type is unmatched, fall back to the plain universal kernel — do not invent a
recipe.

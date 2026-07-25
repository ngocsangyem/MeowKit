# Architecture-Review Recipe

> Loaded by `mk:prompt-enhancer` only when the input is an architecture-review
> request AND `--analyze --deep` is active. This is a **recipe**, not a flag —
> it reshapes the rewritten prompt's sections. It adds no new context reads
> beyond the existing `--deep` allow-list.

> **Role boundary (hard).** This recipe rewrites a draft prompt so that it ASKS
> for an architecture review. It does **not** perform the review, produce
> findings, score the design, or write an ADR. Producing findings is `mk:review`;
> ADRs are the `architect` agent. If the skill ever emits a finding, severity
> verdict, or recommendation of its own, that is a role-confusion bug
> (guarded by `eval/canary-11-architecture-review.md`).

## Contents

1. [When this recipe applies](#when-this-recipe-applies)
2. [How it reshapes the kernel](#how-it-reshapes-the-kernel)
3. [What it must NOT do](#what-it-must-not-do)

---

## When this recipe applies

All of:

- The draft prompt asks for an *assessment of an existing design* — phrases like
  "review the architecture of", "is this design sound", "evaluate the
  trade-offs in", "audit the structure of".
- `--analyze --deep` is set (the recipe layers on those modes; it has no flag).
- A draftable target exists (per the Step 0 route gate). "Review my architecture"
  with nothing attached → refuse/redirect per `SKILL.md`, same as any no-target input.

If the request is to *design* or *plan* rather than to *review*, this is not the
recipe — redirect (`mk:plan-creator` / `architect`).

## How it reshapes the kernel

Same universal kernel as every rewrite (`SKILL.md` Hard Constraints item 4).
Only the section *emphasis* changes:

- **GOAL:** one sentence naming the artifact under review and the decision the
  review must inform (e.g., "Assess whether `[FILL-IN: module]`'s boundaries
  support the planned multi-tenant split"). No invented scope.
- **CONTEXT:** prioritize, in order — ADRs, architecture docs, public interfaces
  / contracts, and stated constraints. Identifier-only (`--deep` surfaces these
  as `[FILL-IN: … (suggested: <path>)]`); never inline bodies. Long content
  first (Pyramid layering / attention-anchoring).
- **CONSTRAINTS:** the fences the review must respect — back-compat surface,
  untouchable contracts, non-goals. `[FILL-IN]` anything the user did not state.
- **ACCEPTANCE CRITERIA:** ask the reviewer for findings carrying **severity +
  evidence + decisions-needed** — e.g. `[ ] Each finding cites a file/symbol and
  a severity (blocker / major / minor)`, `[ ] Every blocker names the decision
  it forces`. These are asks ON the reviewer, not assertions by the skill.
- **OUTPUT FORMAT:** order the requested response **findings → trade-offs →
  recommendation**. Freedom level auto-suggests HIGH (judgment task); Verbosity
  `structured` (review, not implementation).

Use the optional architecture OUTPUT FORMAT block in `assets/output-template.md`.

## What it must NOT do

- Emit any finding, severity, trade-off, or recommendation of its own — it only
  rewrites the prompt that requests them.
- Read beyond the `--deep` allow-list, or inline code bodies.
- Add a flag, a new output section, or a handoff that auto-invokes `mk:review`.
  A handoff *suggestion* line (final line, analyze modes) is allowed and
  recommended; auto-invocation is not.
- Convert a "design this" / "plan this" request into a review — preserve the
  user's core ask verbatim.

# Design-System Rules & Library Patterns (gated)

> **Gate — load ONLY on explicit user intent** to generate design-system rules or discuss library-build
> architecture. Output is ADVISORY rule text only. This reference performs NO Figma writes; full library
> execution stays out of scope for `mk:figma`.

## Contents

- [Part A — Design-system rules generation](#part-a--design-system-rules-generation)
- [Part B — Library-build architecture lessons (future use)](#part-b--library-build-architecture-lessons-future-use)
- [Part C — Future split criteria](#part-c--future-split-criteria)

## Part A — Design-system rules generation

Generate project-specific agent rules from Figma + codebase conventions.

- Analyze the codebase's existing conventions (naming, token usage, component structure) first.
- Generate concise, actionable rule files — describe the convention and the "why", not a tutorial.
- Avoid bloat: one rule per convention; no restating what the model already knows.
- Apply progressive disclosure to the generated rules themselves (overview + linked detail), the same
  way skills are structured.
- Output is rule text for the user to review and adopt — never a Figma write.

## Part B — Library-build architecture lessons (future use)

Recorded for FUTURE reference. Building/updating a full Figma design-system library is OUT OF SCOPE to
execute here (a 20–100+ call workflow). If the toolkit ever supports it, these are the load-bearing patterns:

- **Multi-phase structure:** discovery → foundations → documentation → components → integration/QA.
- **Mandatory human checkpoints** between phases — never a one-shot build.
- **State ledger:** persist what has been created so a run can resume after interruption.
- **Plugin-data tagging:** tag self-created nodes so cleanup targets only verified artifacts.
- **Idempotent check-before-create helpers:** look up by name before creating to avoid duplicates.
- **No one-shot library generation:** the blast radius and long-run recovery needs require checkpoints.

## Part C — Future split criteria

Split `mk:figma` into a specialist skill only when ALL conditions for a candidate hold. Business
decision — the product owner makes the final call; an audit alone never triggers a split.

| Candidate | Split only when | Distinct because |
|---|---|---|
| `mk:figma-code-connect` | Repeated real user demand AND users hold eligible plans/seats (Org/Enterprise + Dev/Full); the gated reference proves insufficient (activation confusion or context bloat observed) | Entitlement model + codebase-mapping workflow |
| `mk:figma-write` | the toolkit decides canvas mutation is a first-class product capability, with checkpoint/state infrastructure; write requests recur in practice | Blast radius (mutates design files) |
| `mk:figma-library` | Long-running (20–100+ call) builds with state ledger/recovery are supported; real demand exists | Long-run state, cleanup, checkpoints |

Never split: blank-file creation (too narrow), design-system-rules generation (stays a reference),
implement-design (the core of `mk:figma`).

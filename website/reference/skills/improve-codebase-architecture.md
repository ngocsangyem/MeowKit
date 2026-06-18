---
title: "mk:improve-codebase-architecture"
description: "Review a codebase for deepening opportunities (shallow modules → deep), emit structured candidates for mk:preview to render, then grill a pick into a precise, type-safe patch. Analysis and patch emission only — no embedded rendering."
---

# mk:improve-codebase-architecture

## What This Skill Does

Surfaces architectural friction and proposes **deepening opportunities** — refactors that turn shallow modules into deep ones (small interface, large hidden implementation) for testability and AI-navigability. It owns three things only: **structural analysis**, **dependency mapping**, and **type-safe patch emission**. Every visual artifact — before/after diagrams, the candidate report, HTML — is delegated to `mk:preview`. The skill emits structured findings; `mk:preview` draws them.

Explicit invocation only — it never auto-activates.

## When to Use

- A codebase has accumulated shallow modules — interfaces nearly as wide as their implementations
- Understanding one concept requires bouncing between many small modules (no locality)
- Pure functions were extracted only for testability, while real bugs hide in how they're called
- You want a structured, reviewable set of refactor candidates before committing to one
- **NOT for:** rendering diagrams/HTML (see `mk:preview`); architecture trade-off deliberation (see `mk:party`); plan critique/scope review (see `mk:plan-ceo-review`); behavior-preserving cleanup of a known target (see `mk:simplify`)

## Core Capabilities

- **Explore for friction** — drives `mk:scout` to walk the codebase organically, not by rigid heuristics
- **Apply the deletion test** — would deleting a module concentrate complexity (it was shallow) or merely move it (it was load-bearing)?
- **Map dependencies** — classify each candidate's dependencies (`in-process` / `local-substitutable` / `ports-and-adapters` / `mock`) to determine how the deepened module is tested across its seam
- **Emit structured candidates** — one JSON object per candidate with before/after as *structural descriptors*, not pre-drawn diagrams
- **Type-safe patch emission** — precise multi-line edits with no `any`, no generic casts, zero new suppressions
- **Keep the domain model current** — new terms via `mk:project-context`; load-bearing rejections recorded as ADRs via the `architect` agent

## Architecture vocabulary

Every suggestion uses a fixed glossary — **module, interface, depth, seam, adapter, leverage, locality** — and never substitutes "component", "service", "API", or "boundary". Full definitions, the `dependency_category` taxonomy, and the replace-don't-layer testing strategy live in the skill's `references/deep-module-design.md`.

## Usage

```bash
/mk:improve-codebase-architecture          # review the current codebase for deepening opportunities
```

## Example Prompt

```
This module feels shallow — there are five small files I have to read just to
follow one order through intake. Review the architecture and show me what to deepen.
```

## Workflow phases

1. **Orient** — read `docs/project-context.md` and any ADRs under `docs/architecture/adr/` in the area (decisions not to re-litigate).
2. **Analyze** — `mk:scout` the codebase, apply the deletion test, write structured candidates to `tasks/architecture-review/<run-id>-candidates.json`. No concrete interfaces yet.
3. **Visualize (delegated)** — hand the findings file to `mk:preview --html --diagram`; it owns the before/after cards, badges, and browser-open mechanics.
4. **Select** — the single human gate: `AskUserQuestion` picks which candidate to explore (or none).
5. **Grill** — `mk:grill` walks the chosen candidate's design tree; `mk:party` optionally designs the interface twice.
6. **Patch** — emit precise multi-line edits, type-safe (no `any`, no generic casts); run the project's build/type-check after each.
7. **Sync** — record new domain terms (`mk:project-context`) and load-bearing rejections as ADRs (`architect` agent).

## Findings format

Each candidate is plain data — no markup — for `mk:preview` to render:

```json
{
  "id": "c1",
  "title": "Collapse the Order intake pipeline",
  "files": ["src/order/intake.ts", "src/order/validator.ts"],
  "problem": "Order intake module is shallow — interface nearly matches implementation.",
  "solution": "Absorb the validator and repo wrappers into one deep intake module.",
  "wins": ["locality: bugs concentrate in one module", "leverage: one interface, N call sites"],
  "recommendation": "Strong",
  "dependency_category": "in-process",
  "before": { "nodes": ["..."], "edges": [["..."]], "leaks": [["..."]] },
  "after": { "deep_module": "OrderIntake", "absorbed": ["..."], "interface": ["intake(order)"] },
  "adr_conflict": null
}
```

A `<run-id>-state.json` tracks metrics (candidates found, selected, patches emitted, type-check status) so long-horizon runs resume from disk instead of re-asking.

## Gotchas

- **Vocabulary drift is the #1 failure** — sliding into "component/service/API/boundary". A non-glossary noun is a defect; re-anchor before writing each candidate.
- **Do not re-implement `mk:preview`** — emitting a quick inline HTML report reintroduces duplication. Emit JSON, call `mk:preview`, stop.
- **Patches are multi-line exact** — a deepening that absorbs wrappers spans many lines; the edit target must match verbatim including indentation.
- **`any` / generic casts are blocked** — a failing type-check is the signal to fix the type, not suppress it.

## Composes With

- `mk:scout` — parallel exploration (phase 2)
- `mk:preview` — owns all rendering of the findings (phase 3); hard boundary
- `mk:grill` — interviews the chosen candidate's design (phase 5)
- `mk:party` — design-it-twice alternative interfaces (phase 5, optional)
- `mk:project-context` / `architect` agent — domain terms and ADRs (phase 7)

## Workflow Position

On-demand. Often run before `mk:plan-creator` to scope a refactor; `mk:cook` may execute the emitted patch as a planned change.

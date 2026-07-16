---
name: mk:brainstorming
preamble-tier: 3
version: 2.1.0
description: |
  Use when exploring technical solutions, comparing approaches, or generating
  alternatives for a validated problem. Triggers on "brainstorm solutions",
  "explore approaches", "compare options", "trade-off analysis", "how should
  we build". Do NOT use for product validation ("is this worth building?" →
  use mk:office-hours instead). Do NOT use when a plan already exists
  (→ use mk:plan-ceo-review or mk:elicit instead).
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
source: local
keywords:
  - brainstorm
  - explore-solutions
  - compare-approaches
  - trade-off-analysis
  - alternatives
  - solution-decompression
when_to_use: Use when exploring technical solutions or comparing approaches for a validated problem. NOT for product validation (see mk:office-hours) or after a plan exists (see mk:plan-ceo-review).
user-invocable: true
owner: research
criticality: medium
status: active
runtime: claude-code
---

# Brainstorming

Explore technical approaches with structured ideation, challenge, convergence, and plan-creator handoff.

**Differentiator:** office-hours = "should we build this?", brainstorming = "how should we build this?"

## When to Use

- Multiple architecturally-distinct approaches exist for a known requirement
- Trade-off analysis between candidate solutions is needed
- Novel problem with no obvious pattern in the codebase
- Pre-mortem / failure-mode exploration before committing to a design
- Constraint-rich problem (budget, time, stack) where the solution space is narrow

**NOT this skill if:** you are stuck on a specific existing approach with forced assumptions — use `mk:problem-solving`. **NOT this skill if:** you want to deepen an existing verdict or plan — use `mk:elicit`.

## When NOT to Use

| Situation                                             | Use instead                      |
| ----------------------------------------------------- | -------------------------------- |
| "Is this worth building?" — product validation        | `mk:office-hours`              |
| Plan already exists, want to challenge scope          | `mk:plan-ceo-review`           |
| Existing brainstorm, verdict, or plan needs deeper reasoning | `mk:elicit`              |
| Broad codebase inventory before planning              | `mk:scout`                     |
| High-stakes multi-perspective architecture debate      | `mk:party`                     |
| Bug investigation / root cause                        | `mk:investigate`               |
| Implementation detail (which library, which API call) | `mk:docs-finder` + just decide |

## Plan-First Gate

Brainstorming precedes planning — it produces input FOR plans.
Always skips Gate 1 (same as `mk:investigate` and `mk:office-hours`).

## Responsibilities

- Confirm the problem, binding constraint, success criterion, and excluded scope.
- When the input is itself a solution (preselected feature / "just build X" / roadmap item), decompress it to the underlying problem and ≥3 problem framings BEFORE ideating; redirect to `mk:office-hours` if the problem's value is unvalidated.
- Explore architecturally distinct technical approaches for a validated problem.
- Generate ideas first, then evaluate them separately.
- Run one anti-bias pivot and one challenge pass before recommending.
- Emit a compact report under `tasks/reports/` plus a handoff packet for `mk:plan-creator`.

## Non-Responsibilities

- Product validation (`mk:office-hours`)
- Broad codebase inventory (`mk:scout`)
- Multi-perspective debate (`mk:party`)
- Implementation plans and phase files (`mk:plan-creator`)
- Build, tests, edits, commits, or implementation (`mk:cook`)

## Arguments

- `--depth quick` — 3-8 ideas, no scoring (default)
- `--depth deep` — scored ideas + top 3 + optional plan-creator handoff
- `--technique [name]` — force a specific technique (default: auto-select)
- `--html` — after the markdown report is written, author a self-contained editorial HTML report beside it (opt-in; markdown stays source of truth)

## Lifecycle

Run these stages in order. This is outcome-oriented, not a command script.

1. **Entry routing** — redirect product validation, existing plans/verdicts, broad codebase discovery, debugging, and implementation requests to the adjacent skill.
2. **Problem understanding** — confirm the problem, binding constraint, success criterion, and excluded scope. Use `AskUserQuestion` if needed, capped at 3 questions per batch.
3. **Scope split** — if the request bundles 3+ independently-shippable concerns, ask the user to pick one concern or decompose before ideating.
4. **Optional scout bridge** — use `mk:scout` only when existing codebase touchpoints affect approach choice. Consume a 3-6 bullet summary, not a full scout report.
5. **Technique selection** — match problem type to one file in `references/techniques/`. When multiple match, prefer in this order: `multi-alternative` → `first-principles` → `reverse` → `constraint-mapping` → `scamper` → `analogical-thinking` → `perspective-shift`.
   - "How to build X" → `multi-alternative.md`
   - Input is itself a solution / "just build X" / preselected roadmap item → `solution-decompression.md` (run BEFORE idea generation; not a generation technique)
   - Novel problem, no existing pattern → `first-principles.md`
   - Debugging / preventing failures → `reverse.md`
   - Many constraints, narrow space → `constraint-mapping.md`
   - Improving / iterating an existing thing → `scamper.md`
   - Cross-domain transfer → `analogical-thinking.md`
   - Stakeholder / persona angles → `perspective-shift.md`
6. **Exploration** — generate 3-8 ideas. Do not score or compare while generating; the full set must exist before any ranking.
7. **Anti-bias pivot** — after idea #4 or midpoint, pause and ask: "what orthogonal category have I not touched yet?" Generate the rest from that angle. One pivot per session.
8. **Challenge pass** — before recommendation, load `references/challenge-pass.md`; check duplicate architectures, hard constraints, category diversity, conservative drift, and missing failure modes.
9. **Convergence** — recommend only after challenge. If top deep scores are within 2 points, ask for one tie-break criterion or mark "no clear winner."
10. **Output and handoff** —
   - `--depth quick` → `assets/output-ideas.md`
   - `--depth deep` → `assets/output-scored.md` (score via `references/scoring-criteria.md`)
   - Handoff packet shape → `assets/output-action-plan.md`

## Hard Stops

Stop and route or ask before continuing when:

- Product value or problem validity is unclear → `mk:office-hours`.
- Input is a solution and decompression shows its problem is unvalidated (evidence would be `none`/`weak`) → STOP, route to `mk:office-hours`. Do NOT grade evidence, run validation plans, or triage ideas inside brainstorming.
- A plan or verdict already exists → `mk:plan-ceo-review` or `mk:elicit`.
- The request has 3+ independently shippable concerns.
- Hard constraints conflict and no idea can satisfy them together.
- All ideas remain variants of one architecture after the pivot and one regeneration attempt.
- No selected idea, binding constraint, or success criterion exists for handoff.

**Behavioral hard rule (not hook-enforced — see `gate-rules.md` for actual gates):** brainstorming MUST NOT write code, create files outside `tasks/reports/`, or invoke implementation skills. Output is _ideas_, never _code_.

## Idea Format Template

Capture every idea with this shape — not bare table rows:

```
[#N] [Mnemonic Title]
  Concept: [2-3 sentence mechanism — what it is and how it works]
  Novelty: [What makes this non-obvious; why a senior eng wouldn't dismiss it]
```

The Novelty line is mandatory. If you cannot write one, the idea is a duplicate of a more obvious option — drop it and try another orthogonal angle.

## Anti-Rationalization

When tempted to skip discovery, scope, or the pivot — read `references/anti-rationalization.md`. It catalogs the common excuses and their counter-arguments.

## Discovery Protocol

Use `AskUserQuestion` to clarify, but cap at **3 questions per batch**. Avoid question fatigue.

Good clarifying questions target:

- The actual constraint that bounds the solution (budget, latency, team size, deadline)
- The success criteria (what does "good" look like once we ship?)
- What the user has already ruled out and why

Bad clarifying questions:

- Asking the user to design the solution ("would you prefer X or Y?")
- Asking for information already in the request
- Asking 5+ questions before generating any ideas

## Context Loading Rules

- Load only one technique file per run unless the challenge pass proves the technique is mismatched.
- Load `references/scoring-criteria.md` only in `--depth deep`.
- Load output templates only when writing the final report.
- Load `references/context-budget.md` when a run is becoming long or scout context is involved.
- Keep selected idea, key trade-offs, and relevant rejected alternatives. Drop exploratory dead ends.
- Never pass a full brainstorm transcript or full scout transcript downstream; pass report path + handoff packet.

## Gotchas (top 3)

- **Premature solutioning** — jumping to "how" before confirming "what". Force problem restatement first.
- **Anchoring on first idea** — generate ALL ideas before evaluating any. Score in a separate pass.
- **Context flooding** — max 8 ideas per run. If the problem needs more, run multiple focused sessions on sub-problems.
- **HTML drift** — `--html` is opt-in and derived from the markdown. Never edit the HTML by hand; re-run with `--html` so it stays in sync with the markdown source of truth.

Full list: `references/gotchas.md`
Edge cases (where the obvious approach is wrong): `references/edge-cases.md`
Challenge checks: `references/challenge-pass.md`
Context budget: `references/context-budget.md`
Final report self-check: `references/report-self-check.md`

## Workflow Integration

Phase 1 (Plan) — pre-planning. Runs after problem validation, before plan creation.

```
mk:office-hours (validate)
  ↓
mk:brainstorming (explore)
  ↓
mk:plan-creator (plan)
```

## Handoff Protocol

On completion:

- Output saved to `tasks/reports/`
- Include a `Brainstorm Handoff Packet` using `assets/output-action-plan.md`
- If `--depth deep`, ask before invoking or recommending `mk:plan-creator`
- `plan-creator` receives report path + handoff packet as pre-research input; it still owns requirements completeness, phase files, and plan approval
- **Terminal wiki handoff (advisory, fail-open):** after the markdown report is written, optionally hand it to the wiki per `.claude/skills/wiki/references/terminal-handoff-advisory.md`. Resolve the slug (env `MEOWKIT_WIKI_SLUG` → the sole `tasks/wikis/<slug>/wiki.json` → else skip + print the command). Advisory only — never blocks, never approves; do not add `wiki reindex`:

  ```bash
  npx mewkit wiki handoff propose \
    --skill mk:brainstorming \
    --from tasks/reports/brainstorm-<date>-<slug>.md \
    --slug <resolved-wiki-slug> \
    --explicit-intent
  ```

## HTML Output

When `--html` is passed:

- Write the markdown report FIRST (`tasks/reports/brainstorm-<date>-<slug>.md`), then author a sibling `tasks/reports/brainstorm-<date>-<slug>.html` — same directory and stem.
- Author the HTML inline using `references/editorial-html.md` as the visual contract. Do NOT route through `mk:preview` and do NOT invoke any implementation skill — this preserves the behavioral hard rule (no writes outside `tasks/reports/`).
- The HTML carries the SAME decision content as the markdown: problem, evidence, options, trade-offs, recommendation, risks, and unresolved questions. It is derived, never authoritative.
- Keep it self-contained: inline CSS/JS, no build step, no network requirement for layout (a web-font `@import` is the only permitted external request and must degrade to system fonts).
- `--html` is opt-in; without it, behavior is unchanged.

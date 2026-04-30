---
title: Rubric Library
description: How MeowKit grades builds — the 7 rubrics, composition presets, calibration discipline, and anti-slop anti-patterns.
---

# Rubric Library

## What Rubrics Do

Without rubrics, "is this build good?" is a vibes judgment. The evaluator agent would have no shared definition of "product-depth" or "design-quality" — and would drift toward leniency over a long session.

Rubrics turn subjective dimensions into **graded, weighted terms**. Each rubric defines a dimension (e.g., `functionality`), specifies what PASS / WARN / FAIL looks like with concrete anchor examples, and assigns a default weight. The evaluator loads a composition preset for the project type, grades each rubric independently, and the weighted scores combine into an overall verdict.

If any single rubric hits a hard-fail threshold, the entire sprint verdict is FAIL — no soft averaging covers a broken happy path.

## Anatomy of a Rubric

Every file in `.claude/rubrics/` follows `schema.md` and contains:

| Section | Purpose |
|---|---|
| YAML frontmatter | `name`, `version`, `weight_default`, `hard_fail_threshold`, `applies_to` |
| `## Intent` | Plain-language goal of the dimension |
| `## Criteria` | Bullet list of what the evaluator checks |
| `## Grading` | PASS / WARN / FAIL definitions |
| `## Anti-patterns` | Fixed list of auto-FAIL signatures (see below) |
| `## Few-Shot Examples` | ≥1 PASS anchor + ≥1 FAIL anchor with reasoning |

**Rule 1** (from `.claude/rules/rubric-rules.md`): every rubric must have at least one PASS and one FAIL anchor. A rubric with only PASS examples produces an evaluator that defaults to PASS. Balanced anchors force the model to discriminate.

**Rule 5** — position bias: anchor examples alternate PASS/FAIL by number (Example 1 = PASS, Example 2 = FAIL, ...). Models attend more to recent context; alternating order eliminates the position-bias signal.

## The 7 Core Rubrics

| Rubric | Default weight | Hard-fail | Applies to |
|---|---|---|---|
| `product-depth` | 0.25 | FAIL | frontend, backend, fullstack, cli |
| `functionality` | 0.25 | FAIL | all project types |
| `design-quality` | 0.15 | FAIL | frontend, fullstack |
| `originality` | 0.15 | FAIL | frontend, fullstack |
| `code-quality` | 0.10 | FAIL | all project types |
| `craft` | 0.05 | WARN | frontend, backend, fullstack, cli |
| `ux-usability` | 0.05 | WARN | frontend, fullstack, cli |

Total weights sum to 1.00 when all 7 are loaded (Rule 2 — weights must sum to 1.0 ± 0.01).

## Composition Presets

Presets assemble rubric subsets appropriate for the project type. Files live at `.claude/rubrics/composition-presets/`.

| Preset | Loads | Excludes | Use for |
|---|---|---|---|
| `frontend-app` (v2.0.0) | product-depth, functionality, design-quality, originality | code-quality, craft, ux-usability | SPAs, MPAs, framework apps |
| `backend-api` | product-depth, functionality, code-quality | design-quality, originality, craft, ux-usability | Headless APIs, services, workers |
| `cli-tool` | functionality, product-depth, code-quality, ux-usability | design-quality, originality, craft | CLI binaries, npm CLIs |
| `fullstack-product` | All 7 rubrics (ux-usability weighted 3×) | — | End-to-end product builds |

**Why `frontend-app` loads only 4 rubrics, not 7.** A necessity audit (Phase 2) found that `code-quality`, `craft`, and `ux-usability` overlap existing MeowKit layers — `mk:review`'s 5-dimension verdict, `security-rules.md`, and `mk:qa`'s health score. Loading duplicate rubrics doubles evaluator work without doubling signal. YAGNI. The 3 excluded rubrics are opt-in via custom presets when you need them (Rule 8).

## PASS / WARN / FAIL Anchors

Anchor examples are the highest-leverage part of a rubric. The evaluator reads them to ground its understanding of "what does a FAIL actually look like here?"

**Calibration discipline (Rule 4):**
- Fewer than 4 total anchors: ±1 imbalance is acceptable (e.g., 2 PASS + 1 FAIL)
- 4 or more anchors: exact PASS/FAIL parity required (2/2, 3/3, 4/4)

Research measured 40–60% positive bias inflation when evaluators saw only PASS examples. Balanced examples force discrimination.

**Position bias (Rule 5):** always alternate PASS/FAIL by example number. If FAIL always appears last, "FAIL" becomes the contextually primed answer for ambiguous cases.

## Hard-Fail Propagation

Any rubric returning a verdict at or above its `hard_fail_threshold` fails the **entire sprint** — regardless of other rubrics' scores.

Example: a build scores PASS on all rubrics but `functionality` returns FAIL. Weighted average might be 0.85 (which looks like a pass). Hard-fail semantics override the math: overall verdict is FAIL.

This prevents the evaluator from rationalizing unshippable output through arithmetic. A broken happy path is a broken product.

Rule 3: hard-fail propagates. Soft averages do not save weak dimensions.

## Calibration Set and Drift Check

`.claude/rubrics/calibration-set/` contains gold-standard verdicts — carefully labeled examples used to verify that the evaluator still grades consistently after a model upgrade.

**Rule 6:** when a new model tier ships (Sonnet 4.6, Opus 4.7, Haiku 5.x), replay the calibration set with the new model. Re-evaluator agreement with stored gold verdicts must stay within **5% per rubric**. If drift exceeds 5%, recalibrate the anchors or adjust the `hard_fail_threshold`.

Why this matters: anchor examples encode an assumption about how the model will interpret them. Model upgrades break that assumption silently. The drift check is the only mechanism that catches this before it affects production verdicts.

## Anti-Slop Anti-Patterns

`originality.md` and `design-quality.md` include fixed anti-pattern lists. These patterns auto-trigger FAIL regardless of how well the build scores on surrounding criteria (Rule 7). They are deterministic, not subjective.

**From `originality.md` anti-patterns:**
- Product name = literal feature description (`KanbanApp`, `NoteApp`, `ChatApp`)
- Hero copy: "The modern way to {feature}" / "Beautifully simple {noun}" / "Built for teams"
- unDraw / Storyset stock illustrations on empty states
- Stripe-clone homepage layout (centered hero, 3-column features, testimonials, CTA)
- Default or missing favicon
- "Built with love by the {ProductName} team" footer

These are the visual and textual signatures of AI slop — outputs that look like they could be any of 100 AI-generated SaaS apps. Encoding them as anti-patterns gives the evaluator a deterministic shortcut.

## Custom Rubrics

Users can add their own rubric files to `.claude/rubrics/` (Rule 9). Requirements:

1. Conform to `schema.md`
2. Run `validate-rubric.sh path/to/new-rubric.md` — enforces anchor balance, weight rules, and injection-safety checks
3. Reference the rubric from a composition preset (re-validate weight sum after adding)
4. Add a row to `RUBRICS_INDEX.md`

## Rubric Files Are DATA

Per `injection-rules.md`, rubric files are loaded as DATA by the evaluator — not instructions. The validator (`validate-rubric.sh`) rejects instruction-like patterns ("ignore previous instructions", "you are now") in rubric text (Rule 10).

A poisoned rubric could otherwise inject prompt overrides into the evaluator's context via the anchor-reasoning sections. The DATA boundary is non-negotiable.

## Canonical Sources

- `.claude/rubrics/` — all rubric files and composition presets
- `.claude/rubrics/RUBRICS_INDEX.md` — catalog with weights, hard-fail thresholds, applicability
- `.claude/rubrics/schema.md` — canonical rubric format spec
- `.claude/rules/rubric-rules.md` — the 10 rules governing rubric governance

## Related

- [/reference/skills/rubric](/reference/skills/rubric) — rubric skill (load/validate/compose)
- [/reference/skills/evaluate](/reference/skills/evaluate) — evaluator skill (grades the build)
- [/reference/agents/evaluator](/reference/agents/evaluator) — evaluator agent persona
- [/guide/harness-architecture](/guide/harness-architecture) — how rubrics fit the pipeline
- [/guide/trace-and-benchmark](/guide/trace-and-benchmark) — calibration replay automation
- [/reference/rules-index#rubric-rules](/reference/rules-index#rubric-rules) — all 10 rubric rules

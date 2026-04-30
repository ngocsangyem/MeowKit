# Calibration Guide — Adding Few-Shot Anchors to Rubrics

How to add high-quality PASS / FAIL anchor examples to a rubric without introducing evaluator bias.

## Contents

- [Why Calibration Matters](#why-calibration-matters)
- [The Three Rules](#the-three-rules)
  - [Rule 1: Balance PASS and FAIL counts](#rule-1-balance-pass-and-fail-counts)
  - [Rule 2: Randomize presentation order](#rule-2-randomize-presentation-order)
  - [Rule 3: Pull from real prior reviews when possible](#rule-3-pull-from-real-prior-reviews-when-possible)
- [Anchor Format](#anchor-format)
  - [Example {N} — {VERDICT}](#example-n-verdict)
- [Common Mistakes](#common-mistakes)
- [Re-Calibration Per Model Upgrade](#re-calibration-per-model-upgrade)
- [Adding a New Rubric — Checklist](#adding-a-new-rubric-checklist)


## Why Calibration Matters

Anchor examples are the **highest-leverage** part of a rubric. The model uses them to ground its understanding of "what PASS looks like vs FAIL looks like." Bad anchors produce bad evaluators in subtle, hard-to-debug ways:

- **Too few examples** → model defaults to its prior (usually too lenient)
- **Imbalanced PASS/FAIL** → positive bias (observed 40-60% inflation when only PASS examples shown; Anthropic harness research)
- **Sequential PASS-then-FAIL** → position bias (later examples weight more)
- **Synthetic examples only** → model grades against an idealized fiction, not reality

## The Three Rules

### Rule 1: Balance PASS and FAIL counts

**Why:** A rubric with 3 PASS examples and 1 FAIL example will produce an evaluator that thinks PASS is the default. Balance forces the model to discriminate, not assume.

**Enforcement (`validate-rubric.sh`):**
- If total anchors **< 4** → tolerance is `±1` (e.g., 1 PASS + 1 FAIL, 2 PASS + 1 FAIL, 1 PASS + 2 FAIL all pass)
- If total anchors **≥ 4** → exact equality required (2/2, 3/3, 4/4, …). 3/2 and 4/3 are rejected.

**Why two thresholds:** With 2-3 examples, ±1 leaves room for asymmetric edge cases (e.g., one canonical PASS + two distinct failure modes). With 4+ examples, the asymmetry becomes proportionally large enough to bias the evaluator (heuristic: ≥17% asymmetry inflates positive verdicts measurably). Exact equality at scale eliminates that drift.

**Practical:**
- 1 PASS + 1 FAIL → ✅
- 2 PASS + 1 FAIL → ✅ (total 3, within ±1)
- 2 PASS + 2 FAIL → ✅ (total 4, exact)
- 3 PASS + 2 FAIL → ❌ (total 5, must be exact)
- 3 PASS + 3 FAIL → ✅

### Rule 2: Randomize presentation order

**Why:** Models attend more to recent context. If FAIL is always last, FAIL becomes the "correct" answer in ambiguous cases. If PASS is always first, the opposite happens.

**Practical:** when you add examples to a rubric file, alternate PASS/FAIL by example number:
- Example 1 — PASS
- Example 2 — FAIL
- Example 3 — PASS
- Example 4 — FAIL

If you need to add a 5th example, it can break the alternation, but examples 1-4 must alternate.

### Rule 3: Pull from real prior reviews when possible

**Why:** Synthetic examples ("imagine a kanban app where...") are a lossy proxy for real failure modes. Real reviews capture concrete artifacts: actual screenshots, actual error messages, actual code snippets the evaluator can pattern-match.

**Practical sources:**
1. `tasks/reviews/*-verdict.md` from prior `/mk:review` runs
2. The Anthropic harness article appendix (RetroForge PASS, generic-SaaS-clone FAIL)
3. The Anthropic Labs blog screenshots
4. Anonymized internal QA failures

When pulling from real reviews, **sanitize**:
- Strip user names, emails, internal product names
- Replace company-specific URLs with `example.com`
- Remove any credentials, tokens, or environment-specific paths

If no real example exists, write a synthetic one and tag it `<!-- synthetic -->` so you can replace it later.

## Anchor Format

Every anchor MUST have:

```markdown
### Example {N} — {VERDICT}

**Artifact:** {what was reviewed — be concrete; describe the actual thing, not a category}
**Verdict:** PASS | WARN | FAIL
**Reasoning:** {explicit grading logic — quote the specific criteria the artifact violated or met}
```

**Concrete artifact descriptions** are critical. The artifact section should be specific enough that another reviewer could imagine the same thing:

- ❌ "A dashboard that looks generic"
- ✅ "Dashboard with purple→pink gradient hero, white cards floating on a gray background, Playfair Display headlines + Inter body, 11 distinct colors across the homepage"

## Common Mistakes

| Mistake | Why it's bad | Fix |
|---|---|---|
| All PASS examples are flagship products | Model thinks everything must be flagship | Mix in "competent but not flagship" PASS examples |
| FAIL examples are obvious disasters | Model thinks anything not-disaster is PASS | Include borderline FAILs that miss by one criterion |
| Reasoning is "vibes" ("feels generic") | Not testable; model can't pattern-match | Reasoning quotes specific criteria from the rubric |
| Examples drawn from one domain | Doesn't generalize | Mix domains: SaaS, indie, internal tools, consumer |

## Re-Calibration Per Model Upgrade

Per the dead-weight thesis: every harness component encodes assumptions that may stop holding after a model upgrade. Anchor examples are no exception.

When a new model tier is rolled out (Sonnet 4.6, Opus 4.7, etc.), re-run a calibration pass:

1. Take the rubric's existing anchors
2. Run them through the new model
3. Verify the model's verdict matches the anchor's stated verdict
4. If the model disagrees on >1 anchor, update the anchors (or downgrade the rubric's hard-fail threshold)

The Phase 8 benchmark suite (`mk:benchmark`) automates this — run after every model rollout.

## Adding a New Rubric — Checklist

- [ ] Frontmatter: `name`, `version`, `weight_default`, `applies_to`, `hard_fail_threshold`
- [ ] All 6 required sections present (Intent, Criteria, Grading, Anti-patterns, Few-Shot Examples; H1 title)
- [ ] ≥1 PASS anchor + ≥1 FAIL anchor, balanced ±1
- [ ] Anchors alternate PASS/FAIL where possible
- [ ] Anchors describe concrete artifacts, not categories
- [ ] Reasoning quotes specific criteria
- [ ] File ≤200 lines
- [ ] `validate-rubric.sh path/to/new-rubric.md` exits 0
- [ ] If used by a preset, add to the preset frontmatter and re-validate weight sum
- [ ] Add to `RUBRICS_INDEX.md`
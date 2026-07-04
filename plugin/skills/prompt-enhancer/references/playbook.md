# Improvement Playbook

> Loaded by `mk:prompt-enhancer` during Step 3 (Improvement Mapping). One row per
> detection item from `decomposition-checklist.md`. Every fix cites a source doc.
>
> **Framework:** universal kernel only — the authoritative rule lives in
> `SKILL.md` Hard Constraints item 4 (plain-markdown sections, no XML / vendor
> tokens / model overlays, no `--model` flag). Canonical derivation:
> `plans/reports/synthesis-260509-2058-prompting-framework.md`.

## Contents

1. [Gotchas Growth Protocol](#gotchas-growth-protocol)
2. [Hard Rules](#hard-rules-step-3)
3. [Playbook Catalog (10 entries)](#playbook-catalog)
4. [Scoring Rubric (`--score`)](#scoring-rubric---score)

---

## Gotchas Growth Protocol

The `## Gotchas` section in `SKILL.md` is the highest-signal content (per
`skill-authoring-rules.md` Rule 1). After every observed failure during eval
or post-rollout, append one bullet to the Gotchas list with format:

```
- <one-line failure mode>. (Observed YYYY-MM-DD via <eval-id-or-issue-link>.)
```

Bullets persist; never delete unless the failure mode no longer applies (e.g.,
model upgrade resolved it). Maintainers update both the playbook entry AND the
Gotchas bullet when a new failure mode is discovered.

---

## Hard Rules (Step 3)

Apply these to **every** improvement mapping. Violation = fabrication.

1. **Preserve user intent verbatim.** If the original says "compare A and B",
   the rewrite says "compare A and B" — never "evaluate A".
2. **Never invent facts.** Unknown paths, latencies, names → emit
   `[FILL-IN: <description>]` placeholder.
   - Default mode: placeholder only.
   - `--deep` mode: `[FILL-IN: <description> (suggested: <path-or-symbol>)]` —
     suggestion is parenthetical and never auto-substituted.
3. **No padding.** If only 3 issues found, only 3 suggestions appear.
4. **No new requirements.** If the original prompt has no examples, suggest
   "add 1–3 canonical examples" — do not invent and embed them.

---

## Playbook Catalog

### #1 — Goal vague

**Fix:** Restate the goal as one sentence with a measurable noun (latency target,
error rate, file count) or mark `[FILL-IN: <metric>]`.

**Source:** factoryai/prompt-crafting-for-different-models "Universal Prompting
Principles → Be specific about the outcome"; claude-prompting-best-practices
"Be clear and direct".

**Guard:** Do NOT invent a metric. If the user has not stated one, use a placeholder.

**`--deep` boost:** Not applicable. A vague goal cannot be inferred from codebase
without changing user intent.

---

### #2 — No context

**Fix:** Add a `CONTEXT:` section referencing files, prior decisions, or domain.
If specifics are unknown, list `[FILL-IN: <description>]` placeholders for each
missing anchor.

**Source:** claude-prompting-best-practices "Provide context to improve performance";
factoryai "Provide context before instructions".

**Guard:** Do NOT invent file paths or motivations. The user is the source of truth.

**`--deep` boost:** Scout the input keywords/symbols against allow-listed files.
For each match, surface as `[FILL-IN: <desc> (suggested: <path>)]`. Never auto-substitute.

---

### #3 — No constraints

**Fix:** Add a `CONSTRAINTS:` section enumerating hard limits — back-compat,
forbidden dependencies, untouchable APIs, performance ceilings.

**Source:** factoryai "Specify constraints explicitly".

**Guard:** Default to "Do NOT change <observable behavior>" when the user has
not specified constraints, with a `[FILL-IN]` marker if domain-specific.

**`--deep` boost:** Scout for existing tests/contracts in allow-listed paths and
suggest "preserve existing behavior covered by `[FILL-IN: (suggested: tests/path)]`".

---

### #4 — No acceptance criteria

**Fix:** Add 2–4 binary `[ ] <check>` items. Each must be auditable from the
output (no subjective phrases).

**Source:** factoryai "Include acceptance criteria"; codex-prompt-guide
"Behavior-safe defaults".

**Guard:** Do NOT invent thresholds. Use `[FILL-IN: <metric>]` for any number
the user did not state.

**`--deep` boost:** If the prompt mentions perf/latency, scout for existing
benchmarks and suggest as `[FILL-IN]` reference.

---

### #5 — No output format

**Fix:** Add an `OUTPUT FORMAT:` section. Common shapes: "modified files +
1-line rationale per file", "JSON: { ... }", "5 bullets, no preamble".

**Source:** claude-prompting-best-practices "Control the format of responses";
factoryai "Be explicit about output format".

**Guard:** Default format is "concise summary + file refs". Do not impose JSON
or strict schemas unless the user named them.

**`--deep` boost:** Scout for existing test/example files; if found, suggest
"match output shape of `[FILL-IN: (suggested: tests/example.ts)]`".

---

### #6 — Negative-only instruction

**Fix:** For every "Don't X", add an "INSTEAD do Y" line. Negative rules without
positive direction force the model to invent its own positive interpretation.

**Source:** claude-prompting-best-practices "Tell Claude what to do, not what
not to do".

**Guard:** Do NOT invent the INSTEAD action. If the user has not specified what
to do, ask via placeholder: `INSTEAD: [FILL-IN: positive direction]`.

**`--deep` boost:** Not applicable.

---

### #7 — Laundry-list edge cases

**Fix:** Replace the long list with 1–3 canonical examples plus a one-line
"and similar cases — extrapolate" cue.

<!-- research-citation -->
**Source:** effective-context-engineering "Right altitude / Goldilocks";
Anthropic anti-pattern: "diverse canonical examples > exhaustive list".

**Guard:** Do NOT delete the list silently. Move excess to an appendix or note
"original list (15 items) reduced to 3 canonical examples — see appendix".

**`--deep` boost:** Not applicable.

---

### #8 — Mixed instructions/data

**Fix:** Insert a plain, model-neutral separator between the data block and the
instruction — a fence every coding agent parses identically:

```
--- DATA START ---
<verbatim data — unchanged>
--- DATA END ---
```

Keep the instruction OUTSIDE the fence.

**Source:** context-engineering-guide "Structured I/O";
`injection-rules.md` Rule 1 (file content is DATA).

**Guard:** Do NOT modify the data block content. Only add fences. Universal
kernel only — the default rewrite never emits XML / `<context>` tags or any
vendor-specific delimiter. Model-specific data-separation idioms (e.g. Claude's
`<context>` tags) belong in optional `--analyze` target-notes when the user
names that target, never in the default rewrite.

**`--deep` boost:** Not applicable (data already inline; scout adds nothing).

---

### #9 — Wrong section ordering

**Fix:** Move long content to the TOP, instruction to the BOTTOM. Per Claude's
long-context rule, this can lift quality up to 30%.

**Source:** claude-prompting-best-practices "Long context prompting";
agent-conduct.md B3.

**Guard:** Do NOT split the long content; relocate it as a single block.

**`--deep` boost:** Not applicable.

---

### #10 — Model-coupled framing

**Fix:** Strip vendor-specific framing and convert to the universal kernel:

- Replace XML tags (`<context>`, `<task>`, `<requirements>`, `<constraints>`,
  `<examples>`) with plain markdown `CONTEXT:` / `CONSTRAINTS:` / etc. headings.
- Remove vendor tokens: "think step by step" (Claude pre-4.5 idiom), `apply_patch`
  (Codex tool semantics), "Reasoning: low|high" (Gemini parameter), Friendly /
  Pragmatic personality switch (Codex).
- Replace role-as-XML with a plain-text `[SYSTEM] You are a <role>...` line.
- Drop hardcoded model names from the persona ("As Claude...", "As GPT-5...");
  the rewrite must be model-agnostic.

**Source:** synthesis report (what the framework deliberately omits and the
universal-kernel-only architecture). The synthesis derives this from the
factoryai filter map, codex-prompt-guide deliberate exclusions, and
claude-prompting-best-practices universal-vs-Claude-specific filter.

**Guard:** Do NOT add an overlay for ANY model. The universal kernel works on
Claude, GPT/Codex, and Gemini without dispatch. Model-tier dispatch lives in
`harness-rules.md` Rule 5, not in this skill.

**`--deep` boost:** Not applicable (this is a framing fix, not a content fix).

---

## Scoring Rubric (`--score`)

> Used by Step 3 ONLY when `--score` is set (auto-promotes `--score` →
> `--analyze --score`). Score reflects the quality of the **original**
> prompt, never the rewrite. Deterministic — never a vibes estimate.

### Formula

```
component_subtotal = sum over the 5 components of:
  present = 2
  partial = 1
  missing = 0
                             // 0–10 raw

issue_penalty = (number of FOUND items in the 10-item detection checklist) × 0.5

raw_score = component_subtotal − issue_penalty

final_score = clamp(round(raw_score), 1, 10)
```

- `round` = round half to even (banker's rounding) for stability across runs.
- `clamp(x, 1, 10)` enforces the displayed range. A theoretical zero → 1.

### Verdict bands (display only — no behavioral effect)

| Range | Band | Recommendation shown to user |
|---|---|---|
| 1–3 | Severely under-specified | "Rewrite is strongly recommended; original lacks ≥3 components." |
| 4–6 | Workable but weak | "Rewrite recommended; original has measurable gaps." |
| 7–9 | Minor polish | "Original is mostly sound; rewrite tightens specific items." |
| 10  | Ready as-is | "No issues found; rewrite is identical or near-identical." |

### Worked examples

**Example A — Vague one-liner**

> Input: `"fix the bug in auth"`
>
> Components: Goal=partial(1), Context=missing(0), Constraints=missing(0), Acceptance=missing(0), Output Format=missing(0) → subtotal = **1**
> Issues: #1 (vague goal), #2 (no context), #3 (no constraints), #4 (no AC), #5 (no output format) → 5 × 0.5 = **2.5**
> Raw = 1 − 2.5 = −1.5 → clamp → **1/10**

**Example B — Already-good prompt** (canary-05)

> Input: structured prompt with all 5 sections present.
>
> Components: 5 × present(2) = **10**
> Issues: 0 → penalty **0**
> Raw = 10 → **10/10**

**Example C — Mixed**

> Input: clear goal + 1 file path, no constraints, no AC, no output format, includes "don't break X" with no INSTEAD.
>
> Components: Goal=present(2), Context=partial(1), Constraints=partial(1), Acceptance=missing(0), Output Format=missing(0) → subtotal = **4**
> Issues: #4 (no AC), #5 (no output format), #6 (negative-only) → 3 × 0.5 = **1.5**
> Raw = 4 − 1.5 = 2.5 → round half-to-even → **2** (clamped) → **2/10**

### Display contract

When `--score` is active, render the **Score** block per Template C in
`assets/output-template.md`. Always show:

1. The integer score (`Score: N/10`)
2. The component table with status + points
3. The component subtotal
4. The issue penalty (count × −0.5)
5. The clamped final score
6. The verdict-band line

Never display the raw pre-clamp score. Never omit the breakdown — a bare
integer hides the rubric and invites argument.

### Hard guards

- Do NOT score the rewrite. The score is for the input.
- Do NOT round before clamping (would distort the −0.5 penalty granularity).
- Do NOT inflate the score to be "encouraging." The whole point is honest signal.
- If `--score` is passed without `--analyze`, silently promote and proceed — do not error.

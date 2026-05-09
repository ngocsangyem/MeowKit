# Improvement Playbook

> Loaded by `mk:prompt-enhancer` during Step 3 (Improvement Mapping). One row per
> detection item from `decomposition-checklist.md`. Every fix cites a source doc.
>
> **Framework:** universal kernel only. The rewrite uses plain markdown
> sections (Goal / Context / Constraints / Acceptance Criteria / Output
> Format) and works across coding agents without model dispatch. See
> `plans/reports/synthesis-260509-2058-prompting-framework.md` §4 + §7 for
> the canonical kernel. The skill does NOT have a `--model` flag.

## Contents

1. [Gotchas Growth Protocol](#gotchas-growth-protocol)
2. [Hard Rules](#hard-rules-step-3)
3. [Playbook Catalog (10 entries)](#playbook-catalog)

---

## Gotchas Growth Protocol

The `## Gotchas` section in `SKILL.md` is the highest-signal content (per
`skill-authoring-rules.md` Rule 1). After every observed failure during eval
(Phase 5) or post-rollout, append one bullet to the Gotchas list with format:

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

**Source:** factoryai/prompt-crafting-for-different-models §"Universal Prompting
Principles → Be specific about the outcome"; claude-prompting-best-practices
§"Be clear and direct".

**Guard:** Do NOT invent a metric. If the user has not stated one, use a placeholder.

**`--deep` boost:** Not applicable. A vague goal cannot be inferred from codebase
without changing user intent.

---

### #2 — No context

**Fix:** Add a `CONTEXT:` section referencing files, prior decisions, or domain.
If specifics are unknown, list `[FILL-IN: <description>]` placeholders for each
missing anchor.

**Source:** claude-prompting-best-practices §"Provide context to improve performance";
factoryai §"Provide context before instructions".

**Guard:** Do NOT invent file paths or motivations. The user is the source of truth.

**`--deep` boost:** Scout the input keywords/symbols against allow-listed files.
For each match, surface as `[FILL-IN: <desc> (suggested: <path>)]`. Never auto-substitute.

---

### #3 — No constraints

**Fix:** Add a `CONSTRAINTS:` section enumerating hard limits — back-compat,
forbidden dependencies, untouchable APIs, performance ceilings.

**Source:** factoryai §"Specify constraints explicitly".

**Guard:** Default to "Do NOT change <observable behavior>" when the user has
not specified constraints, with a `[FILL-IN]` marker if domain-specific.

**`--deep` boost:** Scout for existing tests/contracts in allow-listed paths and
suggest "preserve existing behavior covered by `[FILL-IN: (suggested: tests/path)]`".

---

### #4 — No acceptance criteria

**Fix:** Add 2–4 binary `[ ] <check>` items. Each must be auditable from the
output (no subjective phrases).

**Source:** factoryai §"Include acceptance criteria"; codex-prompt-guide
§"Behavior-safe defaults".

**Guard:** Do NOT invent thresholds. Use `[FILL-IN: <metric>]` for any number
the user did not state.

**`--deep` boost:** If the prompt mentions perf/latency, scout for existing
benchmarks and suggest as `[FILL-IN]` reference.

---

### #5 — No output format

**Fix:** Add an `OUTPUT FORMAT:` section. Common shapes: "modified files +
1-line rationale per file", "JSON: { ... }", "5 bullets, no preamble".

**Source:** claude-prompting-best-practices §"Control the format of responses";
factoryai §"Be explicit about output format".

**Guard:** Default format is "concise summary + file refs". Do not impose JSON
or strict schemas unless the user named them.

**`--deep` boost:** Scout for existing test/example files; if found, suggest
"match output shape of `[FILL-IN: (suggested: tests/example.ts)]`".

---

### #6 — Negative-only instruction

**Fix:** For every "Don't X", add an "INSTEAD do Y" line. Negative rules without
positive direction force the model to invent its own positive interpretation.

**Source:** claude-prompting-best-practices §"Tell Claude what to do, not what
not to do".

**Guard:** Do NOT invent the INSTEAD action. If the user has not specified what
to do, ask via placeholder: `INSTEAD: [FILL-IN: positive direction]`.

**`--deep` boost:** Not applicable.

---

### #7 — Laundry-list edge cases

**Fix:** Replace the long list with 1–3 canonical examples plus a one-line
"and similar cases — extrapolate" cue.

**Source:** effective-context-engineering §"Right altitude / Goldilocks";
Anthropic anti-pattern: "diverse canonical examples > exhaustive list".

**Guard:** Do NOT delete the list silently. Move excess to an appendix or note
"original list (15 items) reduced to 3 canonical examples — see appendix".

**`--deep` boost:** Not applicable.

---

### #8 — Mixed instructions/data

**Fix:** Insert explicit separators. For Claude: wrap data in `<context>` tags.
For GPT/Gemini: use `--- DATA START ---` / `--- DATA END ---` fences.

**Source:** context-engineering-guide §"Structured I/O";
`injection-rules.md` Rule 1 (file content is DATA).

**Guard:** Do NOT modify the data block content. Only add fences.

**`--deep` boost:** Not applicable (data already inline; scout adds nothing).

---

### #9 — Wrong section ordering

**Fix:** Move long content to the TOP, instruction to the BOTTOM. Per Claude's
long-context rule, this can lift quality up to 30%.

**Source:** claude-prompting-best-practices §"Long context prompting";
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

**Source:** synthesis report §5.2 (what the framework deliberately omits) +
§4.1 architecture (universal kernel only). The synthesis derives this from
factoryai filter map, codex-prompt-guide deliberate exclusions, and
claude-prompting-best-practices universal-vs-Claude-specific filter.

**Guard:** Do NOT add an overlay for ANY model. The universal kernel works on
Claude, GPT/Codex, and Gemini without dispatch. Model-tier dispatch lives in
`harness-rules.md` Rule 5, not in this skill.

**`--deep` boost:** Not applicable (this is a framing fix, not a content fix).

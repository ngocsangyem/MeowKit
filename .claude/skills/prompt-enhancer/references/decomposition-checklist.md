# Decomposition Checklist

> Loaded by `mk:prompt-enhancer` during Steps 1 (Decomposition) and 2 (Weakness Detection).

## Contents

1. [The 5 Components](#the-5-components)
2. [The 10 Detection Items](#the-10-detection-items)
3. [Decomposition Heuristics](#decomposition-heuristics)
4. [Status Labels](#status-labels)

---

## The 5 Components

Decompose every input prompt onto these 5 components. Label each `present | partial | missing`.
This is read-only on the input — never rewrite during Step 1.

### 1. Goal

The single outcome the LLM must produce.

- **Presence cue:** A measurable noun + verb pair ("reduce p50 latency to 200ms",
  "add login endpoint", "summarize this PDF in 5 bullets").
- **Partiality cue:** Verb + object without metric ("fix the bug", "improve perf").
- **Missing cue:** No outcome at all ("here's the code, what do you think?").
- **Source:** factoryai/prompt-crafting-for-different-models §"Be specific about the outcome";
  claude-prompting-best-practices §"Be clear and direct".

### 2. Context

Background, code state, files, motivation. *Why* the request exists.

- **Presence cue:** A file path, system reference, prior decision, or domain hint.
- **Partiality cue:** Generic ("for our app") with no specifics.
- **Missing cue:** Action verb with no anchor ("delete the orphans", "refactor auth").
  This is a hallucination trigger — the model fills the gap.
- **Source:** claude-prompting-best-practices §"Provide context"; factoryai
  §"Provide context before instructions".

### 3. Constraints

What must NOT change. Hard limits, back-compat requirements, forbidden tools.

- **Presence cue:** "must not", "preserve", "keep", "do not break", "back-compat".
- **Partiality cue:** Soft preferences without hard limits ("ideally we'd keep").
- **Missing cue:** No mention of constraints at all.
- **Source:** factoryai §"Specify constraints explicitly".

### 4. Acceptance Criteria

Binary pass/fail definition of done. The user can audit the output against these.

- **Presence cue:** Checkable items ("p50 < 200ms", "all tests pass", "no new deps").
- **Partiality cue:** Subjective phrases ("looks clean", "feels right").
- **Missing cue:** No checkable items.
- **Source:** factoryai §"Include acceptance criteria"; codex-prompt-guide
  §"Behavior-safe defaults".

### 5. Output Format

The shape of the response. Files? PR? JSON? Section headers?

- **Presence cue:** Concrete shape ("respond as JSON", "produce a PR", "5 bullets").
- **Partiality cue:** Vague format ("nicely", "clearly").
- **Missing cue:** No format guidance.
- **Source:** claude-prompting-best-practices §"Control the format of responses";
  factoryai §"Be explicit about output format".

---

## The 10 Detection Items

Score the input against this fixed checklist. Each item is **binary** (FOUND / NOT FOUND).
Findings cite the exact text fragment from the input. No soft averaging.

| # | Issue | Detection cue | Source |
|---|---|---|---|
| 1 | **Goal vague** | No measurable noun in the outcome (verb-only: "fix", "improve") | factoryai §"Be specific"; claude §"Be clear and direct" |
| 2 | **No context** | No file path, system, or domain reference | claude §"Provide context"; effective-context-engineering §"Hallucination triggers" |
| 3 | **No constraints** | No "must not", "preserve", or back-compat mention | factoryai §"Specify constraints" |
| 4 | **No acceptance criteria** | No binary checkable item | factoryai §"Include acceptance criteria" |
| 5 | **No output format** | No file/PR/JSON/section shape specified | claude §"Control the format" |
| 6 | **Negative-only instruction** | "Don't X" with no INSTEAD | claude §"Tell Claude what to do" |
| 7 | **Laundry-list edge cases** | Long bulleted list of cases without canonical example | effective-context-engineering §"Right altitude"; Anthropic anti-pattern |
| 8 | **Mixed instructions/data** | No separator between context dump and command | context-engineering-guide §"Structured I/O"; injection-rules.md Rule 1 |
| 9 | **Wrong section ordering** | Long content placed <200 chars from end | claude §"Long context prompting" (up to 30% lift) |
| 10 | **Model-coupled framing** | Input prompt carries XML tags (`<context>`, `<task>`), role-as-XML wrapping, vendor tokens ("think step by step", `apply_patch`, "Reasoning: high"), or hardcoded model name in the persona | synthesis §3 (C2 role placement) + §5.2 (deliberate exclusions); factoryai filter map |

### Detection rules

- Each issue is BINARY. Output lists only the FOUND ones.
- Cite the exact text fragment that triggered the finding.
- False-positive guards (per item):
  - **#1** — "fix" combined with a file:line reference is NOT vague (the file pins scope).
  - **#2** — Pure-research prompts (no codebase target) are exempt.
  - **#7** — A list of ≥5 distinct cases triggers; <5 distinct cases does not.
  - **#9** — Applies only to inputs >800 chars total.
  - **#10** — Trigger only when the framing is one model's idiom (Claude-XML, Codex-`apply_patch`, Gemini-`Reasoning:`); a generic markdown role line ("You are a senior engineer") is NOT a violation.

---

## Decomposition Heuristics

Quick lookup for ambiguous cases:

- **Verb + object with no metric** → Goal partial.
- **No file path AND no system name** → Context missing.
- **"Make it better", "improve"** alone → Goal vague (#1).
- **"Don't break X" with no positive ask** → Negative-only (#6) AND constraint partial.
- **One-line prompt under 80 chars** → likely missing 3 of 5 components (Goal, Context, Output Format min).
- **Triple-quoted code block + question after** → Context present, decompose the question separately.
- **`@filepath` or `path:line` reference** → Context partially present (path only, no rationale).

---

## Status Labels

| Label | Meaning |
|---|---|
| `present` | Component appears explicitly with sufficient detail |
| `partial` | Component appears but lacks measurable detail |
| `missing` | Component absent — will trigger an item in the 10-detection checklist |

Output the decomposition as a 3-column table (Component / Status / Note) in Section 1
of the rendered output (per `assets/output-template.md`).

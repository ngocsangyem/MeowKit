---
title: "mk:prompt-enhancer"
description: "Refine a draft user prompt — default returns only the rewritten prompt. Pass --analyze to surface decomposition, 10-item weakness detection, and improvement notes. Pass --score (with --analyze) for a deterministic 1–10 quality score. Rewrite uses the universal kernel (plain markdown, no XML, no vendor tokens). Auto-suggests freedom level and verbosity. Optional --deep flag scouts allow-listed sources for [FILL-IN] placeholder candidates."
---

# mk:prompt-enhancer

## What This Skill Does

Takes a draft user prompt and emits a **mode-aware** markdown output:

- **Default** — the rewritten prompt only (Section 4). Decomposition and detection still run internally to feed the rewrite, but they are not displayed.
- **`--analyze`** — adds three analysis sections in front of the rewrite:
  1. **Decomposition** — maps the prompt onto five components (Goal / Context / Constraints / Acceptance Criteria / Output Format) labeled `present | partial | missing`.
  2. **Identified issues** — scores the input against a fixed 10-item weakness checklist; lists only FOUND issues, citing the exact text fragment that triggered each.
  3. **Improvement suggestions** — one fix per finding, drawn from a citation-grounded playbook.
- **`--analyze --score`** — inserts a `Score: N/10` block (deterministic rubric) between the suggestions and the rewrite.

The **Rewritten prompt** (Section 4 in every mode) is the universal kernel populated with the user's intent, plain markdown headings only, with auto-suggested **Freedom level** (`LOW` / `MEDIUM` / `HIGH`) and **Verbosity** (`terse` / `structured` / `confirmation`).

The rewrite is model-agnostic by construction. Works on Claude, GPT/Codex, and Gemini without dispatch.

## When to Use

- **You want a clean rewrite with no extra noise** — default mode emits only the enhanced prompt code block. Paste it straight into your coding agent.
- **You want to see WHY the prompt was rewritten** — pass `--analyze` for the full decomposition + detection + suggestions surface.
- **You want a numeric quality score on the original** — pass `--score` (auto-promotes to `--analyze --score`) for a deterministic 1–10 rating with rubric breakdown.
- **Prompt is coupled to one model's framing** — XML tags, role-as-XML, "think step by step", `apply_patch`, "Reasoning: high". Detection item `#10` flags model-coupling; the rewrite strips it.
- **Codebase-aware suggestions wanted** — pass `--deep` to scout allow-listed sources (`docs/project-context.md`, `CLAUDE.md`, repo file-tree paths, public docstrings) for `[FILL-IN]` placeholder candidates. Suggestions are parenthetical and never auto-substituted.

## When NOT to Use

| Need | Use this instead |
|---|---|
| Generate a prompt from scratch | `mk:brainstorming` (technical) / `mk:office-hours` (product) |
| Re-examine a code review or plan | `mk:elicit` |
| Build an implementation plan | `mk:plan-creator` |
| Audit running output of an LLM | `mk:evaluate` or `mk:review` |
| General codebase scouting | `mk:scout` directly |

## Usage

```bash
# Default — enhanced prompt only
/mk:prompt-enhancer <draft prompt text>

# Add full analysis (decomposition + detected issues + suggestions)
/mk:prompt-enhancer --analyze <draft prompt text>

# Add 1–10 quality score on the original prompt
/mk:prompt-enhancer --analyze --score <draft prompt text>

# --score alone is silently promoted to --analyze --score
/mk:prompt-enhancer --score <draft prompt text>

# Codebase-aware suggestions (any mode)
/mk:prompt-enhancer --deep <draft prompt text>
/mk:prompt-enhancer --analyze --score --deep <draft prompt text>

# Save to a custom path
/mk:prompt-enhancer --save-to <path> <draft prompt text>
```

**Argument hint:** `[prompt text] [--analyze] [--score] [--deep] [--save-to <path>]`

The skill **does not accept a `--model` flag.** Per the synthesis report (see source documents below), model detection violates the model-agnostic mandate; dispatch by model-tier lives in `harness-rules.md` Rule 5.

### Flag Matrix

| Flags | Output |
|---|---|
| (none) — **default** | Section 4 only — the **Enhanced Prompt** code block |
| `--analyze` | Sections 1, 2, 3, 4 (decomposition + issues + suggestions + rewrite) |
| `--analyze --score` | Sections 1, 2, 3 + **Score: N/10** block + Section 4 |
| `--score` (alone) | Auto-promoted to `--analyze --score` |
| `--deep` (any mode) | Appends "Suggested context" sub-block to Section 4 when scout returns ≥1 hit |

## Workflow

1. **Mode-Select** — honor `--deep` only when a git repo is available and `MEOWKIT_AUTOBUILD_MODE` is not `MINIMAL`. Otherwise downgrade to default with a one-line note.
2. **Decompose** — read-only on the input; label each of the 5 components.
3. **Detect** — score the 10-item binary checklist; cite the exact text fragment for every FOUND issue.
4. **Scout** *(when `--deep`)* — invoke `mk:scout` with allow-list filter; ≤8 files / ≤100 lines/file / ≤30s wall clock; default-deny against `.claude/memory/*`, `.env*`, `tasks/`, secrets.
5. **Map** — pick exactly one fix per FOUND issue from the playbook; preserve user intent verbatim; emit `[FILL-IN: <description>]` placeholders for unknown values.
6. **Rewrite** — populate the universal kernel; auto-suggest freedom level and verbosity; never apply model overlays.

## The 10 Detection Items

| # | Issue | Detection cue |
|---|---|---|
| 1 | Goal vague | No measurable noun in the outcome ("fix", "improve" alone) |
| 2 | No context | No file path, system, or domain reference |
| 3 | No constraints | No "must not", "preserve", or back-compat mention |
| 4 | No acceptance criteria | No binary checkable item |
| 5 | No output format | No file/PR/JSON/section shape |
| 6 | Negative-only instruction | "Don't X" with no INSTEAD |
| 7 | Laundry-list edge cases | Long bulleted list of cases (Anthropic anti-pattern) |
| 8 | Mixed instructions/data | No separator between context dump and command |
| 9 | Wrong section ordering | Long content placed within 200 chars of the end |
| 10 | Model-coupled framing | XML tags, vendor tokens, role-as-XML, hardcoded model names |

## Freedom Level Auto-Suggestion

The OUTPUT FORMAT section of the rewrite carries one of three modes:

| Detected signal | Suggested level | Rationale |
|---|---|---|
| Migration / destructive op / security fix / "do not deviate" | **LOW** | Fragile or sequenced — agent should follow exact procedure |
| Standard feature work, refactor with known pattern, bug fix | **MEDIUM** | Default — outcome-driven with back-compat fence |
| Open-ended exploration, design call, "explore" / "consider" verbs | **HIGH** | Judgment task — terse intent beats step-by-step |

Detection precedence: explicit user signal > destructive verbs > default to MEDIUM.

## `--deep` Mode

Bounded codebase scout. Surfaces `[FILL-IN]` candidates from allow-listed sources only.

| Aspect | Value |
|---|---|
| Allow-list | `docs/project-context.md`, `docs/*.md`, `CLAUDE.md`, `README.md`, top-level metadata (`package.json`, `pyproject.toml`, etc.), source files in `**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,kt,swift,vue}` |
| Forbid-list (default-deny) | `.claude/memory/*`, `.env*`, `tasks/`, `~/.ssh/`, `*.pem`, `*.key`, `*credentials*`, `*secret*`, anything matched by `.gitignore` |
| Hard caps | ≤8 files, ≤100 lines per file, ≤30 s wall clock |
| Output | Path + top-level symbol names + 1-line public docstring summary. **Never** the file body. |
| Substitution | Suggestions live inside `[FILL-IN: <desc> (suggested: <path>)]` brackets. Never auto-substituted — the user is the source of truth. |
| Fallback | `NO_GIT_REPO`, `MINIMAL_DENSITY`, `NO_MATCHES`, `SCOUT_BUDGET_EXCEEDED`, `SCOUT_BOUNDARY_VIOLATION` — each downgrades gracefully to default mode with a one-line note. |

The scout is enforced by `scripts/scout-context.py` — a stdlib-only Python script that walks the repo, filters by forbid-list first (default-deny), then allow-list. A failsafe scan of the output rejects any forbid-list path that leaks through.

## Output

Mode-aware. Three templates live in `assets/output-template.md`.

### Default mode — the rewrite only

```
[SYSTEM]
You are a senior <stack> engineer working in <project name>...

[USER]

GOAL: ...
CONTEXT: ...
CONSTRAINTS: ...
ACCEPTANCE CRITERIA: ...
OUTPUT FORMAT: ...
```

No headings, no preamble, no analysis. Optional `--deep` "Suggested context" sub-block may append after the code block.

### `--analyze` mode — full surface

```
# Prompt Enhancement — <YYYY-MM-DD HH:MM> [mode: analyze | analyze+deep]

## 1. Original Prompt Analysis        — 5-row table (Component / Status / Note)
## 2. Identified Issues                — only FOUND issues, with cited fragments
## 3. Improvement Suggestions          — one fix per finding, source-grounded
## 4. Enhanced Prompt                  — universal kernel, plain markdown
   ### Suggested context (--deep only) — [FILL-IN] candidates from scout
```

### `--analyze --score` mode

Identical to `--analyze`, with a `Score: N/10` block inserted between Section 3 and Section 4. Score reflects the **original** prompt's quality (the rewrite by construction scores 10/10 — that's not interesting).

```
## Score: <N>/10

| Component | Status | Points |
|---|---|---|
| Goal | <present|partial|missing> | <2|1|0> |
| Context | ... | ... |
| Constraints | ... | ... |
| Acceptance Criteria | ... | ... |
| Output Format | ... | ... |
| **Component subtotal** | | **<0–10>** |
| Issue penalty | <K> issues × −0.5 | **<−N.N>** |
| **Final (clamped 1–10)** | | **<N>/10** |

> Verdict band: 1–3 = severely under-specified · 4–6 = workable but rewrite recommended · 7–9 = minor polish · 10 = ready as-is.
```

Saved to `{plan-dir}/prompt-enhancer/<YYMMDD-HHMM>-<slug>.md` if an active plan is detected, otherwise `${CLAUDE_PLUGIN_DATA}/prompt-enhancer/...`. Never writes to the skill directory.

## Scoring Rubric (`--score`)

Deterministic — never a vibes-based estimate. Lives in `references/playbook.md`.

```
component_subtotal = sum over the 5 components of:
  present = 2
  partial = 1
  missing = 0                     // 0–10 raw

issue_penalty = (FOUND items in the 10-item detection checklist) × 0.5

raw_score   = component_subtotal − issue_penalty
final_score = clamp(round(raw_score), 1, 10)
```

`round` uses banker's rounding (round half to even) for stability across runs. `clamp(x, 1, 10)` enforces the displayed range — a theoretical zero rounds up to 1.

### Verdict bands

| Range | Band | Recommendation |
|---|---|---|
| 1–3 | Severely under-specified | Rewrite is strongly recommended; original lacks ≥3 components. |
| 4–6 | Workable but weak | Rewrite recommended; original has measurable gaps. |
| 7–9 | Minor polish | Original is mostly sound; rewrite tightens specific items. |
| 10  | Ready as-is | No issues found; rewrite is identical or near-identical. |

### Worked example

> Input: `"fix the bug in auth"`
>
> Components: Goal=partial(1), Context=missing(0), Constraints=missing(0), Acceptance=missing(0), Output Format=missing(0) → subtotal = **1**
> Issues: #1 (vague goal), #2 (no context), #3 (no constraints), #4 (no AC), #5 (no output format) → 5 × 0.5 = **2.5**
> Raw = 1 − 2.5 = −1.5 → clamp → **1/10**

The score reflects the **original** prompt, not the rewrite. The whole point is honest signal — the rubric never inflates to be "encouraging."

## Composition

- Hand off the rewritten prompt to `mk:plan-creator` for an implementation plan.
- Hand off the rewritten prompt to `mk:elicit` for second-pass reasoning (pre-mortem, red team, etc.).
- `--deep` invokes `mk:scout` internally with the allow-list filter.
- `docs/project-context.md` is consumed when present; produced by `mk:project-context`.

## Pro Tips

- **Default = paste-ready output.** Without flags, you get only the rewritten prompt code block — copy and ship. Reach for `--analyze` when you want to learn from the diagnostics, not every run.
- **`--score` is a calibration tool.** Run it occasionally on your own drafts to see which components you habitually skip. Most users discover they leave Acceptance Criteria and Output Format empty by default.
- **Score targets the original, not the rewrite.** The rewrite always scores 10/10 by construction — that's the whole point. The number tells you how bad the input was, not how good the skill is.
- **Use plain prose first, then run the enhancer.** A two-sentence draft is enough — the skill flags what is missing rather than asking you to fill in a form.
- **Take freedom level seriously.** A migration tagged `MEDIUM` becomes a rewrite invitation; a research task tagged `LOW` will fight the model. Override the suggestion if it does not match your intent.
- **`--deep` is opt-in for a reason.** Default mode is faster, deterministic, and codebase-independent. Reach for `--deep` only when the prompt targets the current repo and codebase context would materially improve specificity.
- **Strip vendor tokens before re-running.** If your draft already carries XML tags or "Reasoning: high", expect detection `#10` to flag them; the rewrite removes them automatically.

## Source Documents

The skill is grounded in seven prompting and context-engineering source documents:

- Anthropic prompting best practices (Claude 4.5–4.7)
- OpenAI Codex prompt guide
- FactoryAI universal prompting principles + per-model quick-reference
- Context engineering survey + Anthropic's "Effective context engineering for AI agents"
- Skill-authoring guidelines + lessons-build-skill

The synthesis distilled twelve shared principles across all sources, resolved four cross-source contradictions, and produced the universal kernel that the framework renders. The skill encodes that kernel verbatim.

> **Canonical source:** `.claude/skills/prompt-enhancer/SKILL.md`

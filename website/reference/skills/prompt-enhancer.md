---
title: "mk:prompt-enhancer"
description: "Refine a draft user prompt — decompose, detect 10 weakness patterns, emit a model-agnostic rewrite using the universal kernel (plain markdown, no XML, no vendor tokens). Auto-suggests freedom level and verbosity. Optional --deep flag scouts allow-listed sources for [FILL-IN] placeholder candidates."
---

# mk:prompt-enhancer

## What This Skill Does

Takes a draft user prompt as text input and emits a four-section markdown document:

1. **Decomposition** — maps the prompt onto five components (Goal / Context / Constraints / Acceptance Criteria / Output Format) and labels each `present | partial | missing`.
2. **Identified issues** — scores the input against a fixed 10-item weakness checklist; lists only FOUND issues, citing the exact text fragment that triggered each.
3. **Improvement suggestions** — one fix per finding, drawn from a citation-grounded playbook.
4. **Rewritten prompt** — the universal kernel populated with the user's intent, plain markdown headings only, with auto-suggested **Freedom level** (`LOW` / `MEDIUM` / `HIGH`) and **Verbosity** (`terse` / `structured` / `confirmation`).

The rewrite is model-agnostic by construction. Works on Claude, GPT/Codex, and Gemini without dispatch.

## When to Use

- **Draft prompt is ambiguous, missing context, or weakly structured** — the quickest way to spot what is missing before sending to a coding agent.
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
/mk:prompt-enhancer <draft prompt text>
/mk:prompt-enhancer --deep <draft prompt text>
/mk:prompt-enhancer --save-to <path> <draft prompt text>
```

The skill **does not accept a `--model` flag.** Per the synthesis report (see source documents below), model detection violates the model-agnostic mandate; dispatch by model-tier lives in `harness-rules.md` Rule 5.

## Workflow

1. **Mode-Select** — honor `--deep` only when a git repo is available and `MEOWKIT_HARNESS_MODE` is not `MINIMAL`. Otherwise downgrade to default with a one-line note.
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

A single markdown document with four fixed sections (see `assets/output-template.md`):

```
# Prompt Enhancement — <YYYY-MM-DD HH:MM> [mode: default|deep]

## 1. Original Prompt Analysis        — 5-row table (Component / Status / Note)
## 2. Identified Issues                — only FOUND issues, with cited fragments
## 3. Improvement Suggestions          — one fix per finding, source-grounded
## 4. Enhanced Prompt                  — universal kernel, plain markdown
   ### Suggested context (--deep only) — [FILL-IN] candidates from scout
```

Saved to `{plan-dir}/prompt-enhancer/<YYMMDD-HHMM>-<slug>.md` if an active plan is detected, otherwise `${CLAUDE_PLUGIN_DATA}/prompt-enhancer/...`. Never writes to the skill directory.

## Composition

- Hand off the rewritten prompt to `mk:plan-creator` for an implementation plan.
- Hand off the rewritten prompt to `mk:elicit` for second-pass reasoning (pre-mortem, red team, etc.).
- `--deep` invokes `mk:scout` internally with the allow-list filter.
- `docs/project-context.md` is consumed when present; produced by `mk:project-context`.

## Pro Tips

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

The synthesis distilled twelve shared principles across all sources, resolved four cross-source contradictions, and produced the universal kernel rendered in §7 of the framework. The skill encodes that kernel verbatim.

> **Canonical source:** `.claude/skills/prompt-enhancer/SKILL.md`

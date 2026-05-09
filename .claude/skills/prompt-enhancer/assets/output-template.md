<!-- Filled by mk:prompt-enhancer. Templates are mode-aware:
       (none)              → Template A: Enhanced Prompt only
       --analyze           → Template B: full analysis + rewrite (4 sections)
       --analyze --score   → Template C: full analysis + Score + rewrite
     `--score` alone is auto-promoted to `--analyze --score`.
     Output is the universal kernel — plain markdown only. No XML, no
     vendor tokens, no model overlays. Sections are fixed; do not reorder. -->

---

## Template A — Default (no flag)

> The DEFAULT mode emits ONLY the rewritten prompt code block. No headings,
> no preamble, no analysis. Optional `--deep` may append the "Suggested
> context" sub-block AFTER the code block.

```
[SYSTEM]
You are a senior <stack> engineer working in <project name>. Follow conventions
in CLAUDE.md and docs/project-context.md when present. Deliver working code by
default. For ambiguous gaps, use [FILL-IN: <description>] placeholders rather
than inventing values.

[USER]

GOAL: <one-sentence outcome with metric or scope>

CONTEXT:
- <file path with optional :line, e.g., src/auth/login.ts:45>
- <prior decision, ADR, or relevant docs/project-context.md section>
- <motivation: what problem this solves and for whom>

CONSTRAINTS:
- <what must NOT change>
- <forbidden deps / tools>
- <back-compat fences>

ACCEPTANCE CRITERIA:
- [ ] <binary check 1>
- [ ] <binary check 2>

OUTPUT FORMAT:
Freedom level: <LOW | MEDIUM | HIGH>  ← reason: <one-phrase justification>
Verbosity: <terse | structured | confirmation>
Shape:
- <e.g., "Modified files list with one-line rationale per file.">
- <e.g., "New tests under tests/path covering hit/miss/fallback.">
- <e.g., "No prose preamble — code first, summary last.">

EXAMPLES (optional):
- <few-shot input/output pairs only if user provided them or explicitly asked>
```

<!-- Sub-block only when --deep succeeded with ≥1 hit. Same in all modes. -->
### Suggested context (from --deep scout)

- `[FILL-IN: <description>]` → suggested: `<path-or-symbol>` (1-line public summary if available)
- ...

> Deep-mode footer: codebase snapshot `<git-sha>`; `docs/project-context.md` last updated `<YYYY-MM-DD>`.

---

## Template B — `--analyze`

# Prompt Enhancement — <YYYY-MM-DD HH:MM> [mode: analyze | analyze+deep]

## 1. Original Prompt Analysis

| Component | Status | Note |
|---|---|---|
| Goal | <present \| partial \| missing> | <one-line> |
| Context | <present \| partial \| missing> | <one-line> |
| Constraints | <present \| partial \| missing> | <one-line> |
| Acceptance Criteria | <present \| partial \| missing> | <one-line> |
| Output Format | <present \| partial \| missing> | <one-line> |

## 2. Identified Issues

1. **<issue name>** (#<checklist-id>) — "<exact fragment from input>"
2. ...

(List only FOUND issues. No padding. Cite the exact text fragment that triggered each.)

## 3. Improvement Suggestions

1. <one fix per finding, citing source doc per `references/playbook.md`>
2. ...

## 4. Enhanced Prompt

```
[SYSTEM]
You are a senior <stack> engineer working in <project name>. Follow conventions
in CLAUDE.md and docs/project-context.md when present. Deliver working code by
default. For ambiguous gaps, use [FILL-IN: <description>] placeholders rather
than inventing values.

[USER]

GOAL: <one-sentence outcome with metric or scope>

CONTEXT:
- <file path with optional :line>
- <prior decision, ADR, or relevant docs/project-context.md section>
- <motivation: what problem this solves and for whom>

CONSTRAINTS:
- <what must NOT change>
- <forbidden deps / tools>
- <back-compat fences>

ACCEPTANCE CRITERIA:
- [ ] <binary check 1>
- [ ] <binary check 2>

OUTPUT FORMAT:
Freedom level: <LOW | MEDIUM | HIGH>  ← reason: <one-phrase justification>
Verbosity: <terse | structured | confirmation>
Shape:
- <e.g., "Modified files list with one-line rationale per file.">
- <e.g., "New tests under tests/path covering hit/miss/fallback.">
- <e.g., "No prose preamble — code first, summary last.">

EXAMPLES (optional):
- <few-shot input/output pairs only if user provided them or explicitly asked>
```

> The rewrite uses the universal kernel only. No XML tags, no role-as-XML, no
> vendor-specific tokens. Works across coding agents (Claude, GPT/Codex,
> Gemini) without model dispatch.

<!-- Sub-block only when --deep succeeded with ≥1 hit -->
### Suggested context (from --deep scout)

- `[FILL-IN: <description>]` → suggested: `<path-or-symbol>` (1-line public summary if available)
- ...

> Deep-mode footer: codebase snapshot `<git-sha>`; `docs/project-context.md` last updated `<YYYY-MM-DD>`.

---

## Template C — `--analyze --score`

Identical to Template B, except a **Score** block is inserted between
Section 3 and Section 4. The score reflects the ORIGINAL prompt's quality,
NOT the rewrite. Formula lives in `references/playbook.md` Scoring Rubric.

# Prompt Enhancement — <YYYY-MM-DD HH:MM> [mode: analyze+score | analyze+score+deep]

## 1. Original Prompt Analysis

(same as Template B Section 1)

## 2. Identified Issues

(same as Template B Section 2)

## 3. Improvement Suggestions

(same as Template B Section 3)

## Score: <N>/10

| Component | Status | Points |
|---|---|---|
| Goal | <present \| partial \| missing> | <2 \| 1 \| 0> |
| Context | <present \| partial \| missing> | <2 \| 1 \| 0> |
| Constraints | <present \| partial \| missing> | <2 \| 1 \| 0> |
| Acceptance Criteria | <present \| partial \| missing> | <2 \| 1 \| 0> |
| Output Format | <present \| partial \| missing> | <2 \| 1 \| 0> |
| **Component subtotal** | | **<0–10>** |
| Issue penalty | <K> issues × −0.5 | **<−N.N>** |
| **Final (clamped 1–10, rounded to nearest int)** | | **<N>/10** |

> Verdict band: 1–3 = severely under-specified · 4–6 = workable but rewrite recommended · 7–9 = minor polish · 10 = ready as-is.

## 4. Enhanced Prompt

(same code-block as Template B Section 4)

<!-- Sub-block only when --deep succeeded with ≥1 hit -->
### Suggested context (from --deep scout)

- `[FILL-IN: <description>]` → suggested: `<path-or-symbol>` (1-line public summary if available)
- ...

> Deep-mode footer: codebase snapshot `<git-sha>`; `docs/project-context.md` last updated `<YYYY-MM-DD>`.

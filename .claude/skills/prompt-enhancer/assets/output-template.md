<!-- Filled by mk:prompt-enhancer. Sections fixed; do not reorder.
     Output is the universal kernel — plain markdown only. No XML, no
     vendor tokens, no model overlays. -->

# Prompt Enhancement — <YYYY-MM-DD HH:MM> [mode: default|deep]

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

> The rewrite uses the universal kernel only. No XML tags, no role-as-XML, no
> vendor-specific tokens. Works across coding agents (Claude, GPT/Codex,
> Gemini) without model dispatch.

<!-- Sub-block only when --deep succeeded with ≥1 hit -->
### Suggested context (from --deep scout)

- `[FILL-IN: <description>]` → suggested: `<path-or-symbol>` (1-line public summary if available)
- ...

> Deep-mode footer: codebase snapshot `<git-sha>`; `docs/project-context.md` last updated `<YYYY-MM-DD>`.

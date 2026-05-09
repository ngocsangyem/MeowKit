# Canary 4 — Strip model coupling

**Mode:** default
**Hard-fail dimensions:** Intent preservation; output is XML/vendor-token free

## Input

```
<context>
existing email/password form remains
file: src/auth/login.tsx
</context>
<task>
implement OAuth2 PKCE flow on the login page
</task>
<requirements>
- think step by step
- do not break the existing email/password flow
</requirements>

Reasoning: high
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | present (implement OAuth2 PKCE) |
| Context | present (file path, prior state) |
| Constraints | present (don't break existing flow) |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #4 No acceptance criteria
- #5 No output format
- #10 Model-coupled framing — three vendor signals:
  - XML tags (`<context>`, `<task>`, `<requirements>`) — Claude idiom
  - "think step by step" line — Claude pre-4.5 idiom
  - "Reasoning: high" line — Gemini parameter

### Improvement Suggestions

- Strip ALL XML tags; replace with plain markdown `CONTEXT:` / `CONSTRAINTS:` / etc.
- Remove "think step by step" line (Claude Opus 4.5+ self-calibrates; on Codex it's noise).
- Remove "Reasoning: high" line (Gemini-only token; ignored on other models).
- Add ACCEPTANCE CRITERIA per playbook #4.
- Add OUTPUT FORMAT per playbook #5 (auto-suggest MEDIUM freedom level for a feature add).

### Rewritten Prompt

The rewrite uses **plain markdown sections only**. The OUTPUT FORMAT section
auto-suggests `Freedom level: MEDIUM` (standard feature work) and
`Verbosity: terse` (implementation task, not review).

### HARD-FAIL conditions (any one → block)

- Output contains any XML tag (`<context>`, `<task>`, `<requirements>`, `<examples>`, etc.).
- Output contains "think step by step" / "Reasoning: low" / "Reasoning: high".
- Output applies a Claude / GPT / Gemini overlay (rewrite must be model-agnostic).
- Core ask changes — input says "implement OAuth2 PKCE flow on the login page";
  rewrite must preserve that verb + object verbatim.

### Why this canary matters

Verifies the v1.2 model-agnostic stance. The previous v1.1 skill applied
overlays via `--model claude`; v1.2 strips coupling instead. This canary
HARD-FAILS if any overlay leaks back in.

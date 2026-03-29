# Step 2: Parallel Review

Fan out 3 independent reviewers. Each receives different context to ensure diverse perspectives.

## Reviewers

### 1. Blind Hunter
**Prompt:** `prompts/blind-hunter.md`
**Receives:** ONLY the diff. No plan, no spec, no project context.
**Purpose:** Catch what's obviously wrong without bias from intent.

### 2. Edge Case Hunter
**Prompt:** `prompts/edge-case-hunter.md`
**Receives:** Diff + function signatures + type definitions.
**Purpose:** Exhaustively trace boundaries, nulls, error paths.

### 3. Criteria Auditor
**Prompt:** `prompts/criteria-auditor.md`
**Receives:** Diff + plan acceptance criteria.
**Purpose:** Verify every AC maps to implementation and is tested.
**Skip if:** No plan exists (code-only review).

## Execution

Run all 3 reviewers. Each produces a findings list in this format:

```
[SEVERITY] [FILE:LINE] [CATEGORY] [DESCRIPTION]
```

Severity: CRITICAL | MAJOR | MINOR
Category: bug | security | logic | boundary | coverage | naming | performance

## Output

Collect all findings from all 3 reviewers into a unified findings list.
Tag each finding with its source reviewer.

## Next

Read and follow `step-03-triage.md`

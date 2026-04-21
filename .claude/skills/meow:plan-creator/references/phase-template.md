# Phase File Template

Every phase file MUST contain these 12 sections in order. Use "N/A" for sections that don't apply.

## Contents

- [Context Links](#context-links)
- [Overview](#overview)
- [Key Insights](#key-insights)
- [Requirements](#requirements)
  - [Functional](#functional)
  - [Non-Functional](#non-functional)
- [Architecture](#architecture)
- [Related Code Files](#related-code-files)
  - [Files to Create](#files-to-create)
  - [Files to Modify](#files-to-modify)
  - [Files to Read (Context)](#files-to-read-context)
- [Implementation Steps](#implementation-steps)
- [Todo List](#todo-list)
- [Success Criteria](#success-criteria)
- [Risk Assessment](#risk-assessment)
- [Security Considerations](#security-considerations)
- [Next Steps](#next-steps)
- [Optional TDD Sections (when `tdd_mode = true`)](#optional-tdd-sections-when-tddmode-true)
- [Tests Before](#tests-before)
- [Refactor Opportunities](#refactor-opportunities)
- [Tests After](#tests-after)
- [Regression Gate](#regression-gate)
- [Rules](#rules)


```markdown
# Phase {N}: {Name}

## Context Links

- [Related report](../research/researcher-01-topic.md)
- [Related doc](../../../docs/relevant-doc.md)

## Overview

- **Priority:** P1 | P2 | P3
- **Status:** Pending
- **Effort:** ~Xh
- **Depends on:** Phase N (or "—" if independent)
- **Description:** {1-2 sentences}

## Key Insights

- {Finding from research, cite source: `(from: research/researcher-01-topic.md)`}
- {Critical consideration for this phase}

## Requirements

### Functional
1. {What the system must do}

### Non-Functional
- {Performance, security, compatibility constraints}

## Architecture

{Design, data flow, component interaction — ASCII diagrams or bullet descriptions}

## Related Code Files

### Files to Create
- `path/to/new-file.ts`

### Files to Modify
- `path/to/existing-file.ts` — {what to change}

### Files to Read (Context)
- `path/to/reference-file.ts` — {why read it}

## Implementation Steps

1. {Numbered, specific, file-referenced steps}
2. {Each step is actionable by a developer}

## Todo List

- [ ] {Checkbox item matching implementation steps}
- [ ] {These become Claude Tasks via hydration}

## Success Criteria

1. {Binary pass/fail check}
2. {Reference specific command or file to verify}

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| {risk description} | L/M/H | L/M/H | {mitigation strategy} |

## Security Considerations

- {Auth, data protection, injection concerns — or "N/A"}

## Next Steps

- {Dependencies on other phases}
- {Follow-up tasks deferred to future work}
```

## Optional TDD Sections (when `tdd_mode = true`)

When `--tdd` flag is set or `MEOWKIT_TDD=1` is active, append these after Implementation Steps:

```markdown
## Tests Before

- [ ] `test_name_here` — {assertion: what should fail and why}
- [ ] `test_name_here` — {assertion}

## Refactor Opportunities

- {What to clean up after tests pass — extract helpers, rename, simplify}

## Tests After

- [ ] `integration_test_name` — {cross-component or edge case test}

## Regression Gate

```bash
{specific test command to verify no regressions, e.g., npm test, pytest -x}
```
```

These sections are NOT added in default mode (12-section template remains unchanged).

## Rules

- Each phase file: ≤150 lines (≤180 with TDD sections)
- Sections can be brief but MUST exist (use "N/A" if not applicable)
- Key Insights MUST cite research source when available
- Todo checkboxes map 1:1 to implementation steps
- Success criteria must be verifiable (command to run or file to check)
- **Research linking (MANDATORY):** If `{plan-dir}/research/` has reports, Context Links MUST include links to relevant research reports. Step-03 verifies this after writing phase files.
- **Critical-step markers:** Todo items with high risk can be prefixed with `[CRITICAL]` or `[HIGH]` — these get their own Claude Tasks during hydration (step-08), enabling finer-grained tracking.
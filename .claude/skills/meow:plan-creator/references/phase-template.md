# Phase File Template

Every phase file MUST contain these 12 sections in order. Use "N/A" for sections that don't apply.

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

## Rules

- Each phase file: ≤150 lines
- Sections can be brief but MUST exist (use "N/A" if not applicable)
- Key Insights MUST cite research source when available
- Todo checkboxes map 1:1 to implementation steps
- Success criteria must be verifiable (command to run or file to check)
- **Research linking (MANDATORY):** If `{plan-dir}/research/` has reports, Context Links MUST include links to relevant research reports. Step-03 verifies this after writing phase files.
- **Critical-step markers:** Todo items with high risk can be prefixed with `[CRITICAL]` or `[HIGH]` — these get their own Claude Tasks during hydration (step-05), enabling finer-grained tracking.

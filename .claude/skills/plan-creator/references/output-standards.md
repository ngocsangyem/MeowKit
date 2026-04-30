# Plan Output Standards

## Required YAML Frontmatter
```yaml
title: [outcome-focused, not activity]
type: [feature | bug-fix | refactor | security]
status: [draft | approved | in-progress | done]
priority: [critical | high | medium | low]
effort: [xs | s | m | l | xl]
created: [YYMMDD]
model: [feature-model | bugfix-model | refactor-model | security-model]
```

## Required Body Sections
Every plan must have: Goal, Context, Scope (in/out), Constraints, Acceptance Criteria, Agent State.

## Quality Rules
- Goal: one sentence, outcome-focused ("Users can..." not "Implement...")
- Context: max 5 bullets (current state + problem)
- Acceptance criteria: binary checkboxes, no subjective terms
- Constraints: imperative ("Do NOT...", "MUST preserve...")
- Agent State: filled before saving, updated after each phase

## Phase File Frontmatter

Phase files (`phase-XX-*.md`) MUST begin with their own YAML frontmatter block. Schema:

| Field | Type | Allowed values | Default | Notes |
|-------|------|----------------|---------|-------|
| phase | int | ≥1 (max enforced by `step-03-draft-plan.md` §3d, currently 7) | filename-derived | required |
| title | string | — | heading-derived | required |
| status | enum | `pending \| active \| in_progress \| completed \| failed \| abandoned` | `pending` | NEVER `completed` at creation |
| priority | enum | `P1 \| P2 \| P3` | `P2` | phase-level priority — distinct from plan.md `critical/high/medium/low` |
| effort | string | `~Xh`, `Xh`, `Xd`, `?` | `?` | free-form duration |
| dependencies | int[] | phase numbers | `[]` | replaces "Depends on" prose |

**Source-of-truth contract:** the frontmatter is machine-readable truth. The `## Overview` block in markdown body is a human-readable MIRROR — sync-back regenerates the `**Status:**`, `**Priority:**`, `**Effort:**`, `**Depends on:**` lines from frontmatter on every cook finalize-step run.

**Anti-patterns (ALL forbidden):**
- `status: completed` at creation — breaks Gate 1 + cook re-hydration
- `status: unknown` written from frontmatter — `unknown` is a parser sentinel for parse failures only
- `status: draft` or `status: done` — not in the parser `PhaseStatus` union; normalizes to `unknown`
- Editing `**Status:**` in Overview prose directly — sync-back overwrites it; edit frontmatter instead
- Terminal states (`failed`, `abandoned`) — sync-back NEVER overwrites these; only a human edit moves out

See `phase-template.md` for the canonical block to prepend at file creation.

## Validation
Run `scripts/validate-plan.py <plan-file>` before presenting for Gate 1.
Output: PLAN_COMPLETE or PLAN_INCOMPLETE with missing items.

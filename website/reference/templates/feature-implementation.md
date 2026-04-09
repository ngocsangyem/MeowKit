# Feature Implementation Template

> Use when adding new functionality to the codebase.

**Primary agent:** planner → developer (in default mode) OR planner → tester → developer (in TDD mode `--tdd` / `MEOWKIT_TDD=1`)
**Workflow phases:** Phase 1 (Plan) → Phase 2 (Test — RED if `--tdd`, optional otherwise) → Phase 3 (Build) → Phase 4 (Review)
**Create with:** `npx mewkit task new --type feature "description"`

## When to use

- Adding a new API endpoint
- Building a new UI component
- Implementing a new business rule
- Adding a new integration

## Key sections

### User Story
Format: "As a [user type], I want [action], so that [outcome]."
Centers the implementation on user value.

### Technical Approach
Split into three sub-sections aligned with MeowKit phases:
- **Phase 2 — Test Plan:** Test cases (RED if `--tdd`, optional otherwise)
- **Phase 3 — Implementation Plan:** Numbered steps
- **Phase 4 — Review Checklist:** What reviewer checks

### API Changes (optional)
Document endpoint changes, interface changes, breaking changes.

## Agent behavior

1. Planner creates the task file, fills Goal + User Story + Technical Approach
2. Gate 1: Human approves the plan
3. **TDD mode (`--tdd`):** Tester writes failing tests (Phase 2). Default mode: skip Phase 2 unless requested.
4. Developer implements (Phase 3). In TDD mode, until failing tests pass.
5. Reviewer audits against Review Checklist (Phase 4)
6. Gate 2: Human approves the review

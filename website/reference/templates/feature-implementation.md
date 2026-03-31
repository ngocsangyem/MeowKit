# Feature Implementation Template

> Use when adding new functionality to the codebase.

**Primary agent:** planner → developer → tester
**Workflow phases:** Phase 1 (Plan) → Phase 2 (Test RED) → Phase 3 (Build GREEN) → Phase 4 (Review)
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
- **Phase 2 — Test Plan (RED):** Test cases to write before implementation
- **Phase 3 — Implementation Plan:** Numbered steps
- **Phase 4 — Review Checklist:** What reviewer checks

### API Changes (optional)
Document endpoint changes, interface changes, breaking changes.

## Agent behavior

1. Planner creates the task file, fills Goal + User Story + Technical Approach
2. Gate 1: Human approves the plan
3. Tester writes failing tests (Phase 2)
4. Developer implements until tests pass (Phase 3)
5. Reviewer audits against Review Checklist (Phase 4)
6. Gate 2: Human approves the review

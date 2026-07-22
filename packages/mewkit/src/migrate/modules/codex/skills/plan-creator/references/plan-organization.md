# Plan Organization

## Directory Structure
Every plan uses a directory (not a single file):
```
tasks/plans/YYMMDD-feature-name/
├── plan.md              ← main plan (under 80 lines)
├── reports/             ← scout + research reports
│   ├── scout-report.md
│   └── researcher-01-topic.md
├── phase-01-name.md     ← per phase (if multi-phase)
└── phase-02-name.md
```

## Naming Convention
- Date: YYMMDD format
- Slug: kebab-case, descriptive
- Example: `260328-add-oauth-authentication/`

## Plan Size Rules
- plan.md: under 80 lines (overview + status + links to phases)
- Phase files: under 150 lines each
- Research reports: under 100 lines each
- Move detailed context to reports/, not inline in plan.md

## Status Tracking
plan.md contains a status table linking to each phase:
| Phase | File | Status |
|-------|------|--------|
| 1. Setup | phase-01-setup.md | done |
| 2. Implement | phase-02-implement.md | in-progress |

# Task System

MeowKit uses structured task files to help AI agents work effectively. Every non-trivial change starts with a task file — a structured document that captures goal, scope, constraints, and acceptance criteria.

## Why task files?

AI agents lose context between sessions. A task file is a **self-contained state machine** that any agent can pick up and resume without prior knowledge.

Key benefits:
- **Resumability** — Agent State section tracks progress across context resets
- **Scope control** — Explicit in/out scope prevents feature creep
- **Quality gates** — Binary acceptance criteria prevent premature completion
- **Audit trail** — Every decision recorded in the file itself

## When to create a task file

**Non-trivial rule:** Create a task file for any change affecting more than 2 files OR taking more than 30 minutes.

```bash
npx mewkit task new --type feature "Add user authentication"
```

## Task lifecycle

```
draft → in-progress → blocked → review → done
```

| Status | Meaning |
|--------|---------|
| `draft` | Template filled, awaiting Gate 1 approval |
| `in-progress` | Implementation underway |
| `blocked` | Waiting on dependency or decision |
| `review` | Implementation complete, awaiting Gate 2 |
| `done` | All acceptance criteria verified |

## Directory structure

```
tasks/
├── templates/          # Template files (read-only)
│   ├── TEMPLATE-USAGE.md
│   ├── feature-implementation.md
│   ├── bug-fix.md
│   ├── refactor.md
│   ├── security-audit.md
│   └── guideline.md
├── plans/              # Plan directories (one per feature)
├── active/             # In-progress tasks
├── completed/          # Done tasks
├── backlog/            # Draft/future tasks
└── guidelines/         # Team standards
```

### Plan directory layout

Every plan uses a directory with reports subfolder:

```
tasks/plans/260328-add-auth/
├── plan.md                    # Main plan (under 80 lines)
├── reports/                   # Scout + research reports
│   ├── scout-report.md
│   └── researcher-01-oauth.md
├── phase-01-setup.md          # Per-phase details
└── phase-02-implement.md
```

Plan-creator validates plans via `scripts/validate-plan.py` before Gate 1 approval.

## Agent State section

Every template includes an Agent State section — the resumability mechanism:

```markdown
## Agent State
Current phase: Phase 3 — Build GREEN
Last action: Created auth middleware at src/middleware/auth.ts
Next action: Write integration tests for login endpoint
Blockers: none
Decisions made: Using JWT over sessions (stateless, scales better)
```

Agents update this section after each significant action. On resumption, the agent reads this first.

## Template types

| Type | Use when | Primary agent |
|------|----------|---------------|
| [Feature Implementation](/reference/templates/feature-implementation) | Adding new functionality | planner → developer |
| [Bug Fix](/reference/templates/bug-fix) | Fixing broken behavior | investigator → developer |
| [Refactor](/reference/templates/refactor) | Restructuring without behavior change | developer → reviewer |
| [Security Audit](/reference/templates/security-audit) | Security review | security agent |
| [Guideline](/reference/templates/) | Team standards document | documenter |

See [Template Reference](/reference/templates/) for detailed documentation.

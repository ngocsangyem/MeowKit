# Business Workflow Patterns in MeowKit

Domain content stripped. Universal operating patterns kept.

## New Skill

### mk:decision-framework

Structure expert judgment for recurring high-stakes decisions.

**Use when:** building operations systems, triage logic, case management, billing ops, support workflows, escalation protocols.

**Provides:** classification taxonomy, sequential decision rules, weighted scoring, escalation protocols, communication templates, edge case discovery.

**Invoke:** `/mk:decision-framework` or auto-suggested by mk:plan-creator for ops tasks.

## Reference Merges

### RCA Method Selection → mk:investigate

Extends debugging with structured methodology: 5 Whys, Ishikawa, 8D, Fault Tree.

**Auto-loaded:** mk:investigate step 3 for recurring patterns.
**Files:** `references/rca-method-selection.md`, `references/rca-anti-patterns.md`

### Ops Metrics Design → mk:plan-creator

Outcome-focused metric philosophy: targets from reality, red flags, lag vs lead.

**Auto-loaded:** mk:plan-creator for metrics/KPI/dashboard tasks.
**File:** `references/ops-metrics-design.md`

### Cold-Start Context Briefs → mk:plan-creator

Self-contained phase files so fresh agents execute any step cold.

**Auto-loaded:** mk:plan-creator during plan drafting.
**File:** `references/cold-start-context-brief.md`

### Plan Mutation Protocol → mk:plan-creator

Formal rules for split/insert/skip/reorder/abandon plan steps.

**Auto-loaded:** mk:plan-creator when modifying plans.
**File:** `references/plan-mutation-protocol.md`

### Browser QA Checklist → mk:qa

4-phase testing: smoke → interaction → visual regression → accessibility.

**Auto-loaded:** mk:qa for web app testing.
**File:** `references/browser-qa-checklist.md`

### Token Budget Levels → mk:agent-detector

Response depth: Essential (25%) / Moderate (50%) / Detailed (75%) / Exhaustive (100%).

**Auto-detected:** from user signals. Silent by default.
**File:** `references/token-budget-levels.md`

### Product Lens Modes → mk:office-hours

Founder Review (PMF scoring) + User Journey Audit (friction mapping).

**Auto-loaded:** mk:office-hours mode selection.
**File:** `references/product-lens-modes.md`

### TS/JS Review Checklist → mk:typescript

Prioritized checklist: CRITICAL (security) → HIGH (types, async) → MEDIUM (React, perf).

**Auto-loaded:** mk:review for .ts/.tsx diffs.
**File:** `references/review-checklist.md`

### Loop Safety Protocol → mk:cook

Stall detection, cost drift, escalation triggers for iterative cycles.

**Auto-loaded:** mk:cook during build-test-fix loops.
**File:** `references/loop-safety-protocol.md`

### Iterative Evaluation → mk:review

Multi-pass review for high-stakes code (payments, auth, security).

**Auto-loaded:** mk:review with `--iterative` or high-stakes detection.
**File:** `references/iterative-evaluation-protocol.md`

### Anti-Slop Directives → mk:frontend-design

Avoid AI-generated UI clichés. Specific patterns to avoid and use instead.

**Auto-loaded:** mk:frontend-design during UI work.
**File:** `references/anti-slop-directives.md`

### E2E Best Practices → mk:testing

Agent Browser preference, POM, flaky quarantine, success metrics.

**Auto-loaded:** mk:testing for E2E test creation.
**File:** `references/e2e-best-practices.md`

## When to Use

| Trigger                                  | Where                                           |
| ---------------------------------------- | ----------------------------------------------- |
| "How should we handle X cases?"          | mk:decision-framework                         |
| "What should I measure?"                 | mk:plan-creator → ops-metrics-design.md       |
| "Why does this keep happening?"          | mk:investigate → rca-method-selection.md      |
| Multi-session plan with cold-start steps | mk:plan-creator → cold-start-context-brief.md |
| Modifying an existing plan               | mk:plan-creator → plan-mutation-protocol.md   |
| QA testing a web app                     | mk:qa → browser-qa-checklist.md               |
| "brief" / "detailed" / "exhaustive"      | mk:agent-detector → token-budget-levels.md    |
| "Is this product working?"               | mk:office-hours → product-lens-modes.md       |
| Review TypeScript code                   | mk:typescript → review-checklist.md           |
| Iterative build-test-fix cycle           | mk:cook → loop-safety-protocol.md             |
| High-stakes code review                  | mk:review → iterative-evaluation-protocol.md  |
| Frontend UI implementation               | mk:frontend-design → anti-slop-directives.md  |
| Write E2E tests                          | mk:testing → e2e-best-practices.md            |

## New Skills

| Skill                   | Purpose                           | Phase                |
| ----------------------- | --------------------------------- | -------------------- |
| mk:decision-framework | Operational decision architecture | 1 (Plan)             |
| mk:verify             | Unified verification loop         | 3→4 transition       |
| mk:api-design         | REST/GraphQL patterns             | 1 (Plan)             |
| mk:build-fix          | Build error triage                | 3 (Build)            |
| mk:database           | Schema, migrations, queries       | 1 (Plan) / 3 (Build) |

## Origin

Adapted from Everything Claude Code (ECC).

- 19 business workflow skills → 5 transferable patterns
- 5 specialist skills → 4 reference merges (blueprint, browser-qa, token-budget-advisor, product-lens)
- 7 agent patterns → 5 reference merges (typescript-reviewer, loop-operator, planner, GAN agents, e2e-runner)
- 1 skipped: autonomous-agent-harness (not needed now)

---
contract_schema_version: 1.0.0
task: {slug — kebab-case task identifier}
sprint: {N — integer, monotonically increasing per task}
plan_ref: tasks/plans/{plan-dir}/plan.md
rubric_preset: frontend-app | backend-api | cli-tool | fullstack-product
status: draft | negotiating | signed | amended | closed
generator_signed: null
evaluator_signed: null
rounds: 0
created: {YYMMDD-HHMM}
---

<!--
SPRINT CONTRACT — file-based negotiation between generator and evaluator.

This is a TESTABLE TRANSLATION of the product-level spec. The product spec
says "user can delete entity"; the contract says exactly which keys, mouse
clicks, HTTP methods, and DOM/state assertions verify it.

Forbidden in this file:
- Code (TypeScript, Python, etc.)
- File paths to source files (the generator picks those)
- Implementation details ("use a Map<string, Entity>")
- Vague criteria ("UI should look good", "performance should be acceptable")

Required:
- Every AC has Given/When/Then form OR explicit assertion
- Every AC has a Verification line (how the evaluator will probe it)
- Every AC has a Rubric tie-in citing one rubric from the active preset
- 5–15 ACs per sprint (validator warns at >20)

The `contract_schema_version: 1.0.0` line MUST be the first frontmatter
field — `mk:evaluate/step-01-load-rubrics.md` stub-guards on this marker
to distinguish a real Phase 4 contract from stale pre-Phase-4 files.
-->

# Sprint {N} Contract — {Task Title}

## Scope (In)

What WILL be built this sprint. Be specific.

- {Feature / component being built}
- {Another feature}

## Scope (Out)

What will explicitly NOT be built this sprint. The generator MUST NOT add these even if "it's easy."

- {Anti-feature 1}
- {Anti-feature 2}

## Acceptance Criteria

Each criterion is testable. Format: `Given X / When Y / Then Z` OR explicit assertion.

### [AC-01] {Short title}

**Given** {precondition state}
**When** {user action or system event}
**Then** {observable, testable outcome}

- **Verification:** {how the evaluator will probe — Playwright drag, curl + jq assertion, CLI invocation, etc.}
- **Rubric tie-in:** {rubric-name} (weight {N})

### [AC-02] {Short title}

**Given** {...}
**When** {...}
**Then** {...}

- **Verification:** {...}
- **Rubric tie-in:** {...}

<!-- Continue 3, 4, 5... — minimum 5, target 5–15, validator warns at >20 -->

## Out-of-Scope Clarifications

Things the generator MUST NOT add even if tempted:

- {Specific anti-feature 1 with rationale}
- {Specific anti-feature 2 with rationale}

## Rubric Bindings

Map ACs to the rubrics they cover. Every rubric in the active preset SHOULD have at least one AC binding (otherwise the rubric won't be exercised).

- product-depth: covered by AC-01, AC-03
- functionality: AC-01, AC-02, AC-04
- design-quality: AC-05
- originality: AC-06

## Negotiation Log

- Round 1 (proposer/generator): initial draft from product spec + rubric preset
- Round 1 (reviewer/evaluator): {clarifications requested OR accepted}
- Round 2 (proposer/generator): {amendments OR no changes needed}
- Signed by generator: {git commit sha — set on sign action}
- Signed by evaluator: {git commit sha — set on sign action}

## Amendments (if any)

Format: append a new subsection per amendment. Both sides re-sign.

<!-- Example:
### Amendment 1 — 260408-1500
- Reason: AC-04 condition X was found unverifiable mid-build
- Change: removed AC-04, added AC-04a with revised condition
- Generator re-signed: {sha}
- Evaluator re-signed: {sha}
-->

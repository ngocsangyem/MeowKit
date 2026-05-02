---
title: "mk:sprint-contract"
description: "Negotiation protocol between generator and evaluator — produces signed contract before harness writes code."
---

# mk:sprint-contract

File-based sprint contract protocol. Generator (developer) and evaluator negotiate testable acceptance criteria with rubric tie-ins before any code is written. Produces a signed contract at `tasks/contracts/{date}-{slug}-sprint-{N}.md`. Enforced by `gate-enforcement.sh`.

For single-task plan validation (cook flow), use `mk:validate-plan` instead. This is for product-level specs feeding into `mk:harness` only.

## When to use

- Harness needs to negotiate a sprint before invoking the generator
- Generator needs to read a signed contract before starting implementation
- Previously signed contract needs amendment due to mid-build scope discovery

Skip when: `MEOWKIT_HARNESS_MODE=LEAN`, plan is `--fast` mode, or task is `/mk:fix simple`.

## Subcommands

| Subcommand | Owner | Effect |
|---|---|---|
| `propose` | generator (developer) | Drafts contract from product spec + rubric preset; status: `draft → negotiating` |
| `review` | evaluator | Critiques proposed contract for testability + scope clarity; produces clarification requests |
| `amend` | generator | Iterates per evaluator feedback; rounds += 1 |
| `sign` | both | Both agents commit via git commit messages; status: `negotiating → signed` |
| `validate` | anyone | Runs `validate-contract.sh` to check schema conformance |

## Hard constraints

- Max 2 negotiation rounds (propose → review → amend → review → escalate if still unresolved)
- Evaluator hard cap: 2 review rounds. After 2 rounds with unresolved ACs → escalate to human
- Hard-cap AC limit of 15 criteria per sprint
- `LEAN` density bypass (sprint contract skipped when `MEOWKIT_HARNESS_MODE=LEAN`)

## Contract format

Required sections: Generated Artifacts, Acceptance Criteria (Given/When/Then or explicit Assertion form), Rubric Tie-in, Scope Boundaries. Template at `tasks/templates/sprint-contract-template.md`.

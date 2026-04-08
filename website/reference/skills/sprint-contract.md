---
title: "meow:sprint-contract"
description: "File-based sprint contract protocol — negotiates testable acceptance criteria between generator and evaluator before any source code is written."
---

# meow:sprint-contract

Negotiation protocol that produces a signed, git-committed contract file at `tasks/contracts/{date}-{slug}-sprint-{N}.md` before the generator writes a single line of source code. Translates a product-level spec into testable acceptance criteria with rubric tie-ins. Enforced by `gate-enforcement.sh`.

## What This Skill Does

`meow:sprint-contract` bridges the product plan and the implementation. The generator (developer agent) proposes acceptance criteria in Given/When/Then form, each bound to a rubric in the active preset. The evaluator reviews those ACs for testability and scope clarity. They negotiate until both sign — producing a git-committed contract that becomes the source of truth for what gets built and how it gets graded. The negotiation is capped at 2 rounds; round 3 escalates to a human. Contract bypass is allowed only for LEAN density (Opus 4.6+) with fewer than 5 estimated ACs.

## Core Capabilities

- **5-subcommand lifecycle** — `propose`, `review`, `amend`, `sign`, `validate`
- **Rubric tie-ins** — every AC is bound to one rubric in the active preset; evaluator has an anchor for every criterion
- **Hard negotiation cap** — 2 rounds max; round 3 escalates to human via `AskUserQuestion`
- **Two-commit signing protocol** — each agent produces two commits to create verifiable SHAs in frontmatter
- **`gate-enforcement.sh` integration** — source code edits are blocked until the contract is signed
- **Amendment support** — post-sign amendments null both signature fields, re-run the sign protocol, and are append-only history
- **Schema validation** — `validate-contract.sh` enforces frontmatter fields, AC form, and rubric bindings

## When to Use This

::: tip Use meow:sprint-contract when...
- You're in `FULL` density (`meow:harness` Sonnet or Opus 4.5) and the harness step-02 requires it
- You want explicit, negotiated acceptance criteria before a generator starts building
- You need a verifiable audit trail that maps each built feature to a rubric-graded criterion
- You're amending the scope mid-sprint due to a new discovery
:::

::: warning Don't use meow:sprint-contract when...
- `MEOWKIT_HARNESS_MODE=LEAN` — capable models (Opus 4.6+) self-derive criteria; contract adds overhead not value
- `--fast` mode tasks — planning overhead exceeds the value for small tasks
- `/meow:fix simple` tasks — Gate 1 is already bypassed; contract bypass applies too
- Estimated ACs are fewer than 5 in LEAN mode — skip is explicitly allowed
:::

## Usage

```bash
# Interactive — start negotiation as the generator
/meow:sprint-contract propose my-kanban-app

# Evaluator reviews the proposed contract
/meow:sprint-contract review my-kanban-app

# Generator amends per evaluator feedback
/meow:sprint-contract amend my-kanban-app

# Both agents sign in sequence
/meow:sprint-contract sign my-kanban-app

# Validate schema conformance at any point
/meow:sprint-contract validate tasks/contracts/260408-1200-my-kanban-app-sprint-1.md
```

## Subcommands

| Subcommand | Owner | Status Transition |
|---|---|---|
| `propose` | generator (developer agent) | `draft → negotiating` |
| `review` | evaluator | stays `negotiating`; increments `rounds` |
| `amend` | generator | stays `negotiating`; addresses evaluator clarifications |
| `sign` | both agents in sequence | `negotiating → signed` |
| `validate` | anyone | schema conformance check (no status change) |

## Inputs

- Product spec from `tasks/plans/*/plan.md` (read by `propose`)
- Rubric preset loaded via `meow:rubric compose <preset>`
- Existing contracts `tasks/contracts/*-{slug}-sprint-*.md` (to determine sprint N)
- `assets/contract-template.md` — canonical template copied on `propose`
- `MEOWKIT_HARNESS_MODE` — if `LEAN`, the subcommands are skipped entirely

## Outputs

- `tasks/contracts/{YYMMDD-HHMM}-{slug}-sprint-{N}.md` — signed contract file
- Git commit log — four commits per sprint (two generator + two evaluator)
- `.claude/memory/lean-bypass.log` — appended when LEAN bypass occurs

## Flags

| Flag | Purpose | Default |
|---|---|---|
| `--sprint N` | Target a specific sprint number | auto-detected |
| (none) | Subcommand is the primary argument | — |

## How It Works

### propose — Generator Drafts

Reads the active product spec, loads the rubric preset, auto-determines sprint number, copies `contract-template.md`, and populates 5–15 ACs in Given/When/Then form. Every preset rubric must have ≥1 AC binding. Sets `status: negotiating, rounds: 0`. Runs `validate-contract.sh` before printing a path.

### review — Evaluator Critiques

Checks each AC for testability (can it be verified by browser/curl/CLI?), rubric alignment (does the binding match the content?), and scope clarity. Weak ACs get clarification appended to the Negotiation Log. Clean contracts proceed directly to `sign`. Cap: 2 rounds — round 3 triggers `AskUserQuestion`.

### amend — Generator Iterates

Addresses every clarification from the review round in the relevant ACs (replace, don't delete). Appends a summary to the Negotiation Log. Re-runs `validate-contract.sh`. Signals evaluator to `review` again.

### sign — Two-Commit Protocol

Each agent produces two git commits. Commit 1 stages the file with `{agent}_signed: pending`. Commit 2 captures the SHA of commit 1 and writes it into the frontmatter as the real signature. Both agents' SHAs are stored in the contract file. `check-contract-signed.sh` rejects placeholder values (`null`, `pending`, `todo`). The git log is the audit trail.

### Mid-Build Amendment

Post-sign amendments null both signature fields first (`status: amended`), append the revision under `## Amendments`, then re-run the two-commit sign protocol. Source edits are blocked by `gate-enforcement.sh` between null and re-sign. Original criteria are never edited — history is append-only.

## Hard Constraints

From `harness-rules.md` Rule 3 and sprint-contract source:
- FULL density: contract required before any source-code edit; enforced by `gate-enforcement.sh`
- LEAN density: contract optional; skip if estimated ACs < 5
- MINIMAL density: contract skipped entirely (harness short-circuits to `meow:cook`)
- 2-round negotiation cap; round 3 always escalates to human
- Signed fields must be real git SHAs — validators reject placeholder values
- Amended contracts null both sigs before accepting source edits again

## Gotchas

1. **Don't mutate signed criteria** — revisions go in the Amendments section, never by editing original ACs
2. **Don't exceed 2 negotiation rounds** — agents that can't converge in 2 rounds won't converge in 5; escalate
3. **Don't skip the rubric tie-in** — each AC must reference one rubric; otherwise the evaluator has no anchor
4. **Don't write source code without a signed contract (FULL density)** — `gate-enforcement.sh` will block you
5. **Don't sign with placeholder text** — only a real SHA from `git rev-parse HEAD` passes `check-contract-signed.sh`
6. **Don't confuse sprint N** — `propose` auto-detects sprint number from existing contract files; check if sprint 1 is already signed before proposing again

## Relationships

- [`meow:harness`](/reference/skills/harness) — step 2 of the harness pipeline; invokes sprint-contract automatically
- [`meow:rubric`](/reference/skills/rubric) — provides rubric presets that contracts bind ACs to
- [`meow:evaluate`](/reference/skills/evaluate) — consumes signed contracts in step-01 to load rubrics + scope
- [`/reference/agents/evaluator`](/reference/agents/evaluator) — evaluator agent that owns the `review` subcommand

## See Also

- Canonical source: `.claude/skills/meow:sprint-contract/SKILL.md`
- Contract template: `.claude/skills/meow:sprint-contract/assets/contract-template.md`
- BDD-to-AC mapping: `.claude/skills/meow:sprint-contract/references/bdd-to-ac-mapping.md`
- Related skill: [`meow:harness`](/reference/skills/harness), [`meow:evaluate`](/reference/skills/evaluate)

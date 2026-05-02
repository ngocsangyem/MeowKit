---
title: "mk:sprint-contract"
description: "Negotiates a file-based sprint contract between generator and evaluator before code is written — BDD acceptance criteria, rubric bindings, git-signed agreement."
---

# mk:sprint-contract

## What This Skill Does

Creates and negotiates a sprint contract — a signed agreement between the generator (developer agent) and evaluator (review agent) about what will be built, what acceptance criteria must pass, and how it will be evaluated. Uses a git-signed two-commit-per-agent protocol for cryptographic non-repudiation.

## When to Use

- Starting a harness-driven sprint build (required before code)
- Complex features needing explicit scope boundaries
- Multi-agent builds where ownership must be clear
- **NOT for:** single-file changes, quick fixes, tasks without evaluation gates

## Core Capabilities

- **Contract template:** 10 frontmatter fields (status, parties, rubric_preset, scope_in, scope_out, ACs with assertions, negotiation_log, amendments, signatures)
- **BDD translation:** 6 rules for converting user stories into Given/When/Then acceptance criteria with anti-pattern detection
- **Git signing:** two-commit-per-agent protocol — each party commits their signature separately, SHA capture for non-repudiation
- **Amendment protocol:** nullifies existing signatures on amend, append-only changes, re-signing required
- **Validation:** `validate-contract.sh` checks 7 categories (frontmatter, status enum, rubric_preset, AC count, GWT form, injection patterns, required sections)
- **Hard constraints:** max 2 negotiation rounds, max 15 ACs, LEAN mode bypass via `MEOWKIT_HARNESS_MODE=LEAN`

## Arguments

| Flag | Effect |
|------|--------|
| `--propose` | Create a new contract from requirements |
| `--review` | Review a proposed contract (evaluator role) |
| `--amend` | Amend an existing contract (appends to negotiation log, nullifies signatures) |
| `--sign` | Sign the contract (generator or evaluator) |
| `--validate` | Run `validate-contract.sh` checks |

## Workflow

1. **Propose** — generator creates contract from requirements with ACs and rubric bindings
2. **Review** — evaluator reviews, may request changes (max 2 rounds)
3. **Negotiate** — amendments appended to negotiation log (append-only)
4. **Sign** — generator signs (commit 1), evaluator signs (commit 2). Both SHAs recorded.
5. **Validate** — `validate-contract.sh` runs. Gate enforcement checks `check-contract-signed.sh`.
6. **Build** — developer reads signed contract before writing code (enforced by `gate-enforcement.sh`)

## Usage

```bash
/mk:sprint-contract --propose "build user authentication with OAuth"
/mk:sprint-contract --review
/mk:sprint-contract --amend "add rate limiting to scope"
/mk:sprint-contract --sign
/mk:sprint-contract --validate
```

## Example Prompt

```
Create a sprint contract for adding two-factor authentication to the login flow. Scope: TOTP generation, QR code setup, backup codes, and recovery flow. Out of scope: SMS-based 2FA, hardware key support.
```

## Common Use Cases

- Harness-driven sprint builds
- Complex features with multiple acceptance criteria
- Multi-agent builds requiring clear ownership
- Regulated environments requiring audit trails

## Pro Tips

- **Every AC must bind to a rubric criterion.** If a preset rubric is used, every criterion should have at least one AC binding.
- **Assertion form is valid.** For criteria without preconditions, use explicit Assertion instead of Given/When/Then. Example: "Assertion: The user receives a JWT with a 15-minute expiry."
- **Mid-build amendments require re-signing.** If scope changes during build, the amendment nullifies all signatures and both parties must re-sign.

> **Canonical source:** `.claude/skills/sprint-contract/SKILL.md`

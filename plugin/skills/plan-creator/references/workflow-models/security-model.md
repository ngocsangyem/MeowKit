# Security Model

Applies when: security reviews, vulnerability assessments, auth/payment changes, incident response.

## Plan Shape
Required: Goal, Threat Model, Audit Scope, Security Checklist, Acceptance Criteria, Agent State
Optional: Findings (filled during audit), Remediation Plan

## Phase Flow
1. Plan scope → 2. Audit (mk:cso) → 4. Review findings → 5. Ship remediations

## Agent Sequence
planner → security (audit) → reviewer (verify remediations) → shipper

## Gate Points
- Gate 1: Audit scope approved
- Gate 2: All CRITICAL/HIGH findings remediated

## Model Tier
Always COMPLEX — uses best available model regardless of file count.

## Context Reminder (MANDATORY)

After Gate 1 approval, MUST print the cook command with absolute plan path.
Always: `/mk:cook {path}/plan.md` (interactive, never --auto for security).

> **Best Practice:** Run `/clear` before implementing to reduce planning-context carryover.
> Then run the cook command.

This is **NON-NEGOTIABLE** — always output after plan approval.

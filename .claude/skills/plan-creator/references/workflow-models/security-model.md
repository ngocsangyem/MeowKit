# Security Model

Applies when: security reviews, vulnerability assessments, auth/payment changes, incident response.

## Plan Shape
Required: Goal, Threat Model, Audit Scope, Security Checklist, Acceptance Criteria
Optional: Findings (filled during audit), Remediation Plan

## Phase Flow
1. Plan scope → 2. Audit (mk:cso) → 4. Review findings → 5. Ship remediations

## Agent Sequence
planner → security (audit) → reviewer (verify remediations) → shipper

## Checkpoints
- Before the audit: scope agreed with the user
- Before shipping: all CRITICAL/HIGH findings remediated

## Model Tier
Always COMPLEX — uses best available model regardless of file count.

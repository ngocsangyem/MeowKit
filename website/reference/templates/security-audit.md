# Security Audit Template

> Use for security reviews and vulnerability assessments.

**Primary agent:** security → reviewer
**Workflow phases:** Phase 2 (Audit) → Phase 4 (Review remediation)
**Create with:** `npx meowkit task new --type security "description"`

## When to use

- Pre-launch security review
- After adding auth/payment logic
- Dependency audit
- Incident response

## Key sections

### Threat Model
What is protected, from whom, from what attack vectors.

### Findings Table
Structured format: Severity | Finding | File | Line | Status

### Remediation Plan
Ordered by severity — CRITICAL first.

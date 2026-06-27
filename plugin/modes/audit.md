# Mode: Audit

## Activation

Activate with: `mode: audit` in task context or by specifying audit mode at session start.

## Configuration

- **Phases**: Review phase only. No planning, implementation, or shipping.
- **Gate 1 (Plan)**: Not applicable.
- **Gate 2 (Review)**: Not applicable (audit does not lead to shipping).
- **Security checks**: Activated on EVERY file in scope. Comprehensive, not incremental.
- **Model routing**: Best available model (security analysis requires highest quality reasoning).
- **Allowed output**: Security reports and findings documentation only. Does NOT fix issues — only identifies and documents them.
- **Active agents**: Security agent activated on all files in scope.

## Planning Depth

- **Researchers:** 1 (focused security research before audit)
- **Parallel research:** No
- **Two approaches:** No

## Allowed Commands

- `/audit` — full security audit
- `/review` — structural review (read-only, no gate enforcement)
- `/validate` — deterministic validation scripts
- `/arch list` — list ADRs for context
- `/arch impact` — assess architectural impact

## Blocked Commands

- `/cook` — no implementation allowed
- `/fix` — audit mode identifies but does not fix
- `/ship` — nothing to ship
- `/canary` — nothing to deploy

## When to Use

- Pre-launch security review
- Compliance checks (SOC 2, HIPAA, PCI)
- Third-party code review (reviewing code you didn't write)
- Periodic security posture assessment
- Post-incident security sweep

## What's Different from Default

Audit mode only identifies and documents issues. It does not fix anything. The output is a comprehensive security report covering every file in scope, not just changed files.

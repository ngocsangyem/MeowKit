# Mode: Strict

## Activation

Activate with: `mode: strict` in task context or by specifying strict mode at session start.

## Configuration

- **Phases**: All 6 phases active.
- **Gate 1 (Plan)**: Enforced.
- **Gate 2 (Review)**: Enforced with elevated requirements.
- **Security checks**: Runs on EVERY file change, not just at Phase 2/4. Continuous security monitoring.
- **Model routing**: Always use best available model. No cost optimization.
- **Test coverage**: 80% minimum threshold for new code. Hard fail if below.
- **Review strictness**: ALL 5 dimensions must be PASS. No WARN allowed — any WARN is treated as FAIL and blocks shipping.

## Planning Depth

- **Researchers:** 2 (parallel investigation for deeper analysis)
- **Parallel research:** Yes (two researchers explore different angles simultaneously)
- **Two approaches:** Yes (planner produces 2 competing plans; user selects one)

## When to Use

- Production hotfixes (high-risk changes to live systems)
- Security-sensitive features (auth, encryption, access control)
- Payment/billing/financial features
- Features handling PII or sensitive user data
- Compliance-critical work
- Any change where a bug could cause significant business or user impact

## What's Different from Default

| Aspect | Default | Strict |
|--------|---------|--------|
| Security scan frequency | Phase 2 and Phase 4 | Every file change |
| WARN handling | Acknowledge and proceed | Treated as FAIL — must fix |
| Test coverage threshold | Project's existing % | 80% minimum |
| Model routing | Cost-optimized by tier | Always best model |
| Review bar | No FAIL dimensions | All dimensions must PASS |

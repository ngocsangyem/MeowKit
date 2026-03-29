# Mode: Fast

## Activation

Activate with: `mode: fast` in task context or by specifying fast mode at session start.

## Configuration

- **Phases**: All 6 phases active but with reduced gates.
- **Gate 1 (Plan)**: Still enforced. Planning is not optional even in fast mode.
- **Gate 2 (Review)**: Auto-approve if ALL tests pass AND no security BLOCK-level findings. Human intervention only needed if tests fail or BLOCK issues exist.
- **Security checks**: Still runs but only checks for BLOCK-level issues. WARN-level findings are logged but do not require acknowledgment.
- **Model routing**: Default to cheapest model tier unless complexity is detected (then escalate).
- **Test coverage**: No minimum threshold enforced (but tests still must pass).
- **Review strictness**: Auto-pass if tests green and no BLOCKs.

## Planning Depth

- **Researchers:** 0 (skip research entirely — go straight to planning)
- **Parallel research:** No
- **Two approaches:** No

## When to Use

- Prototyping and proof-of-concept work
- Internal tools not exposed to end users
- Non-production code (dev/staging environments)
- Rapid iteration during exploration phase
- Hackathons or time-boxed spikes

## WARNING

Do NOT use fast mode for:
- User-facing features
- Production deployments
- Security-sensitive code
- Payment or financial features
- Anything handling PII

## What's Different from Default

| Aspect | Default | Fast |
|--------|---------|------|
| Gate 1 (Plan) | Human approval | Human approval (same) |
| Gate 2 (Review) | Human approval | Auto-approve if tests pass + no BLOCKs |
| Security scan | Full (BLOCK + WARN) | BLOCK only |
| Model routing | Standard | Cheapest unless complex |
| Test coverage | Project threshold | No minimum |

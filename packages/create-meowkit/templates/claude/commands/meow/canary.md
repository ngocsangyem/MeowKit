# /canary — Staged Deployment

## Usage

```
/canary [deploy target]
```

## Behavior

Staged deployment with monitoring and human-gated promotion. Uses the `canary-deploy` skill for decision criteria.

### Execution Steps

1. **Assess if canary is warranted.** Auto-detect based on changed files:
   - Database migrations present → canary warranted
   - Auth/security changes → canary warranted
   - API contract changes → canary warranted
   - Infrastructure/config changes → canary warranted
   - UI-only changes with no backend impact → canary optional
   - If canary is not warranted, inform the user and offer to proceed with standard deploy.

2. **Deploy to canary environment.**
   - Deploy the current build to the canary/staging environment only.
   - Canary receives a percentage of traffic (project-specific configuration).
   - Print: deployment target, version/commit deployed, traffic percentage.

3. **Print monitoring checklist.** Provide a checklist for the human to verify:
   ```
   🐱 Canary Monitoring Checklist:
   [ ] Error rate: no increase from baseline
   [ ] Latency p50/p95/p99: within acceptable range
   [ ] Key business metrics: no degradation
   [ ] Logs: no new error patterns
   [ ] Duration: observed for minimum [X] minutes
   ```

4. **Wait for human confirmation.** Two options:
   - **Promote**: roll out to 100% of traffic / production.
   - **Rollback**: revert canary to previous version, no production impact.

### Output

- Canary deployment status
- Monitoring checklist
- Awaiting human decision: promote or rollback

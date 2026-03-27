# Skill: Canary Deploy (Staged Rollout)

**Purpose:** Deploy changes to a small subset of traffic first, monitor for issues, then promote to full deployment or automatically rollback.

## When to Use

Use canary deployment when the change affects ANY of the following:

1. **Auth / session handling** — login, logout, token refresh, session management
2. **Payment processing** — billing, subscriptions, checkout flows
3. **Database schema** — migrations, column changes, index changes
4. **API contracts consumed by mobile** — response shape changes, new required fields
5. **Infrastructure / config** — environment variables, service configuration, deployment config

If the change does not affect any of these, a standard deployment is acceptable.

---

## Steps

### Step 1: Deploy to Canary Environment

Deploy the change to the canary environment only. This receives a small percentage of traffic (typically 5-10%).

```bash
# Example: deploy to canary
deploy --environment canary --version <commit-sha>
```

Verify the canary deployment is healthy before proceeding to monitoring:
- [ ] Deployment completed without errors
- [ ] Health check endpoint returns 200
- [ ] Application logs show normal startup

### Step 2: Monitor for 30 Minutes

During the 30-minute monitoring window, observe the following metrics:

**Error Rates:**
- HTTP 5xx error rate (threshold: < 0.1% or no increase from baseline)
- Unhandled exception rate
- Timeout rate

**Latency:**
- P50 response time (threshold: no more than 10% increase)
- P95 response time (threshold: no more than 20% increase)
- P99 response time

**Key Business Metrics:**
- Successful login rate (if auth change)
- Successful payment rate (if payment change)
- API success rate for affected endpoints

**Infrastructure:**
- CPU utilization
- Memory utilization
- Database connection pool usage

### Step 3: Evaluate Health

After 30 minutes, evaluate:

**Healthy (promote):**
- All error rates within threshold
- Latency within threshold
- No anomalies in business metrics
- No new error types in logs

**Degraded (rollback):**
- Error rate exceeds threshold
- Latency exceeds threshold
- Business metrics show decline
- New error types appear in logs

### Step 4a: Promote to Full Deployment (if healthy)

```bash
# Promote canary to full deployment
deploy --environment production --version <commit-sha>
```

Continue monitoring for an additional 15 minutes after full promotion.

### Step 4b: Automatic Rollback (if degraded)

```bash
# Rollback canary to previous version
deploy --environment canary --version <previous-commit-sha>
```

After rollback:
1. Verify canary is healthy on the previous version
2. Investigate the root cause of degradation
3. Document findings in the incident log
4. Fix the issue and repeat the canary process

---

## Monitoring Dashboard Checklist

Before starting a canary deploy, ensure you have visibility into:
- [ ] Error rate dashboard for the affected service
- [ ] Latency dashboard (P50, P95, P99)
- [ ] Business metric dashboard (if applicable)
- [ ] Log aggregation with filtering by version/deployment
- [ ] Alerting configured for threshold breaches

## Decision Matrix

| Metric | Threshold | Action |
|--------|----------|--------|
| 5xx rate | > 0.1% above baseline | Rollback |
| P95 latency | > 20% above baseline | Rollback |
| Business metric | > 5% decline | Rollback |
| New error types | Any | Investigate, rollback if critical |
| All metrics healthy | 30 min sustained | Promote |

## Documentation

After every canary deployment, record:
- Canary start time and end time
- Metrics observed during monitoring
- Decision made (promote or rollback) and why
- Any issues encountered and how they were resolved

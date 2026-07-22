# Incident Management Workflow Pattern

> **CONCEPT REFERENCE — NOT AUTHORITATIVE.** This file describes a common workflow shape for orientation. **Your project may use different status names + transitions.** Always consult `tasks/jira-workflows/<workflow-slug>.md` (discovered via `bash the project environment/.agents/skills/jira/scripts/fetch-workflow.sh <KEY>`) for the actual workflow. See `.agents/skills/jira-lifecycle/references/workflow-discovery.md`.

**Use this pattern for:** Managing incidents, outages, and urgent issues.

**Prerequisites:** JIRA Service Management license recommended.

**Audience:** SRE teams, DevOps, IT operations, incident commanders.

---

## Workflow Diagram

```
Open --> Investigating --> In Progress --> Monitoring --> Resolved --> Closed
  |           |                |               |             |
  +-----------+----------------+---------------+-------------+--> False Alarm
```

## Statuses

| Status | Category | Description |
|--------|----------|-------------|
| Open | To Do (Blue) | Incident reported |
| Investigating | In Progress (Yellow) | Root cause analysis |
| In Progress | In Progress (Yellow) | Fix in progress |
| Monitoring | In Progress (Yellow) | Fix deployed, watching |
| Resolved | Done (Green) | Incident resolved |
| Closed | Done (Green) | Post-mortem complete |
| False Alarm | Done (Green) | Not a real incident |

## Priority and Severity

### Priority Levels

| Priority | Response Time | Description |
|----------|---------------|-------------|
| Critical (P1) | 15 minutes | Complete outage |
| High (P2) | 1 hour | Significant impact |
| Medium (P3) | 4 hours | Moderate impact |
| Low (P4) | 24 hours | Minor impact |

### Severity Levels

| Severity | Description |
|----------|-------------|
| SEV1 | Critical business impact |
| SEV2 | Major functionality affected |
| SEV3 | Minor functionality affected |
| SEV4 | Cosmetic or low impact |

## Script Examples

### Incident Response

```bash
# Start investigation immediately
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle transition INC-456 --name "Investigating"
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle assign INC-456 --user oncall@example.com

# Move to active fix
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle transition INC-456 --name "In Progress" \
  --comment "Root cause identified: Database connection pool exhausted"

# Deploy fix and monitor
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle transition INC-456 --name "Monitoring" \
  --comment "Fix deployed, monitoring for 24 hours"

# Resolve after monitoring period
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle resolve INC-456 --resolution "Fixed" \
  --comment "Incident resolved. No recurrence in 24h. Post-mortem scheduled."
```

### False Alarm

```bash
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle transition INC-789 --name "False Alarm" \
  --comment "Alert triggered by scheduled maintenance, not an actual incident"
```

## Recommended Conditions

| Transition | Condition |
|------------|-----------|
| Start Investigating | Must have priority set |
| Move to Monitoring | User in SRE group |
| Resolve | All linked P1 issues resolved |

## Post-Incident

After resolution:
1. Create post-mortem document
2. Link related incidents/problems
3. Update runbooks if needed
4. Close after post-mortem review

```bash
# Close after post-mortem
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle transition INC-456 --name "Closed" \
  --comment "Post-mortem completed. See confluence.com/INC-456-postmortem"
```

---

*For service requests, see [jsm-request-workflow.md](jsm-request-workflow.md).*

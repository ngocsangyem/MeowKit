# Confluence Page Templates

Canonical markdown skeletons for common page bodies. The wrapper accepts markdown via `--content` and auto-converts to Confluence storage format.

## Contents

- [RFC Template](#rfc-template)
- [Runbook Template](#runbook-template)
- [Decision Record Template](#decision-record-template)

## RFC Template

```markdown
# RFC: {title}

**Status:** Draft | Proposed | Accepted | Rejected | Superseded
**Author:** {name}
**Reviewers:** {names}
**Created:** {date}
**Last updated:** {date}

## Summary

{2-3 sentence problem + proposal}

## Motivation

{Why this matters now. What breaks if we do nothing?}

## Proposal

{Concrete design — APIs, data model, sequencing, rollout}

### Alternatives considered

- **Option A:** {1 line} — rejected because {reason}
- **Option B:** {1 line} — rejected because {reason}

## Open Questions

- {question 1}
- {question 2}

## Out of Scope

- {explicitly excluded item}

## Rollout Plan

1. {milestone 1}
2. {milestone 2}

## Success Metrics

- {measurable outcome 1}
- {measurable outcome 2}
```

## Runbook Template

```markdown
# Runbook: {service / scenario}

**Owner:** {team}
**Severity bands:** P1 / P2 / P3 / P4
**On-call rotation:** {link or schedule}

## When to use this runbook

{Symptom that triggers this runbook}

## Pre-checks

- [ ] {check 1 — usually a dashboard URL}
- [ ] {check 2}

## Diagnosis

### Step 1: {action}

```
{exact command}
```

Expected output: {what success looks like}

### Step 2: {action}

```
{exact command}
```

## Remediation

### If symptom A:

```
{commands}
```

### If symptom B:

```
{commands}
```

## Escalation

- {who to page if remediation fails}
- {related runbooks}

## Postmortem hook

After incident close, link the incident report here.
```

## Decision Record Template

```markdown
# ADR: {decision title}

**Date:** {date}
**Status:** Proposed | Accepted | Superseded
**Deciders:** {names}

## Context

{What forced this decision now? What constraints apply?}

## Decision

{The chosen path, in one paragraph}

## Alternatives Rejected

- **Alt A:** {1 line} — rejected because {reason}
- **Alt B:** {1 line} — rejected because {reason}

## Consequences

### Positive

- {what improves}

### Negative

- {what we accept as cost}

### Neutral

- {what changes but is neither better nor worse}

## See also

- {related ADR / RFC / link}
```

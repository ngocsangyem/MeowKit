# RCA Method Selection

Select the right root cause analysis method before investigating. Using the wrong method wastes time and produces shallow findings.

## Method Selection Matrix

| Problem Type | RCA Method | Time Budget | Output |
|---|---|---|---|
| Simple, single-system failure | 5 Whys | 1-2 hours | Linear cause chain |
| Multiple contributing factors, unclear origin | Ishikawa Fishbone | 4-8 hours | Category map of causes |
| Recurring failure (3+ occurrences) | 8D (Eight Disciplines) | 20-40 hours | Permanent corrective action report |
| Safety-critical or catastrophic failure | Fault Tree Analysis | 40-80 hours | Boolean logic failure tree |

## Method Quick Guides

### 5 Whys (default for most bugs)

Start with the symptom. Ask "why did this happen?" — answer that question. Ask "why did that happen?" — repeat until you reach a systemic gap (missing test, missing validation, unclear ownership).

Stop conditions: you reach a process/system gap (not a person), or you've asked 5+ whys.

Example:
- Symptom: Payment failed in production
- Why 1: Stripe API returned 402
- Why 2: Card was expired
- Why 3: Renewal notification was not sent
- Why 4: Email service timeout was not retried
- Why 5: Retry logic was not implemented → ROOT CAUSE

### Ishikawa Fishbone (when 5 Whys stalls)

Draw 6 category spines: People, Process, Technology, Environment, Materials, Measurement. Under each spine, list contributing causes. Useful when failures span multiple teams or systems.

Use when: 5 Whys produces different root causes on different runs, or the team argues about which cause is "real."

### 8D (for recurring failures)

Eight disciplines: Define problem → Form team → Contain → Find root cause → Choose permanent fix → Implement → Prevent recurrence → Congratulate team.

Produces: a D4 root cause statement + D5 permanent corrective action. Required when the same failure has occurred 3+ times.

### Fault Tree Analysis (safety-critical only)

Top-down boolean logic tree. Start with the undesired event (top event). Work down to basic events using AND/OR gates. Calculate probability of top event from component failure rates.

Use when: system failure could cause data loss, financial fraud, safety risk, or regulatory violation.

## Method Escalation Rules

Escalate to next method when:

- **5 Whys → Ishikawa**: Two people independently trace to different root causes. Team disagrees on cause chain. Failure spans 3+ systems.
- **Ishikawa → 8D**: Same failure occurs again after fix. Corrective action did not prevent recurrence. Customer-reported defect.
- **8D → FTA**: Failure causes significant user harm or data loss. Regulatory or audit requirement. Safety-critical path confirmed.

## Time Budget Enforcement

If investigation exceeds time budget → stop, document findings-to-date, escalate.

Never extend investigation past 2x budget without user approval.

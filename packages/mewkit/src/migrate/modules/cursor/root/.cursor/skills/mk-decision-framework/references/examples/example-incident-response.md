# Example: Security Incident Response Decision Framework

Domain: Software/SaaS security incident response
Decision: How to classify, respond to, and communicate security incidents
Volume: Variable — hope for zero, plan for several per quarter

---

## Classification Taxonomy (P1–P4 Severity)

| Severity | Definition | Example |
|----------|------------|---------|
| P1 — Critical | Active breach, data exfiltration in progress, or complete service outage | Attacker has shell access; production DB being dumped |
| P2 — High | Confirmed vulnerability being exploited or significant service degradation | SQL injection confirmed; no exfiltration yet detected |
| P3 — Medium | Vulnerability discovered but not yet exploited; partial service impact | Dependency CVE with public exploit; no evidence of use |
| P4 — Low | Security finding with no immediate risk; minor anomaly | Misconfigured S3 bucket with no sensitive data; unusual login pattern |

**Escalation rule:** When in doubt, classify higher. Downgrade after investigation, never upgrade reactively.

---

## Response Rules per Severity

### P1 — All-Hands, < 15 Minutes

1. **Immediate containment:** Isolate affected systems within 5 min (revoke credentials, block IPs, take service offline if needed).
2. **Assemble response team:** Eng lead + Security + CEO notified within 15 min. No exceptions.
3. **Preserve evidence:** Snapshot logs, memory dumps before containment wipes them.
4. **External comms hold:** No public statements until Legal approves. Internal status page updated immediately.
5. **Customer notification trigger:** If PII or payment data confirmed accessed → Legal initiates breach notification within 72h (GDPR/CCPA requirement).

### P2 — Team Response, < 1 Hour

1. **Contain exploit vector:** Patch, WAF rule, or feature flag to block attack surface within 1h.
2. **Assemble response team:** Security + Eng lead notified within 30 min.
3. **Investigate scope:** Determine if exploitation occurred and what data was accessible.
4. **Escalate to P1** if evidence of active exploitation or data access found during investigation.
5. **Status page:** Internal only unless customer-visible impact.

### P3 — Sprint Response

1. **Assign owner:** Security engineer owns remediation. Due in current or next sprint.
2. **Temporary mitigation:** Apply WAF rule or config change to reduce exposure immediately.
3. **Track in backlog:** Create security ticket with CVE reference and affected versions.
4. **No all-hands:** Handled through normal engineering process with priority tag.

### P4 — Backlog

1. Log in security backlog with severity label.
2. Address in next available sprint — no escalation required.
3. Review quarterly to ensure P4 items don't age into higher severity.

---

## Communication Protocol

| Audience | P1 | P2 | P3 | P4 |
|----------|----|----|----|-----|
| Eng team | Immediate Slack war room | Within 30 min | Next standup | Weekly security sync |
| CEO/Leadership | Within 15 min | Within 1h | Weekly report | Monthly summary |
| Internal status page | Immediately | Within 30 min | If customer-visible | No |
| Customer notification | If PII/payment accessed (72h legal window) | If customer data at risk | No | No |
| Public disclosure | After containment + Legal approval | After patch released | With patch release | Optional |

---

## Post-Mortem Trigger

| Condition | Post-Mortem Required | Timeline |
|-----------|---------------------|----------|
| P1 incident | Yes — mandatory | Within 5 business days |
| P2 with customer data access | Yes | Within 7 business days |
| P2 without data access | Yes — lightweight | Within 14 business days |
| P3 exploited before patch | Yes | Within 14 business days |
| P3/P4 no exploitation | No | — |

Post-mortem format: timeline → root cause → contributing factors → 3 action items with owners and due dates.

---

## Edge Cases

**Insider threat suspected (employee as attacker)**
Situation: Anomalous data access pattern from active employee account — could be credential theft or malicious insider.
Why obvious approach fails: Standard P2 response notifies Eng lead, who may be the suspect or their manager.
Correct approach: Escalate directly to CEO and Legal, bypassing normal Eng chain. HR involved from the start. Preserve all access logs before account is suspended.

**Researcher reports vulnerability via bug bounty**
Situation: External researcher submits valid P2 finding through bug bounty program.
Why obvious approach fails: P2 response activates internal war room, which is disproportionate and leaks internal process to the researcher.
Correct approach: Classify as P2 internally but use bug bounty response SLA (72h acknowledgement, 30-day patch window). No all-hands. Normal sprint remediation with elevated priority. Thank researcher; do not disclose internal severity classification.

---
title: "mk:decision-framework"
description: "mk:decision-framework"
---

## What This Skill Does
Structures expert judgment into repeatable, auditable decision systems for recurring high-stakes choices. Produces a complete decision framework document with classification taxonomy, sequential decision rules (ordered Safety > Compliance > Economics > Speed), weighted scoring matrix, 4-level escalation protocol, communication templates, and an edge case playbook. Includes 3 worked examples for reference.

## When to Use
- User asks "how should we handle X cases?" or "build triage system"
- Designing escalation protocols or case management workflows
- Billing ops, support, returns processing, incident response, compliance decisions
- Any domain with classified decision types and routing rules

## Core Capabilities
1. **Classification Taxonomy:** Mutually exclusive case types (3-7 top-level buckets). Priority ordering so cases matching multiple types get the higher-priority classification. Every incoming case maps to exactly one type
2. **Sequential Decision Rules:** Ordered by Safety > Compliance > Economics > Speed. Never let speed override safety. Each rule documents its reasoning for its position in the sequence
3. **Weighted Scoring Matrix:** 3-5 factors with weights summing to 100%. Calibrated against 3 historical cases. Scoring used when multiple factors influence the right outcome and a simple rule tree is insufficient. Safety/compliance rules always override scoring
4. **4-Level Escalation Protocol:** Expert (L1, handle within authority) -> Manager (L2, override policy, 24h) -> Director (L3, cross-team decisions, same business day) -> VP/Executive (L4, existential risk, within 2h). Each level has authority scope, timeline, and escalation triggers. Includes escalation checklist
5. **Communication Templates:** 3 tones -- Routine/Collaborative (brief, data-led), Significant/Formal (documented, references contract), Crisis/Escalation (lead with impact, set deadline). Each with complete example templates
6. **Edge Case Playbook:** Discovery process (expert interviews, team sessions), documentation format (situation -> why obvious approach fails -> correct approach), maintenance schedule (quarterly review), and warning signs of missing edge cases
7. **3 Worked Examples:** Returns Triage (e-commerce, 200 returns/day, fraud detection patterns), Billing Operations (SaaS, payment failure retry logic with annual plan overrides), Incident Response (security, P1-P4 with communication protocols and post-mortem triggers)

## Arguments
Takes a decision domain description as argument hint: `[decision domain description]`

## Workflow
1. **Identify Decision Type:** Clarify the recurring decision being structured. What is decided? Who decides? How often?
2. **Build Classification Taxonomy:** Load `decision-tree-template.md`. Map every case type into mutually exclusive categories (3-7 top-level buckets). Define priority order for multi-match cases
3. **Define Sequential Decision Rules:** Order by Safety > Compliance > Economics > Speed. Document reasoning for each rule's position. Create decision matrix (quick reference table)
4. **Create Weighted Scoring:** Load `weighted-scoring-guide.md`. Define 3-5 factors with weights summing to 100%. Calibrate against 3 historical cases. Define scoring scale (1-5) for each factor
5. **Define Escalation Protocol:** Load `escalation-protocol-template.md`. Map 4 escalation levels (Expert/Manager/Director/VP) with authority scope, timeline, and triggers. Include pre-escalation checklist
6. **Add Communication Templates:** Load `communication-patterns.md`. Select tone per relationship state (Routine/Significant/Crisis). Customize placeholders
7. **Document Edge Cases:** Load `edge-case-discovery.md`. Collect from team ("what surprised you?"). Document each as: situation -> why obvious approach fails -> correct approach

## Usage
```
/mk:decision-framework returns processing
/mk:decision-framework customer support triage
/mk:decision-framework security incident response
```

## Example Prompt
"We're getting overwhelmed with customer returns. Can you build us a triage system that our support team can follow without escalating everything?"

The skill will: clarify the decision domain (returns processing), build a classification taxonomy (Eligible/Ineligible/Fraud Suspect), define decision rules ordered Safety > Compliance > Economics > Speed, create weighted scoring if needed, define 4-level escalation (frontline -> manager -> director -> VP), add communication templates for each tone, and document known edge cases (wardrobing, carrier-damaged late returns).

## Common Use Cases
- E-commerce returns triage
- SaaS billing exception handling (payment failures, refunds, churn risk)
- Security incident response (P1-P4 classification with communication protocols)
- Customer support case routing and escalation
- Compliance decision frameworks (regulatory, legal)
- Access control / authorization decision trees

## Pro Tips
- Taxonomy is the foundation -- if cases don't fit cleanly, the decision rules will have exceptions everywhere. Run 5 real historical cases through the taxonomy before deploying
- Scoring weights must sum to 100% and be calibrated on real cases, not hypothetical ones. If scoring disagrees with expert judgment on 2 of 3 calibration cases, the weights need significant revision
- Escalation timelines must be specific (hours, not "soon"). The escalation checklist prevents premature escalation: document, exhaust options, quantify impact, confirm trigger met
- Edge cases are not exceptions to document and ignore -- they are the most important cases to get right. Quarterly review or review after any significant decision failure
- Warning signs you're missing edge cases: every case fits the taxonomy, no escalations in 90 days, expert says "it's pretty straightforward"
- The 3 worked examples in `references/examples/` are real, detailed references -- read them to understand the expected output quality

### Notes
- The doc's process steps (1-7) diverge from the source's actual steps. Step 5 in the doc says "Design Routing" and step 6 says "Document Exceptions" but the source has "Define Escalation Protocol" as step 5, "Add Communication Templates" as step 6, and "Document Edge Cases" as step 7. The doc appears to be an independent rewrite that lost fidelity.
- The source's `references/` directory contains 7 reference files (including 3 detailed worked examples) plus the SKILL.md, none of which are reflected in the doc's content depth.
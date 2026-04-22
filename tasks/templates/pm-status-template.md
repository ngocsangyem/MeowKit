# Delivery Status — {{plan_title}}

**Plan:** `{{plan_dir}}`
**Generated:** {{YYYY-MM-DD HH:MM Asia/Saigon}}
**By:** project-manager agent
**Headline:** {{N}} of {{M}} tasks done, {{K}} blocked — {{on-track | at-risk | slipping}}

---

## Completed

<!-- One row per completed task -->
- `{{task_id}}` — {{file_ref}} — commit `{{sha7}}`

## In Progress

<!-- One row per in-progress task with explicit next step -->
- `{{task_id}}` — owner: `{{agent}}` — next: {{next_step}}

## Blocked

<!-- One row per blocker with an unblock path -->
- `{{task_id}}` — blocker: {{description}} — unblock: {{owner + concrete action}}

## Risks

### New
- {{risk_description}} — mitigation: {{action}}

### Open
- {{risk_description}} — status: {{mitigation_progress}}

### Closed (retain for 1 report after closing, then drop)
- {{risk_description}} — closed: {{resolution}}

## Budget

{{cost_to_date_usd}} / {{cap_usd}} — projected to completion: {{eta_cost_usd}}

Source: `.claude/memory/cost-log.json` (session_id filter: `{{session_id}}`)

## Uncertain

<!-- Source disagreements — e.g., plan says done, verdict says FAIL -->
- {{disagreement_description}} — defaulted to: {{conservative_state}}

## Changes Since Last Report

<!-- Delta vs prior dated report in this plan-dir. Empty if first report. -->
- {{task_id}}: {{prior_state}} → {{current_state}}

## Next Actions

- [ ] owner: `{{agent}}` — DoD: {{binary pass/fail check}}

## Unresolved Questions

<!-- Questions for the human to answer. Do not include interactive prompts — this is a background report. -->
- {{question}}

---

*Written by `project-manager` per `.claude/rules/post-phase-delegation.md`. Report lives alongside the plan; archive moves reports with the plan.*

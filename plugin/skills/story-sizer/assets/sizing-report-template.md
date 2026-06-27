# Story Sizing Report — {{slug}}

| Field | Value |
|-------|-------|
| Generated | {{generated_at}} |
| Source | {{source_path}} |
| Source hash | `{{source_hash}}` |
| Scout context | {{scout_status}} |
| Stories sized | {{sized_count}} / {{total_count}} |
| Flagged for split | {{split_count}} |

> Default mode is advisory only. To create tickets, copy the suggested commands per story OR re-run with `--auto-create --project <KEY>` for a single-confirmation batch handoff.

{{#stories}}
## {{id}} — {{title}}

- **Points:** {{points}} ({{complexity}}) · uncertainty **{{uncertainty}}**
- **Drivers score:** {{drivers_score}} — {{dimension_scores_inline}}

{{#description}}
> {{description}}
{{/description}}

### Acceptance criteria

{{#acceptance_criteria}}
- {{.}}
{{/acceptance_criteria}}

{{#inconsistencies_present}}
### Inconsistencies

{{#inconsistencies}}
- {{.}}
{{/inconsistencies}}
{{/inconsistencies_present}}

{{#codebase_signals_present}}
### Codebase signals (from /mk:scout)

{{#codebase_signals}}
- {{.}}
{{/codebase_signals}}
{{/codebase_signals_present}}

{{#dor_status_present}}
### Definition of Ready

- Verdict: **{{dor_verdict}}**
- User phrase: {{dor_has_user}}
- Benefit phrase: {{dor_has_benefit}}
- Testable ACs: {{dor_testable}}
- Dependencies named: {{dor_deps}}
{{#dor_reasons_present}}
- Reasons: {{dor_reasons_inline}}
{{/dor_reasons_present}}
{{/dor_status_present}}

{{#split_present}}
### Split suggestion (advisory)

Trigger: **{{split_trigger}}**

{{split_rationale}}

{{#split_sub_stories}}
- **{{title}}** ({{focus}}) — ~{{est_points}} pts
{{/split_sub_stories}}
{{/split_present}}

{{#refusal_present}}
### REFUSED

Reason: {{refusal_reason}}. Add acceptance criteria (or other missing signal) and re-paste.
{{/refusal_present}}

{{#suggested_command_present}}
### Suggested Jira create command

```bash
/mk:jira-issue create --project <PROJECT> --type {{suggested_type}} \
  --summary "{{suggested_summary}}" \
  --story-points {{points}} \
  --description "{{suggested_description}}"{{suggested_epic}}{{suggested_components}}{{suggested_labels}}
```
{{/suggested_command_present}}

---
{{/stories}}

## Summary

| # | Story | Points | Split? | Notes |
|---|-------|--------|--------|-------|
{{#summary_rows}}
| {{id}} | {{title}} | {{points}} | {{split_marker}} | {{notes}} |
{{/summary_rows}}

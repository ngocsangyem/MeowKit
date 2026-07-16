## Brainstorm → Plan Handoff

Use this packet as compact pre-research input for `mk:plan-creator`. Do not pass the raw brainstorm transcript.

```yaml
problem: "[confirmed problem]"
binding_constraint: "[single non-negotiable constraint]"
success_criterion: "[what done looks like]"
excluded_scope: "[what is not being solved now]"
selected_idea: "[idea title + one-line mechanism]"
why_selected: "[score, constraint fit, novelty, scout touchpoint, or rejected-alternative rationale]"
scores:
  feasibility: [1-5]
  impact: [1-5]
  simplicity: [1-5]
  novelty: [1-5]
  total: [9-45]
touchpoints:
  - "[optional file/path/contract from scout summary]"
rejected_alternatives:
  - idea: "[idea title]"
    reason: "[why it lost]"
open_risks:
  - "[risk]"
planning_questions:
  - "[first question plan-creator must resolve]"
report_path: "tasks/reports/[report-name].md"
```

## Handoff Rules

- Ask the user before invoking or recommending `mk:plan-creator`.
- `mk:plan-creator` still owns requirements completeness, phase files, validation, and plan approval.
- `mk:cook` receives nothing directly from brainstorming; it starts from an approved plan.
- Leave `touchpoints` empty when scout was skipped.
- Never include secrets, raw logs, or sensitive file contents.

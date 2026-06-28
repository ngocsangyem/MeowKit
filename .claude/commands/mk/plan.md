# /plan — Phase 1: Planning

## Usage

```
/mk:plan [feature description] [--html]
```

`--html` (composable): after Gate 1 approval and task hydration, also render the plan to a shareable `{plan_dir}/plan.html` via `mk:visual-plan`. Opt-in; the markdown plan files stay the source of truth. Not valid on the `archive` / `red-team` / `validate` subcommands.

## Purpose

Create an implementation plan through `mk:plan-creator`. Output is documentation only; no source or test files are written (with `--html`, a derived `plan.html` is rendered from the approved plan).

## Dispatch

Activate `mk:plan-creator` with the feature description and any user-provided planning flags. Use the planning skill's references for scope challenge, workflow model selection, codebase scouting, and validation.

## Safety notes

- Plan output goes under `tasks/plans/YYMMDD-feature-name/`.
- Gate 1 requires an explicit human approval before implementation.
- A valid plan contains Goal, Context, Scope, Constraints, and Acceptance Criteria.

### Output

A plan directory at `tasks/plans/YYMMDD-feature-name/` with plan.md + reports/, awaiting human approval.

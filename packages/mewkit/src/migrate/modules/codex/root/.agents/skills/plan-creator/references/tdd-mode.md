# TDD Mode

`--tdd` is a composable flag, not a planning mode. It adds a regression-first structure to the selected mode and must survive handoff into `mk:cook`.

## Use When

- Refactoring existing production behavior.
- Fixing a bug with user-visible behavior.
- Preserving public API, auth, payment, data, async job, or state-machine contracts.
- Changing provider/internals while keeping old external behavior.

## Avoid When

- Greenfield prototype or throwaway spike.
- Docs, config, or tooling micro-task.
- UI polish where behavior is not stable enough to assert first.
- User explicitly disables tests with `--no-test`.

## Phase Contract

When `tdd_mode = true`, add optional phase frontmatter:

```yaml
tdd: true
regression_gate: "npm test"
```

Append these sections after `## Implementation Steps`:

````markdown
## Tests Before

- [ ] `existing_behavior_name` — fails for the missing or currently unprotected behavior.

## Protected Change

- Describe the code change protected by the tests above.

## Tests After

- [ ] `integration_or_edge_case_name` — validates new behavior or cross-component path.

## Regression Gate

```bash
npm test
```
````

`Tests Before` should capture current behavior before refactors. For greenfield features, it may describe expected new behavior that should fail before implementation.

## Handoff Contract

If `tdd_mode = true`, `step-09-post-plan-handoff.md` prints a cook command with `--tdd`:

```bash
the cook skill /absolute/path/to/plan.md --tdd
the cook skill --parallel /absolute/path/to/plan.md --tdd
```

Cook must warn when a plan contains `tdd: true`, `## Tests Before`, or `## Regression Gate` but the invocation does not include `--tdd` and `MEOWKIT_TDD` is not enabled.

## Task Hydration

Treat checkboxes in `## Tests Before` as RED-phase critical tasks when `tdd_mode = true`. Do not create a separate task hierarchy; attach RED tasks to the owning phase.

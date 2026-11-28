# Brief and acceptance (stage 1)

The brief is what the user confirms; the acceptance list is how the run proves it is done.
Both are written before any code, and neither changes after Confirm.

## Questions

Scout first (stack, the files the goal touches, how tests and builds run, plans in flight).
Ask only what the scout cannot settle, one short batch, each question with the options the
scout found and your default. A reversible detail the user would not care about is a default
you state, not a question.

## Brief template

Write it to `brief.md` in the run directory:

```markdown
# Brief: <goal in one sentence>

## Objective
<the outcome, in the user's terms>

## Done when
- `<command>` exits 0            <- every line is a command, a number or an observable state
- <observable state, and how to check it>

## Out of scope
- <what this run will not touch>

## Constraints
- <what must not change: APIs, files, behaviour, dependencies>

## Allowed substitutions
- <what the run may swap without asking, e.g. a library for an equivalent one>

## Decision owner
<who rules on a question the brief does not answer: the run (default) or the user>

## Caps
Wall clock <h>, dispatch rounds <n>, review rounds 3.
```

"Done when" lines that cannot run here (a manual check, a production state) are marked
`manual` and named in the final report as not verified by the run.

## Confirm

Show the brief and ask for one answer: **Confirm**, **Edit** (apply the change, show it again)
or **Abort** (end the run; only the run directory exists yet, and it stays as the record).
Silence, "looks fine" about part of it, or a question is not Confirm.

## acceptance.json

One item per "Done when" line, plus the project's own type-check, lint, test and build when it
has them. Scale it to the goal: 5 to 15 items is normal.

```json
{
  "brief": "brief.md",
  "items": [
    {
      "id": "A1",
      "check": "npm test",
      "passes": false,
      "evidence": ""
    }
  ]
}
```

Rules:

- Items start with `passes: false`.
- The run may set `passes` and fill `evidence` (the exit code, the host job id, the commit the
  check ran on). It never edits `check`, removes an item, or adds one that is easier.
- `passes: true` needs a check that finished with its own exit code 0 on the integrated tree.
  A queued or still-running check, or a runner exit 75 or 70, leaves `passes: false`.
- Workers never write this file; only the orchestrator does.

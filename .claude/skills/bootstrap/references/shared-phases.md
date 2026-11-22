# Shared Steps

Every mode runs these steps; the workflow file for the mode says only where it differs (approvals, research fan-out, flags). Run them in order without pausing, except at the mode's approval points.

## Git init

`git init` and `git commit --allow-empty -m "chore: initial commit"`. Full mode asks first. The empty commit stages nothing, so no secret can enter it.

## Research briefs

Each researcher gets a goal line and a return shape:

```
Goal: [the decision this research feeds, e.g. pick a stack for X]
Return: report of at most 150 lines at tasks/reports/researcher-NN-[topic-slug].md,
        ending with a one-line recommendation and open questions.
```

The count in a workflow file is a ceiling ("up to N"): use fewer when the topic does not need that many angles.

## Planning

Research reports (`tasks/reports/`) and `docs/design-guidelines.md` already exist, so tell `mk:plan-creator` to reuse them and skip its own discovery. It writes the plan under `tasks/plans/` with architecture, modules, file structure and acceptance criteria. Use the mode's plan flag.

## Scaffold

1. Pick the stack from research or `scripts/detect-stack.sh`.
2. Generate files from the plan's structure, following `references/scaffolding-principles.md`: config, then source, then tests, progressively. Modes that confirm print the tree first.
3. Save the stack profile as `config.json` at the project root (shape: `config.example.json`).
4. Done check: `scripts/validate-bootstrap.sh` exits 0 and the scaffold builds or compiles.

## Phase A: Implementation

Activate `mk:cook` with the plan path and the mode's cook flag. It handles TDD (when enabled), implementation and review. For frontend work it uses the `ui-ux-designer` subagent per `docs/design-guidelines.md`.

## Phase B: Documentation

Activate `mk:docs-init`: it scouts the new codebase and generates `docs/` (project overview, codebase summary, code standards, system architecture) and the README.

## Phase C: Final report

```
BOOTSTRAP COMPLETE
Project: [name]
Stack: [detected/selected stack]
Files generated: [count]
Plan: [plan path]
Docs: [list of docs/ files]

Next steps: review the code and docs; plan the next feature with mk:plan-creator; run mk:document-release after shipping.
```

Print it only after the scaffold check passed and Phases A and B finished. Then offer a commit. Stage the generated files by path and leave out `.env*`, credentials and keys, because a blanket `git add -A` can pick up secrets. Commit as `feat: bootstrap [project-name]`; never push.

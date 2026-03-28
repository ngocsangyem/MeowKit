# Shared Phases (Post-Plan)

These phases run after planning completes, regardless of bootstrap mode.

## Phase A: Implementation

Invoke meow:cook with the plan path and mode-matched flag:
- Full mode → `meow:cook [plan-path]` (interactive, all gates)
- Auto mode → `meow:cook [plan-path] --auto`
- Fast mode → `meow:cook [plan-path] --auto`
- Parallel mode → `meow:cook [plan-path] --parallel`

meow:cook handles: TDD, implementation, review cycle, fix-first resolution.

If frontend work: meow:cook uses `ui-ux-designer` subagent per `docs/design-guidelines.md`.

## Phase B: Documentation

After meow:cook completes, invoke meow:docs-init:
- Scouts the newly-created codebase
- Generates docs/ directory (project-overview, codebase-summary, code-standards, system-architecture)
- Generates or updates README.md

## Phase C: Final Report

Print summary:
```
BOOTSTRAP COMPLETE
Project: [name]
Stack: [detected/selected stack]
Files generated: [count]
Plan: [plan path]
Docs: [list of docs/ files]

Next steps:
- Review generated code and docs
- Use meow:plan-creator to plan next feature
- Use meow:document-release after shipping to keep docs in sync
```

Ask user: "Want to commit all changes?" If yes → git add + commit.

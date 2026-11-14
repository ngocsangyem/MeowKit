# Shared Phases (Post-Plan)

These phases run after planning completes, regardless of bootstrap mode.
**ALL phases are MANDATORY. Do NOT stop between phases.**

## Phase A: Implementation (MANDATORY)

**ACTION REQUIRED:** Activate mk:cook skill NOW with the plan path:

- Full mode → `the cook skill [plan-path]` (interactive, all gates)
- Auto mode → `the cook skill [plan-path] --auto`
- Fast mode → `the cook skill [plan-path] --auto`
- Parallel mode → `the cook skill [plan-path] --parallel`

mk:cook handles: TDD, implementation, review cycle, fix-first resolution.

If frontend work: mk:cook uses `ui-ux-designer` sub-task per `docs/design-guidelines.md`.

**After cook completes: proceed IMMEDIATELY to Phase B. Do NOT stop.**

## Phase B: Documentation (MANDATORY)

**ACTION REQUIRED:** Activate mk:docs-init skill NOW:

```
the docs-init skill
```

mk:docs-init will:
- Scout the newly-created codebase
- Generate docs/ directory (project-overview, codebase-summary, code-standards, system-architecture)
- Generate or update README.md

**After docs created: proceed IMMEDIATELY to Phase C. Do NOT stop.**

## Phase C: Final Report (MANDATORY)

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
- Use mk:plan-creator to plan next feature
- Use mk:document-release after shipping to keep docs in sync
```

Ask user: "Want to commit all changes?" If yes → `git add -A && git commit -m "feat: bootstrap [project-name]"`

**Bootstrap is complete only after this report is printed.**

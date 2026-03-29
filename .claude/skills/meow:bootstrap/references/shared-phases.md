# Shared Phases (Post-Plan)

These phases run after planning completes, regardless of bootstrap mode.
**ALL phases are MANDATORY. Do NOT stop between phases.**

## Phase A: Implementation (MANDATORY)

**ACTION REQUIRED:** Activate meow:cook skill NOW with the plan path:

- Full mode → `/meow:cook [plan-path]` (interactive, all gates)
- Auto mode → `/meow:cook [plan-path] --auto`
- Fast mode → `/meow:cook [plan-path] --auto`
- Parallel mode → `/meow:cook [plan-path] --parallel`

meow:cook handles: TDD, implementation, review cycle, fix-first resolution.

If frontend work: meow:cook uses `ui-ux-designer` subagent per `docs/design-guidelines.md`.

**After cook completes: proceed IMMEDIATELY to Phase B. Do NOT stop.**

## Phase B: Documentation (MANDATORY)

**ACTION REQUIRED:** Activate meow:docs-init skill NOW:

```
/meow:docs-init
```

meow:docs-init will:
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
- Use meow:plan-creator to plan next feature
- Use meow:document-release after shipping to keep docs in sync
```

Ask user: "Want to commit all changes?" If yes → `git add -A && git commit -m "feat: bootstrap [project-name]"`

**Bootstrap is complete only after this report is printed.**

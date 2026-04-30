# /plan — Phase 1: Planning

## Usage

```
/mk:plan [feature description]
```

## Behavior

Triggers Phase 1 of the MeowKit workflow via the `mk:plan-creator` skill. Output is documentation only — no code is written during planning.

### Process

1. **Scope challenge** — check complexity, search for existing solutions, determine scope mode (HOLD/EXPANSION/REDUCTION). See `mk:plan-creator/references/scope-challenge.md`.

2. **Select workflow model** — map task type to the correct model (feature/bugfix/refactor/security). See `mk:plan-creator/references/workflow-models/`.

3. **Scout + research** (if needed) — spawn `mk:scout` for unfamiliar codebases, researcher subagents for unfamiliar tech. Reports saved to `tasks/plans/YYMMDD-name/reports/`.

4. **Generate plan file** — use `mk:plan-creator` to produce a validated plan. Writes to:
   ```
   tasks/plans/YYMMDD-feature-name/plan.md
   ```
   Validates via `scripts/validate-plan.py` before presenting.

5. **Gate 1 — Human approval.** Display plan summary and request approval.

### Gate 1 Enforcement

Per `rules/gate-rules.md`:
- Plan file exists with all required sections (Goal, Context, Scope, Constraints, Acceptance Criteria)
- Validation script outputs `PLAN_COMPLETE`
- Human has explicitly typed approval (not inferred from silence)

No code is written. No tests are written. This phase produces documentation only.

### Output

A plan directory at `tasks/plans/YYMMDD-feature-name/` with plan.md + reports/, awaiting human approval.

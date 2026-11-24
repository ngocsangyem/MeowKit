# Step 3: Draft the Plan

Write `plan.md` and, for the hard family, the phase files. Done when `plan.md` exists (at most 80 lines), every phase it lists has a file in the same directory, and `plan_dir` is known. Product-level mode uses `step-03a-product-spec.md` instead.

Create `tasks/plans/YYMMDD-{slug}/` if step 1 did not (fast and spike skip step 1). If `intake_packet_path` is set, move the packet to `{plan_dir}/research/plan-intake-packet.md` and read it before the research reports; cite it like any report.

## 3a. plan.md

Frontmatter: `title` (an outcome), `type` (feature | bug-fix | refactor | security), `status: draft`, `priority`, `effort` (xs-xl), `created`, `model` (the workflow model), `blockedBy`, `blocks`. Sections: `## Goal` (one sentence saying what done looks like, not what to do), `## Context` (2-5 bullets, plus prior learnings from memory, and `scope: EXPANSION|HOLD|REDUCTION` for hard-family plans so `mk:plan-ceo-review` need not ask again), `## Phases` table (phase link, status, effort, depends on), `## Key Deliverables`, `## Constraints` (imperative: "Do not...", "Preserve..."), `## Risk Assessment` (risk, likelihood, impact, mitigation). Fast mode has no phase files: write Goal, Context, Scope, Constraints, Technical Approach and Acceptance Criteria from `assets/plan-template.md`; no Phases table.

Carry-ins:
- `## User-Confirmed Decisions`: when the intake packet lists decisions a human already made, copy them with `locked: user-confirmed`. Step 5 must escalate any proposal to cut one.
- `## Autonomy Boundaries`: only for long-horizon plans (hard family, 3+ phases, or scale-routing level `high`). State the extra latitude specific to this task: reversible choices the executor may make alone, and reversible-but-significant ones to ask about first. Do not restate rules the baseline already carries (security, tests, naming, scope, budget); hard stops live in `.claude/rules/security-rules.md` and `.claude/rules/injection-rules.md`.

## 3b. Phase files (hard family)

Start from `references/phase-template.md`: YAML frontmatter (`phase`, `title`, `status: pending`, `priority`, `effort`, `dependencies` as integers) plus the 12 sections. `status` is always `pending` at creation. Implementation Steps stay at contract level (behaviour, boundaries, invariants); add file-level detail only when the executor needs it. Before the Architecture, Risk and Security sections, use `references/solution-design-checklist.md`, skipping dimensions that do not apply.

Every Key Insight, Risk, Requirement and Constraint carries `from: <path>` or `[ASSUMPTION]`; an unresolved assumption also states `Breaks if:` and `Then:`. Each phase's Context Links include at least one `research/` report when reports exist.

Splitting: default to vertical slices, each one thin end-to-end path that leaves the system runnable; give a phase of its own only to shared groundwork (migrations, shared types, config), setup, substantial leftover testing, or major docs. At most 7 phases. Split a phase whose title contains "and" or that holds two separable deliverables; merge two that cannot ship alone. Do not split on acceptance-criteria count. With `--parallel`, file ownership governs the split instead.

## 3c. Conditional additions

| Condition | Do |
|---|---|
| `tdd_mode` | Follow `references/tdd-mode.md`: add `tdd: true`, `regression_gate`, and the Tests Before / Protected Change / Tests After / Regression Gate sections |
| Design evidence packet in the invocation | Follow `references/design-evidence-consumption.md`; cite packet fields, never call the design tool or re-parse raw design JSON; set `blocked_on:` only on the affected phase |
| `deep` | After the phase files exist, scout each phase's Related Code Files (max 3 tool calls per phase, 12 inventory rows) and add `## Deep Phase Map` per `references/deep-mode.md` |
| `parallel` | Assign `ownership` globs and `parallel_group` per `references/parallel-mode.md`; add `## Execution Strategy` |
| `two` | Write `plan-approach-a.md` and `plan-approach-b.md` (`status: pending`) and `trade-off-matrix.md` from `references/two-approach-mode.md`; no `plan.md` or phase files until step 4 selects one; create `archived/` |
| Overlapping unfinished plans found at step 1 | Set `blockedBy` / `blocks` in both plans; if the direction is ambiguous, make it an interview question |
| `spike` | Use `assets/spike-plan-template.md` (two phases, no test or ship) |

## Next

`step-04-semantic-checks.md`

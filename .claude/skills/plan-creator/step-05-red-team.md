# Step 5: Red Team

Hard family only. Reviewers attack the plan, you adjudicate, the user decides what to apply. Done when `red-team-findings.md` exists in the plan directory, accepted findings are applied, and the consistency sweep reports no unresolved contradiction (or the user chose how to proceed).

## 5a. Pick lenses and reviewers

Lenses live in `prompts/personas.md`. By phase count: 1-3 phases use Assumption Destroyer and Scope Critic; 4-5 add Security Adversary; 6 or more add Failure Mode Analyst.

When the plan is small (one or two phases) you may run the lenses yourself in turn instead of delegating. Otherwise delegate each lens to a read-only reviewer subagent. The brief gives:

- Goal: find flaws in this plan (a document, not code) through one named lens.
- Plan: the plan directory path and the file list (`plan.md`, each `phase-XX-*.md`). Reviewers open the files themselves; do not paste the plan into the brief.
- Fixed constraints: items marked `locked: user-confirmed` and decisions the plan records as made; a reviewer may question them but not assume them away.
- Return: findings in the format in `prompts/personas.md`, plus the blind-spot line.

## 5b. Collect

Drop findings with no quote and no `file:line`. Merge findings with the same location and flaw, keeping the higher severity. Sort Critical, High, Medium and keep at most 15; promoted cross-cutting findings are never the ones dropped.

Blind spots: when two or more lenses independently name the same under-covered dimension, promote it to one High `cross-cutting` finding that quotes both. A blind spot only one lens names is a noted concern in the report, not a finding. Zero findings is fine: record `Findings: none` and move on.

## 5c. Adjudicate and ask

Mark each finding Accept (valid and actionable) or Reject (noise, already addressed, out of scope, speculative) with a one-line reason. A finding that proposes cutting a `locked: user-confirmed` item always goes to the user; never accept or apply it silently.

If the findings show the approach cannot meet the goal, or two research directions are incompatible, stop patching: tell the user what you found and ask whether to rework the plan, return to step 3, or drop it. Do not patch around a broken premise. In an `--advice` run this is the RESCUE checkpoint (`references/advice-checkpoints.md`).

Ask the user: apply all accepted findings (recommended), review each one (apply, skip or modify), or reject all. Show counts by severity and the accepted list. Ask in plain words if the runtime has no structured question tool.

## 5d. Apply and record

Apply approved findings: Critical and High go to the affected phase's Risk Assessment, Medium to Key Insights, each prefixed `[RED TEAM]`.

Write `{plan_dir}/red-team-findings.md`: date, lenses used, counts by severity and disposition, then each finding with its fields, disposition, rationale and where it was applied, then the blind-spot table and noted concerns. If one exists, rename it to `red-team-findings-{YYMMDD}.md` first. Append a short `## Red Team Review` table to `plan.md` (finding, severity, disposition, applied to) linking the full report; add a `### Session` subsection when one already exists.

## 5e. Consistency sweep

Run the whole-plan consistency sweep in `references/whole-plan-sweep.md` with `delta_source = accepted_findings`, in your own context (never delegated). If contradictions stay unresolved, the user chooses: apply the pending edits and defer the rest to the interview, apply and resolve now (two attempts at most), or skip the sweep; a skip leaves the staged edits recorded in `red-team-findings.md` and phase files untouched.

## Next

`step-06-validation-interview.md`

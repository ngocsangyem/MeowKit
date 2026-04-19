# Post-Review

## Handoff Note Cleanup

After producing the Completion Summary, clean up any handoff notes for this branch —
the review is complete and the context is no longer needed.

```bash
eval "$(.claude/scripts/bin/meowkit-slug 2>/dev/null)"
rm -f .claude/memory/projects/*-$BRANCH-ceo-handoff-*.md 2>/dev/null || true
```

## Review Log

After producing the Completion Summary above, persist the review result.

**PLAN MODE EXCEPTION — ALWAYS RUN:** This command writes review metadata to
`.claude/memory/` (user config directory, not project files). The skill preamble
already writes to `.claude/memory/sessions/` and `.claude/memory/` — this is
the same pattern. The review dashboard depends on this data. Skipping this
command breaks the review readiness dashboard in /ship.

```bash
.claude/scripts/bin/meowkit-review-log '{"skill":"plan-ceo-review","timestamp":"TIMESTAMP","status":"STATUS","unresolved":N,"critical_gaps":N,"mode":"MODE","scope_proposed":N,"scope_accepted":N,"scope_deferred":N,"commit":"COMMIT"}'
```

Before running this command, substitute the placeholder values from the Completion Summary you just produced:
- **TIMESTAMP**: current ISO 8601 datetime (e.g., 2026-03-16T14:30:00)
- **STATUS**: "clean" if 0 unresolved decisions AND 0 critical gaps; otherwise "issues_open"
- **unresolved**: number from "Unresolved decisions" in the summary
- **critical_gaps**: number from "Failure modes: ___ CRITICAL GAPS" in the summary
- **MODE**: the mode the user selected (SCOPE_EXPANSION / SELECTIVE_EXPANSION / HOLD_SCOPE / SCOPE_REDUCTION)
- **scope_proposed**: number from "Scope proposals: ___ proposed" in the summary (0 for HOLD/REDUCTION)
- **scope_accepted**: number from "Scope proposals: ___ accepted" in the summary (0 for HOLD/REDUCTION)
- **scope_deferred**: number of items deferred to TODOS.md from scope decisions (0 for HOLD/REDUCTION)
- **COMMIT**: output of `git rev-parse --short HEAD`

## Review Readiness Dashboard

After completing the review, read the review log and config to display the dashboard.

```bash
.claude/scripts/bin/meowkit-review-log
```

Parse the output. Find the most recent entry for each skill (plan-ceo-review, plan-ceo-review, review, plan-design-review, design-review-lite, adversarial-review, codex-review, codex-plan-review). Ignore entries with timestamps older than 7 days. For the Eng Review row, show whichever is more recent between `review` (diff-scoped pre-landing review) and `plan-ceo-review` (plan-stage architecture review). Append "(DIFF)" or "(PLAN)" to the status to distinguish. For the Adversarial row, show whichever is more recent between `adversarial-review` (new auto-scaled) and `codex-review` (legacy). For Design Review, show whichever is more recent between `plan-design-review` (full visual audit) and `design-review-lite` (code-level check). Append "(FULL)" or "(LITE)" to the status to distinguish. Display:

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  0   | —                   | —         | no       |
| Design Review   |  0   | —                   | —         | no       |
| Adversarial     |  0   | —                   | —         | no       |
| Outside Voice   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

**Review tiers:**
- **Eng Review (required by default):** The only review that gates shipping. Covers architecture, code quality, tests, performance. Can be disabled globally with `meowkit-config set skip_eng_review true` (the "don't bother me" setting).
- **CEO Review (optional):** Use your judgment. Recommend it for big product/business changes, new user-facing features, or scope decisions. Skip for bug fixes, refactors, infra, and cleanup.
- **Design Review (optional):** Use your judgment. Recommend it for UI/UX changes. Skip for backend-only, infra, or prompt-only changes.
- **Adversarial Review (automatic):** Auto-scales by diff size. Small diffs (<50 lines) skip adversarial. Medium diffs (50–199) get one Claude adversarial pass. Large diffs (200+) get two Claude adversarial passes (attack-surface + failure-mode). No configuration needed.
- **Outside Voice (optional):** Independent plan review from a Claude adversarial subagent with fresh context. Offered after all review sections complete in /meow:plan-ceo-review. Never gates shipping.

**Verdict logic:**
- **CLEARED**: Eng Review has >= 1 entry within 7 days from either `review` or `plan-ceo-review` with status "clean" (or `skip_eng_review` is `true`)
- **NOT CLEARED**: Eng Review missing, stale (>7 days), or has open issues
- CEO and Design reviews are shown for context but never block shipping
- If `skip_eng_review` config is `true`, Eng Review shows "SKIPPED (global)" and verdict is CLEARED

**Staleness detection:** After displaying the dashboard, check if any existing reviews may be stale:
- Parse the `---HEAD---` section from the bash output to get the current HEAD commit hash
- For each review entry that has a `commit` field: compare it against the current HEAD. If different, count elapsed commits: `git rev-list --count STORED_COMMIT..HEAD`. Display: "Note: {skill} review from {date} may be stale — {N} commits since review"
- For entries without a `commit` field (legacy entries): display "Note: {skill} review from {date} has no commit tracking — consider re-running for accurate staleness detection"
- If all reviews match the current HEAD, do not display any staleness notes

## Plan File Review Report

After displaying the Review Readiness Dashboard in conversation output, also update the
**plan file** itself so review status is visible to anyone reading the plan.

### Detect the plan file

1. Check if there is an active plan file in this conversation (the host provides plan file
   paths in system messages — look for plan file references in the conversation context).
2. If not found, skip this section silently — not every review runs in plan mode.

### Generate the report

Read the review log output you already have from the Review Readiness Dashboard step above.
Parse each JSONL entry. Each skill logs different fields:

- **plan-ceo-review**: `status`, `unresolved`, `critical_gaps`, `mode`, `scope_proposed`, `scope_accepted`, `scope_deferred`, `commit`
  → Findings: "{scope_proposed} proposals, {scope_accepted} accepted, {scope_deferred} deferred"
  → If scope fields are 0 or missing (HOLD/REDUCTION mode): "mode: {mode}, {critical_gaps} critical gaps"
- **plan-ceo-review**: `status`, `unresolved`, `critical_gaps`, `issues_found`, `mode`, `commit`
  → Findings: "{issues_found} issues, {critical_gaps} critical gaps"
- **plan-design-review**: `status`, `initial_score`, `overall_score`, `unresolved`, `decisions_made`, `commit`
  → Findings: "score: {initial_score}/10 → {overall_score}/10, {decisions_made} decisions"
- **outside-voice**: `status`, `findings`, `findings_fixed`
  → Findings: "{findings} findings, {findings_fixed}/{findings} fixed"

All fields needed for the Findings column are now present in the JSONL entries.
For the review you just completed, you may use richer details from your own Completion
Summary. For prior reviews, use the JSONL fields directly — they contain all required data.

Produce this markdown table:

```markdown
## MEOWKIT REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/meow:plan-ceo-review` | Scope & strategy | {runs} | {status} | {findings} |
| Outside Voice | Claude adversarial subagent | Independent 2nd opinion | {runs} | {status} | {findings} |
| Design Review | `/plan-design-review` | UI/UX gaps | {runs} | {status} | {findings} |
```

Below the table, add these lines (omit any that are empty/not applicable):

- **OUTSIDE VOICE:** (only if outside-voice ran) — one-line summary of findings
- **CROSS-PASS:** (only if multiple reviewer passes ran) — overlap analysis
- **UNRESOLVED:** total unresolved decisions across all reviews
- **VERDICT:** list reviews that are CLEAR (e.g., "CEO + ENG CLEARED — ready to implement").
  If Eng Review is not CLEAR and not skipped globally, append "eng review required".

### Write to the plan file

**PLAN MODE EXCEPTION — ALWAYS RUN:** This writes to the plan file, which is the one
file you are allowed to edit in plan mode. The plan file review report is part of the
plan's living status.

- Search the plan file for a `## MEOWKIT REVIEW REPORT` section **anywhere** in the file
  (not just at the end — content may have been added after it).
- If found, **replace it** entirely using the Edit tool. Match from `## MEOWKIT REVIEW REPORT`
  through either the next `## ` heading or end of file, whichever comes first. This ensures
  content added after the report section is preserved, not eaten. If the Edit fails
  (e.g., concurrent edit changed the content), re-read the plan file and retry once.
- If no such section exists, **append it** to the end of the plan file.
- Always place it as the very last section in the plan file. If it was found mid-file,
  move it: delete the old location and append at the end.

## Next Steps — Review Chaining

After displaying the Review Readiness Dashboard, recommend the next review(s) based on what this CEO review discovered. Read the dashboard output to see which reviews have already been run and whether they are stale.

**Recommend /meow:plan-ceo-review if eng review is not skipped globally** — check the dashboard output for `skip_eng_review`. If it is `true`, eng review is opted out — do not recommend it. Otherwise, eng review is the required shipping gate. If this CEO review expanded scope, changed architectural direction, or accepted scope expansions, emphasize that a fresh eng review is needed. If an eng review already exists in the dashboard but the commit hash shows it predates this CEO review, note that it may be stale and should be re-run.

**Recommend /plan-design-review if UI scope was detected** — specifically if Section 11 (Design & UX Review) was NOT skipped, or if accepted scope expansions included UI-facing features. If an existing design review is stale (commit hash drift), note that. In SCOPE REDUCTION mode, skip this recommendation — design review is unlikely relevant for scope cuts.

**If both are needed, recommend eng review first** (required gate), then design review.

Use AskUserQuestion to present the next step. Include only applicable options:
- **A)** Run /meow:plan-ceo-review next (required gate)
- **B)** Run /plan-design-review next (only if UI scope detected)
- **C)** Skip — I'll handle reviews manually

## docs/designs Promotion (EXPANSION and SELECTIVE EXPANSION only)

At the end of the review, if the vision produced a compelling feature direction, offer to promote the CEO plan to the project repo. AskUserQuestion:

"The vision from this review produced {N} accepted scope expansions. Want to promote it to a design doc in the repo?"
- **A)** Promote to `docs/designs/{FEATURE}.md` (committed to repo, visible to the team)
- **B)** Keep in `.claude/memory/projects/` only (local, personal reference)
- **C)** Skip

If promoted, copy the CEO plan content to `docs/designs/{FEATURE}.md` (create the directory if needed) and update the `status` field in the original CEO plan from `ACTIVE` to `PROMOTED`.

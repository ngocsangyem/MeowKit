# Step 3: Triage

Categorize findings to separate signal from noise. Only current-change findings block shipping.

## Coverage Check (assured PR mode only)

When this review runs against a `mewkit review prepare` session (assured PR mode),
run the coverage check BEFORE composing the verdict:

```bash
mewkit review coverage --session <session-id> --json
```

- **Non-zero exit → STOP.** Do not compose a verdict. The JSON `gaps[]` names each
  missing reviewer / unread brief / unopened diff / missing required read. Re-run only
  the named reviewer(s) through the wrapper, then re-run coverage. Coverage failure is
  never waved through.
- **`evidenceLevel: attested`** (CLI receipts without hook corroboration — the normal
  case for subagent-driven reviews on this host, per the capability spike): the review
  may proceed to a verdict, but **Approve is capped** — `mewkit review compose`
  refuses PASS/Approve on an attested session. Disclose this in the
  verdict: "evidence level: attested — session-observed access recorded via CLI
  receipts; individual-reviewer provenance is not host-provable."
- **`evidenceLevel: session-observed`** (hook-corroborated, driving-session reads):
  full Approve eligibility. **Honesty caveat:** the evidence logs are session-dir
  files the acting session can write, so `session-observed` is *anti-accidental*
  corroboration, not tamper-proof, and never establishes independent-reviewer
  provenance. It is evidence a human reads, not authority on its own.

Skip this coverage check for branch-diff / `--pending` / commit reviews (no session).

## Challenger Policy

A finding needs `file:line` (or a quote from the plan, for a plan review). Before categorizing, drop every finding from Phase A and Phase B that has neither.

**If no finding survives:** the review is clean. Say so in the verdict, and do not re-run a reviewer to find something: a pass forced to produce findings produces unsupported ones. No finding is a valid result.

**If findings remain:** proceed to categorization below.

## Categories

### current-change
Finding is directly caused by or related to the current diff.
**Action:** Must be addressed before the change ships.

### incidental
Finding exists in code touched by the diff but is NOT caused by the current change.
Pre-existing tech debt, style inconsistencies, or unrelated issues.
**Action:** Log to `tasks/backlog/review-backlog.md` for future addressing. Does NOT hold up this change.
Create the file if it doesn't exist.

## Triage Rules

1. If the finding references a line ADDED in the diff → `current-change`
2. If the finding references a line MODIFIED in the diff → `current-change`
3. If the finding references unchanged code in a changed file → `incidental`
4. If the finding is about missing tests for NEW functionality → `current-change`
5. If the finding is about missing tests for EXISTING functionality → `incidental`
6. CRITICAL severity findings are ALWAYS `current-change` regardless of above rules

## Dedup

If multiple reviewers (including Phase B personas) flag the same issue (same file, same line, same category):
- Keep the highest severity version
- Note "confirmed by N reviewers" (higher confidence)
- Tag finding source: `[Phase A: reviewer-name]` or `[Phase B: persona-name]`

If a Phase B persona upgrades a Phase A WARN to FAIL:
- Keep the FAIL version with the persona's evidence
- Note: `"Upgraded from WARN by {persona}: {evidence}"`

## Output

Two lists:
1. **Current-change findings** — ordered by severity (CRITICAL first), with source tags
2. **Incidental findings** — for backlog

## Next

Read and follow `step-04-verdict.md`

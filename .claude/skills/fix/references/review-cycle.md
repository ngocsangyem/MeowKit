# Review cycle

The review loop after a fix. The richer version, with regression recovery and returned work, is `.claude/skills/cook/references/review-cycle.md`; this file only fixes what differs for a bug fix.

- **auto**: run the `reviewer` agent and fix critical findings, re-run the tests, and repeat up to three times; critical findings still open after three cycles go to the user (fix manually, approve anyway, or abort). With no critical finding left, log the warnings and PRESENT for user approval of the ship: do NOT self-approve and do NOT ship on your own. The score is display only and decides nothing.
- **review** (human in the loop): show the findings and ask the user what to do (fix critical, fix all, approve, abort); fix, re-test and re-review at most three cycles.
- **quick**: one auto-fix cycle before escalating; focus on correctness, security and regressions; still ends at ready-for-user-approval.

Findings that count as critical: security vulnerabilities, data-loss risks, breaking changes without a migration, and architectural violations. Performance problems are critical only when they show up in a measured path.

The risk flags from `SKILL.md` (AUTH, AUTHZ, DATA_MODEL, AUDIT_SEC, EXT_SYSTEM, PUBLIC_CONTRACT, WEAK_PROOF) force explicit human approval before finalizing, whatever the review outcome. The commit and push themselves go through the ship check.

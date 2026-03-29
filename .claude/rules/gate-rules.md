# Phase Gate Rules — HARD STOPS

These are hard stops. No automation may bypass them. No agent may self-approve.

## GATE 1 — After Phase 1 (Plan)

### Conditions for Approval

All must be true:

1. **Plan file exists** at `tasks/plans/YYMMDD-name.md`
2. **All required sections are populated:**
   - Problem: what problem this solves and for whom
   - Success Criteria: measurable definition of done
   - Technical Approach: how it will be built
3. **Human has explicitly typed approval.** Approval is not inferred from silence, delay, or ambiguous responses.

### What It Blocks

Proceeding to Phase 2 (Test RED) without an approved plan. No tests are written, no code is written, no reviews happen until the plan is approved.

### Exception

`/meow:fix` with complexity=simple bypasses Gate 1. The fix IS the plan — the scope is small enough that a separate planning document adds overhead without value.

## GATE 2 — After Phase 4 (Review)

### Conditions for Approval

All must be true:

1. **Verdict file exists** at `tasks/reviews/YYMMDD-name-verdict.md`
2. **No FAIL dimensions** in the verdict (all 5 dimensions must be PASS or WARN)
3. **All WARN items acknowledged** by human (each WARN explicitly seen and accepted)
4. **Security scan shows no BLOCK items** (from security-rules)
5. **Human has explicitly typed approval.** Same standard as Gate 1 — explicit, not inferred.

### What It Blocks

Proceeding to Phase 5 (Ship). No commit, no PR, no deploy until Gate 2 passes.

### Exceptions

None. Every change ships through Gate 2. There are no exceptions to Gate 2, regardless of:
- Mode (even fast mode checks for BLOCKs)
- Urgency
- Size of change
- Who requested it

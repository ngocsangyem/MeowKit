# Pre-Screen

Run before choosing a scope mode. It never rejects: it lists gaps with guidance and the user decides to amend (return to `mk:plan-creator`) or continue with the gaps noted in the verdict.

## Unfinished thinking

Scan the plan body for "TBD", "implement later", "similar to X", "add appropriate ...", "handle edge cases" with no examples, "if time permits", "pending approval". Skip headers, fenced code and "Not in scope" or "Deferred" sections (vagueness is expected there). Skip the scan in REDUCTION mode, where sparse plans are normal.

Report each hit with its location and what a specific version would say ("add appropriate error handling" becomes which errors and what handling).

## Required content

The plan states: the problem and who has it; binary success criteria; the technical approach (how, not only what); scope in and out; and risks with mitigations. List what is missing.

## Requirement coverage

Map each requirement in the problem statement to at least one phase step:

| Requirement | Mapped to | Status |
|---|---|---|
| User can reset password | Phase 2, step 3 | COVERED |
| Email notification sent | none | GAP |

With no explicit requirements list, extract them from the prose and say so.

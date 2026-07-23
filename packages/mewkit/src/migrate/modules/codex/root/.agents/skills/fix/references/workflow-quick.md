# Quick Workflow

Focused diagnose-fix-verify cycle for a known-cause, one- or two-file issue. No persistent artifacts or task-tracking overhead.

## Steps

### Step 1: Scout + Confirm Cause
- Read the exact error message or observed behavior.
- Locate the affected file and direct dependencies.
- Confirm the supplied cause against the code and symptom directly.
- If the cause is unclear, the issue is intermittent without bounded evidence, or the blast radius exceeds two files, stop and escalate to the Standard workflow before editing.

**Output:** `Step 1: Root cause — [brief description + direct evidence]`

### Step 2: Fix & Verify
Implement the smallest root-cause fix following local patterns. Run the exact focused command before and after the change; add a focused regression test when the behavior can regress.

**Output:** `Step 2: Fixed — [N] files, focused before/after result`

### Step 3: Complete
Return the root cause, changed files, and verification result inline. Do not create a plan, report, wiki candidate, memory entry, reviewer task, or commit prompt.

**Output:** `Step 3: Complete — [summary]`

## Notes
- If the direct cause or focused verification fails → escalate to Standard workflow
- Total steps: 3
- No planning phase needed

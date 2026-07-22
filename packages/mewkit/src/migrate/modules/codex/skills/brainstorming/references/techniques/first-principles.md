# Technique: First Principles Decomposition

## When to Apply
Novel problem with no existing patterns in codebase. Standard solutions don't fit.

## Process
1. State the fundamental constraint (what physics/business/technical law can't be violated)
2. Strip away all assumptions about HOW — keep only WHAT must be true
3. Rebuild from the constraint upward: what's the simplest thing that satisfies it?
4. Generate 3-5 ideas that each start from the constraint, not from convention

## Output Shape
**Constraint:** [fundamental truth]
**Ideas built from constraint:**
| # | Idea | How it satisfies constraint | What convention it breaks |
|---|------|---------------------------|--------------------------|

## Example
**Problem:** "How to handle 10GB file uploads on a 256MB server?"
**Constraint:** File must reach storage; server memory < 256MB at all times.
| # | Idea | Satisfies constraint | Breaks convention |
|---|------|---------------------|-------------------|
| 1 | Stream directly to S3 (proxy, no buffering) | Never holds file in memory | Breaks "upload then process" pattern |
| 2 | Client-side chunking + resumable upload | Each chunk < 5MB | Breaks single-request upload |
| 3 | Pre-signed URL (client uploads directly to S3) | Server never sees the file | Breaks server-mediated upload |

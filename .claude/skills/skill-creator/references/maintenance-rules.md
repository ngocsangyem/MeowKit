# Kit maintenance rules

For people maintaining the kit itself. Writing a skill does not need these, so `mk:skill-creator` does not load this file.

## Rule 8: Preserve Contracted Workflow Choices

When repairing a caller and command mismatch, migrate callers to the supported contract instead of inventing an unimplemented flag. New flags require an explicit owner decision and a complete implementation.

The canonical reports location is `tasks/reports/`; migrate legacy report-path references rather than preserving both locations. Host-level tool mapping is unverified, so a provider projection must remain conditional until the target host contract has been verified.

The default cook workflow stops before shipping. Shipping remains an explicit, human-approved action. A plan Insert or Split means taking the revised plan back to the user; Skip or Reorder must notify the user and leave an audit-log entry.

## Rule 9: Enforce Brand Prose Incrementally

Brand-prose lint remains diff-mode blocking: violations in changed files fail, while pre-existing untouched violations remain warnings. Revisit full-tree blocking only after a separately approved CI scope change and a clean baseline.

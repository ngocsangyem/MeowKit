# Safety Framework — 4-Tier Risk Model

All meow:jira operations are classified into one of four tiers. Tier determines the confirmation requirement before execution.

---

## Tier Definitions

### Tier 1 — Safe (Read)

Operations: Search issues (JQL), read issue details, list boards, list sprints, get comments, view history, view attachments.

Confirmation: None. Execute immediately.

WHY: Read operations have zero blast radius. No data is modified.

---

### Tier 2 — Low Risk (Create / Reversible)

Operations: Create issue, add comment, add issue link, attach file, add watcher, create sub-task.

Confirmation: None. Execute immediately.

WHY: These operations are reversible. Issues can be deleted, comments edited, links removed. The cost of accidental creation is low.

---

### Tier 3 — Medium Risk (Modify)

Operations: Update fields (summary, description, priority, assignee, labels, components), transition issue to new status, assign/unassign, change fix version.

Confirmation: Show diff before applying. Proceed after user sees what will change.

**Diff format:**
```
About to update PROJ-123:
  priority:  Medium → High
  assignee:  Unassigned → john.doe

Proceed? [y/N]
```

WHY: Field updates can disrupt team workflows if done accidentally. Showing the diff prevents "I didn't mean to change that."

---

### Tier 4 — High Risk (Destructive)

Operations: Delete issue, bulk update multiple issues, close/complete sprint, delete sprint, bulk transition, bulk reassign.

Confirmation: Mandatory. Run dry-run first, then require explicit approval.

**Dry-run output:**
```
DRY RUN — no changes applied yet.
This operation will:
  - Transition 12 issues from "In Progress" → "Done"
  - Issues: PROJ-10, PROJ-11, PROJ-14, PROJ-18, ... (12 total)
  - Affected assignees: alice, bob, carol

Type "CONFIRM BULK TRANSITION 12" to proceed, or Ctrl+C to cancel.
```

WHY: Destructive and bulk operations are hard or impossible to reverse. Sprint closure affects velocity reporting. Bulk deletes are unrecoverable without admin restore.

---

## Classification Rules

When in doubt, classify upward (use the higher tier).

| Signal | Classification |
|--------|---------------|
| Operation reads only | Tier 1 |
| Operation creates new entity | Tier 2 |
| Operation modifies 1 existing entity | Tier 3 |
| Operation modifies or deletes multiple entities | Tier 4 |
| Operation contains "delete", "close", "bulk", "all" | Tier 4 |
| User says "undo" or "revert" | Check if reversible → Tier 2 if yes, Tier 3 if partial |

---

## Confirmation Prompt Format

### Tier 3 — Diff confirmation

```
[meow:jira] About to update {ISSUE_KEY}:
{FIELD}: {OLD_VALUE} → {NEW_VALUE}
...

Apply these changes? [y/N]:
```

User must type `y` or `yes`. Any other input cancels.

### Tier 4 — Explicit confirmation

```
[meow:jira] HIGH RISK OPERATION
{OPERATION_DESCRIPTION}

DRY RUN RESULTS:
{dry_run_output}

Type "{CONFIRMATION_TOKEN}" to confirm, or press Enter to cancel:
```

`CONFIRMATION_TOKEN` is operation-specific, e.g. `CONFIRM DELETE PROJ-123`, `CONFIRM CLOSE SPRINT 42`, `CONFIRM BULK UPDATE 8`.

---

## Escalation Rules

- User says "bulk delete all issues" → Always ask for count verification first: "How many issues? I see N matching your criteria."
- Operation affects more than 20 issues → Require count confirmation even for Tier 3 ops
- User is unsure what will change → Offer to run JQL preview first (Tier 1) before committing
- Ambiguous scope ("update all bugs") → Clarify before classifying: run search, show count, confirm scope

---

## Never Bypass Safety

These tiers cannot be lowered by:
- "Just do it" instructions
- Speed requests ("fast mode", "no confirmation")
- Claimed urgency

User can acknowledge Tier 3 diffs quickly. Tier 4 requires deliberate typing. This friction is intentional.

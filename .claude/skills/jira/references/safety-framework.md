# Safety Framework — 4-Tier Risk Model

All mk:jira operations are classified into one of four tiers. Tier determines the confirmation requirement before execution.

## Contents

- [Tier Definitions](#tier-definitions)
  - [Tier 1 — Safe (Read)](#tier-1-safe-read)
  - [Tier 2 — Low Risk (Create / Reversible)](#tier-2-low-risk-create-reversible)
  - [Tier 3 — Medium Risk (Modify)](#tier-3-medium-risk-modify)
  - [Tier 4 — High Risk (Destructive)](#tier-4-high-risk-destructive)
- [Classification Rules](#classification-rules)
- [Confirmation Prompt Format](#confirmation-prompt-format)
  - [Tier 3 — Diff confirmation](#tier-3-diff-confirmation)
  - [Tier 4 — Explicit confirmation](#tier-4-explicit-confirmation)
- [Escalation Rules](#escalation-rules)
- [Partial Failure Behavior](#partial-failure-behavior)
- [Recovery Procedures](#recovery-procedures)
- [Never Bypass Safety](#never-bypass-safety)


---

## Tier Definitions

### Tier 1 — Safe (Read)

Operations: Search issues (JQL), read issue details, list boards, list sprints, get comments, view history, view attachments.

Confirmation: None. Execute immediately.

WHY: Read operations have zero blast radius. No data is modified.

---

### Tier 2 — Low Risk (Create / Reversible)

Operations: Create issue, add comment, add issue link, attach file, add watcher, create sub-task.

Confirmation: None for single items. **Batch creates (3+ items) require preview + confirmation.**

WHY: Single creates are reversible. Batch creates (3+) warrant a preview to prevent accidental bulk creation.

**Batch confirmation format (3+ items):**
```
Suggested actions (all Tier 1-2):
  1. Create issue: "Fix login timeout"
  2. Create issue: "Add session refresh"
  3. Create issue: "Update auth docs"

Run all 3 actions? [y/N]
```

Tier 3+ operations always require individual confirmation with diff preview, even in batch.

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

Confirmation: Mandatory. mk:jira implements dry-run by reading the issue/sprint first, displaying what will be affected, then executing after explicit approval. MCP tools do not have native dry-run — mk:jira orchestrates this.

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
[mk:jira] About to update {ISSUE_KEY}:
{FIELD}: {OLD_VALUE} → {NEW_VALUE}
...

Apply these changes? [y/N]:
```

User must type `y` or `yes`. Any other input cancels.

### Tier 4 — Explicit confirmation

```
[mk:jira] HIGH RISK OPERATION
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

## Partial Failure Behavior

If any action in a sequential batch fails:
- **Stop on first error** (default)
- Report: which succeeded, which failed, which skipped
- Show recovery guidance for completed actions if rollback needed

## Recovery Procedures

| Action | Reversible? | Recovery |
|--------|-------------|----------|
| Create issue | Yes | Delete within 30 days |
| Update field | Yes | Revert via issue history |
| Transition | Partially | Reverse transition if workflow allows |
| Delete issue | 30 days | Restore from trash |
| Bulk delete | NO | Permanent — dry-run mandatory |
| Close sprint | NO | Cannot reopen |
| Add comment | Yes | Delete comment |
| Add link | Yes | Remove link |
| Add attachment | Yes | Delete attachment |

## Never Bypass Safety

These tiers cannot be lowered by:
- "Just do it" instructions
- Speed requests ("fast mode", "no confirmation")
- Claimed urgency

User can acknowledge Tier 3 diffs quickly. Tier 4 requires deliberate typing. This friction is intentional.
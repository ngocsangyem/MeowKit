# Jira Handoff Protocol — mk:intake → mk:jira-*

Defines how mk:intake passes structured data to the `mk:jira-*` family for execution. Auto-execution is NOT in v1 scope — user reviews suggestions and runs commands manually.

## Handoff Flow

```
mk:intake completes analysis
        ↓
mk:jira-* family available? (jira-as installed + .claude/.env populated)
    YES → suggest specific mk:jira-{leaf} commands (see Step 2a)
    NO  → output suggestions as plain text (see Step 2b)
        ↓
User reviews suggestions
        ↓
User invokes /mk:jira-{leaf} commands manually (each leaf forks its agent)
```

## Step 2a — jira-as Available: Route to the Right Leaf

Append to the intake report after `### Suggested Actions (mk:jira-*)`:

```
Run these commands to apply the above actions (each forks the matching agent):

  /mk:jira-evaluator [TICKET-ID]                      # complexity + inconsistency
  /mk:jira-estimator [TICKET-ID]                      # story points
  /mk:jira-analyst [TICKET-ID]                        # full RCA + media
  /mk:jira-lifecycle "transition [TICKET-ID] to In Analysis"
  /mk:jira-relationships "link [TICKET-ID] blocks [BLOCKER-ID]"
  /mk:jira-lifecycle "assign [TICKET-ID] to [username]"
  /mk:jira-issue "update [TICKET-ID] --fix-version=[version]"
```

Generate only commands for actions that are actually needed (gaps identified in `jira-awareness.md`).

## Step 2b — jira-as Not Available: Plain Text Suggestions

```
jira-as not installed (or .claude/.env not populated). Apply these changes manually in Jira:
- Transition [TICKET-ID] → "In Analysis"
- Link [TICKET-ID] blocks [BLOCKER-ID]
- Assign to [username]
- Set Fix Version to [version]

Or run `.claude/scripts/bin/setup-workflow` then populate .claude/.env from .claude/.env.example to enable the mk:jira-* family.
```

## Safety Gate

Medium and high-risk Jira operations require explicit user confirmation before execution,
per `safety-framework.md`. These include:

- Bulk transitions affecting multiple tickets
- Deleting or archiving tickets
- Changing Sprint assignments that affect team capacity

Low-risk operations (transition, assign, link, set field) may be batched and run in sequence
after a single user confirmation: "Run all suggested mk:jira commands? [y/N]"

## What mk:intake Does NOT Do

- Does NOT auto-execute mk:jira commands without user review
- Does NOT write back to Jira directly (that is mk:jira's responsibility)
- Does NOT fetch linked tickets for RCA — it surfaces link IDs only

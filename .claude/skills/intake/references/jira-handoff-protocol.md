# Jira Handoff Protocol — mk:intake → mk:jira

Defines how mk:intake passes structured data to mk:jira for execution.
Auto-execution is NOT in v1 scope — user reviews suggestions and runs commands manually.

## Handoff Flow

```
mk:intake completes analysis
        ↓
Atlassian MCP detected?
    YES → suggest specific mk:jira commands (see Step 2a)
    NO  → output suggestions as plain text (see Step 2b)
        ↓
User reviews suggestions
        ↓
User runs /mk:jira commands manually
```

## Step 2a — MCP Available: Suggest Specific Commands

Append to the intake report after `### Suggested Actions (mk:jira)`:

```
Run these commands to apply the above actions:

  /mk:jira evaluate [TICKET-ID]
  /mk:jira estimate [TICKET-ID]
  /mk:jira analyze [TICKET-ID]
  /mk:jira transition [TICKET-ID] "In Analysis"
  /mk:jira link [TICKET-ID] blocks [BLOCKER-ID]
  /mk:jira update [TICKET-ID] --set assignee=[username]
  /mk:jira update [TICKET-ID] --set fixVersions=[version]
```

Generate only commands for actions that are actually needed (gaps identified in `jira-awareness.md`).

## Step 2b — No MCP: Plain Text Suggestions

```
No Atlassian MCP detected. Apply these changes manually in Jira:
- Transition [TICKET-ID] → "In Analysis"
- Link [TICKET-ID] blocks [BLOCKER-ID]
- Assign to [username]
- Set Fix Version to [version]
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

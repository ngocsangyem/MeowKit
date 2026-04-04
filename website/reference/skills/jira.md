---
title: "meow:jira"
description: "Jira operations via Atlassian MCP: create, search, update, transition, link, sprint management."
---

# meow:jira

Jira execution via Atlassian MCP. Create issues, search with JQL, update fields, transition workflow states, link issues, manage sprints.

## What This Skill Does

meow:jira is the **execution layer** for Jira operations in MeowKit. It receives structured commands — from meow:intake analysis output, from meow:cook during feature implementation, or directly from you — and translates them into Atlassian MCP calls.

It handles 8 operation categories: create, search, read, update, transition, link, sprint, and batch. A 4-tier safety framework gates operations by risk level: read operations run immediately, create operations proceed without confirmation (reversible), modify operations show a diff before applying, and destructive operations require explicit confirmation plus a dry-run preview.

meow:jira never processes raw ticket text. If you pass a multi-line description that looks like a Jira ticket, it will refuse and redirect you to `/meow:intake`. Ticket analysis is meow:intake's job — meow:jira only executes structured actions after analysis is complete.

## Core Capabilities

- **Create** — Bug, Story, Epic, Task, Sub-task with field validation and issue templates
- **Search** — JQL queries with a 50+ pattern library; named patterns like `my-open-work`
- **Read** — Full issue details, comments, attachments, change history
- **Update** — Modify fields (summary, description, priority, assignee, labels) with diff preview
- **Transition** — Move through workflow states with dynamic required-field discovery
- **Link** — blocks, is-blocked-by, relates-to, duplicates, clones
- **Sprint** — Board queries, sprint CRUD, add/remove issues, velocity data
- **Batch** — Bulk create from template, bulk update (always requires dry-run confirm)

## When to Use

::: tip Use meow:jira for execution
After meow:intake produces analysis and suggested actions, run meow:jira to execute them:
`/meow:jira transition PRD-123 "In Analysis"`
`/meow:jira link PRD-123 blocks BUG-045`
`/meow:jira assign PRD-123 alice`
:::

::: warning Use meow:intake first for analysis
meow:jira is an execution skill — it does not analyze tickets, score completeness, or suggest actions. Run `/meow:intake` first for ticket analysis, then use meow:jira to execute the structured output.
:::

## Prerequisites

meow:jira requires the Atlassian MCP server.

**Option 1: Claude CLI (recommended)**
```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
```
Uses Atlassian Rovo's hosted MCP endpoint. Claude Code handles OAuth — no API token needed.

**Option 2: Self-hosted via `.mcp.json`**
```json
{
  "mcpServers": {
    "atlassian": {
      "command": "npx",
      "args": ["-y", "@anthropic/atlassian-mcp-server"],
      "env": {
        "ATLASSIAN_SITE_URL": "https://your-company.atlassian.net",
        "ATLASSIAN_USER_EMAIL": "your-email@company.com",
        "ATLASSIAN_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Usage

```bash
# Create a bug
/meow:jira create --project PROJ --type Bug --summary "Login fails after 24h" --priority High

# Search with JQL
/meow:jira search --jql "assignee = currentUser() AND sprint in openSprints()"
/meow:jira search --pattern my-open-work

# Read issue details
/meow:jira read PROJ-123 --comments --history

# Transition
/meow:jira transition PROJ-123 "In Progress"
/meow:jira transition PROJ-123 Done --resolution Fixed

# Link issues
/meow:jira link PROJ-123 blocks PROJ-456

# Sprint management
/meow:jira sprint --board "Team Alpha" --list-sprints
/meow:jira sprint --sprint active --add PROJ-123,PROJ-456
```

## Safety Framework

| Tier | Operations | Confirmation |
|------|-----------|-------------|
| Safe (read) | Search, read, list boards/sprints | None — always allowed |
| Low (create) | Create issue, add comment, add link | None — reversible |
| Medium (modify) | Update fields, transition, assign | Show diff before applying |
| High (destructive) | Delete, bulk update, close sprint | Mandatory confirm + dry-run |

## JQL Quick Reference

Ten most useful patterns from the 50+ template library:

```jql
# My open work in current sprint
assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC

# In-progress or in-review
assignee = currentUser() AND status in ("In Progress", "In Review")

# Critical bugs unassigned
type = Bug AND assignee is EMPTY AND priority in (Critical, Blocker)

# Bugs needing triage
type = Bug AND created >= -7d AND resolution = Unresolved ORDER BY priority DESC

# Sprint backlog without points
project = PROJ AND sprint in openSprints() AND "Story Points" is EMPTY

# Overdue items
due < now() AND status != Done ORDER BY due ASC

# Stale in-progress
status = "In Progress" AND updated < -5d ORDER BY updated ASC

# Recent bugs I reported
type = Bug AND reporter = currentUser() AND resolution = Unresolved

# Pending for sprint planning
project = PROJ AND sprint is EMPTY AND status = "To Do" ORDER BY priority ASC

# Ready to deploy (Done this sprint)
sprint = CURRENT_SPRINT AND status = Done ORDER BY resolutiondate DESC
```

## Security

**Raw ticket detection:** If input contains multi-line text with patterns like "Steps to Reproduce", "Acceptance Criteria", or "As a user", meow:jira REFUSES and redirects to meow:intake. This prevents the Rule of Two violation where a single skill processes untrusted input, accesses auth data, and changes state simultaneously.

**MCP trust:** meow:jira trusts Atlassian MCP for auth and API safety. Keep Atlassian MCP updated for security patches — meow:jira inherits any MCP vulnerabilities.

## Integrated Workflows

| Workflow | Skills Chain | Status |
|----------|-------------|--------|
| PRD Intake | scale-routing → intake → **jira** | ✅ Available |
| Bug Fix | fix → investigate → **jira** (update ticket) | 🔜 Planned |
| Ship Code | cook → ship → **jira** (mark deployed) | 🔜 Planned |
| Sprint Planning | **jira** (search backlog, manage sprint) | ✅ Available |
| Retrospective | retro → **jira** (pull sprint data) | 🔜 Planned |

## Gotchas

- **No MCP = no operations.** meow:jira cannot fall back to anything — it requires the Atlassian MCP server. If MCP is unavailable, it reports install instructions and stops.
- **Safety confirms on medium/high ops.** Transitions and updates show a diff before applying. Destructive operations block until you explicitly confirm. This is intentional.
- **Custom fields need discovery first.** Jira projects often have required custom fields with IDs like `customfield_10016`. Run `meow:jira discover-fields --project PROJ` to list them before creating issues.
- **Workflow-specific required fields.** Some transitions require fields (e.g. "Resolution" for Done). meow:jira discovers these dynamically but will block if required fields are missing.
- **Rate limits on bulk ops.** Batch operations hit Jira API rate limits on large projects. Use `--dry-run` first to preview, then execute with reasonable batch sizes.

## Related

- [meow:intake](/reference/skills/intake) — ticket analysis and structured handoff to meow:jira
- [meow:scale-routing](/reference/skills/scale-routing) — product area classification upstream of intake
- [meow:cook](/reference/skills/cook) — feature pipeline that creates Jira tickets during Phase 3
- [meow:fix](/reference/skills/fix) — bug fix pipeline (planned: auto-transition on merge)
- [meow:ship](/reference/skills/ship) — ship pipeline (planned: auto-transition to Deployed)
- [meow:retro](/reference/skills/retro) — retrospective (planned: pull sprint velocity from Jira)

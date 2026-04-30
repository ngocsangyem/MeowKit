---
title: "mk:jira"
description: "Jira execution & ticket intelligence via Atlassian MCP: create, search, update, transition, link, sprint, evaluate complexity, estimate story points, analyze tickets."
---

# mk:jira

Jira execution & ticket intelligence via Atlassian MCP. Create issues, search with JQL, update fields, transition workflow states, link issues, manage sprints — plus evaluate ticket complexity, estimate story points, and analyze ticket context.

## What This Skill Does

mk:jira is the **execution and evaluation layer** for Jira operations in MeowKit. It receives structured commands — from mk:intake analysis output, from mk:cook during feature implementation, or directly from you — and translates them into Atlassian MCP calls.

It handles 10 operation categories across two modes:

- **Execute mode** — CRUD operations: create, search, read, update, transition, link, sprint, batch, add comment, add attachment
- **Agent mode** — ticket intelligence: evaluate complexity, estimate story points, analyze ticket context

A 4-tier safety framework gates operations by risk level. Three internal `jira-*` agents handle reasoning-heavy tasks (evaluate, estimate, analyze) while simple CRUD runs inline.

mk:jira never processes raw ticket text. If you pass a multi-line description that looks like a Jira ticket, it will refuse and redirect you to `/mk:intake`.

## Core Capabilities

### Execute Mode (10 operations)

- **Create** — Bug, Story, Epic, Task, Sub-task with field validation and issue templates
- **Search** — JQL queries with a 15-pattern core library
- **Read** — Full issue details, comments, attachments, change history
- **Update** — Modify fields (summary, description, priority, assignee, labels) with diff preview
- **Transition** — Move through workflow states with dynamic required-field discovery
- **Link** — blocks, is-blocked-by, relates-to, duplicates, clones
- **Sprint** — Board queries, sprint CRUD, add/remove issues, velocity data
- **Batch** — Bulk create from template, bulk update (always requires dry-run confirm)
- **Add Comment** — Post structured comments to tickets (Tier 2)
- **Add Attachment** — Attach files to tickets (Tier 2)

### Agent Mode (ticket intelligence)

- **Evaluate** — Qualitative complexity assessment (Simple/Medium/Complex) with Fibonacci range, inconsistency detection, injection defense
- **Estimate** — Heuristic story point estimation with escalation triggers for uncertain tickets
- **Analyze** — Full ticket context analysis (description, comments, attachments, media) with structured RCA output

## When to Use

::: tip Use mk:jira for execution AND evaluation
```bash
# Ticket intelligence
/mk:jira evaluate PRD-123      # Complexity assessment
/mk:jira estimate PRD-123      # Story point estimation
/mk:jira analyze PRD-123       # Full context analysis

# Execution
/mk:jira transition PRD-123 "In Analysis"
/mk:jira link PRD-123 blocks BUG-045
```
:::

::: info Evaluate and estimate are read-only
The evaluate, estimate, and analyze commands read ticket data only — they never modify Jira state. Their output includes suggested `/mk:jira` commands you can run after reviewing.
:::

## Prerequisites

mk:jira requires a Jira MCP server. Two options are available:

### Option 1: Community server (recommended)

[mcp-atlassian](https://github.com/sooperset/mcp-atlassian) — 49 Jira tools, Cloud + Server/DC, ADF auto-conversion, custom fields, attachments, sprints, issue linking.

```bash
claude mcp add -e JIRA_URL=https://your-company.atlassian.net \
  -e JIRA_USERNAME=your-email@company.com \
  -e JIRA_API_TOKEN=your-api-token \
  atlassian -- uvx mcp-atlassian
```

Get your API token at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).

Or add to your `.mcp.json`:
```json
{
  "mcpServers": {
    "atlassian": {
      "command": "uvx",
      "args": ["mcp-atlassian"],
      "env": {
        "JIRA_URL": "https://your-company.atlassian.net",
        "JIRA_USERNAME": "your-email@company.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

Optional env vars: `JIRA_PROJECTS_FILTER` (restrict projects), `JIRA_READ_ONLY_MODE=true` (block writes).

### Option 2: Official Atlassian Rovo (Cloud-only)

[Atlassian MCP Server](https://github.com/atlassian/atlassian-mcp-server) — 13 Jira tools, OAuth 2.1, beta status.

```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
```

Uses browser OAuth — no API token needed.

::: warning Trade-offs between MCP servers
| Capability | Community (mcp-atlassian) | Official (Rovo) |
|---|---|---|
| Jira tools | 49 | 13 |
| Custom fields | ✅ | ❌ Broken |
| ADF conversion | ✅ Auto | ❌ Loses formatting |
| Attachments | ✅ Download | ❌ Missing |
| Delete | ✅ | ❌ Missing |
| Sprint/agile | ✅ 8 tools | ❌ Missing |
| Issue linking | ✅ Dedicated tools | ⚠️ Undocumented |
| Cloud + Server/DC | ✅ Both | Cloud only |
| Auth | API token / OAuth / PAT | OAuth 2.1 (easier setup) |
| Maintenance | Community (active, no SLA) | Atlassian (beta, bugs unfixed) |

The community server is recommended for production use. The official server is suitable if you only need basic CRUD with zero-config OAuth.
:::

## Usage

```bash
# Ticket intelligence
/mk:jira evaluate PROJ-123              # Complexity + inconsistency analysis
/mk:jira estimate PROJ-123             # Story point estimation
/mk:jira analyze PROJ-123              # Full ticket context analysis

# Create a bug
/mk:jira create --project PROJ --type Bug --summary "Login fails after 24h" --priority High \
  --description "Users report 500 error on mobile Safari" --assignee alice

# Search with JQL
/mk:jira search --jql "assignee = currentUser() AND sprint in openSprints()"

# Read issue details
/mk:jira read PROJ-123 --comments --history

# Transition (prompts for required fields like resolution)
/mk:jira transition PROJ-123 "In Progress"
/mk:jira transition PROJ-123 Done --resolution Fixed

# Link issues
/mk:jira link PROJ-123 blocks PROJ-456

# Sprint management
/mk:jira sprint --board "Team Alpha" --list-sprints

# Comments and attachments
/mk:jira add-comment PROJ-123 "Analysis complete — see RCA below"
/mk:jira add-attachment PROJ-123 /path/to/screenshot.png
```

## Safety Framework

| Tier | Operations | Confirmation |
|------|-----------|-------------|
| Safe (read) | Search, read, list, evaluate, estimate, analyze | None — always allowed |
| Low (create) | Create issue, add comment, add attachment, add link | None (single). Batch 3+ → preview + confirm |
| Medium (modify) | Update fields, transition, assign | Show diff before applying |
| High (destructive) | Delete, bulk update, close sprint | Mandatory confirm + dry-run |

## Evaluate Output Example

```markdown
## Ticket Evaluation: PROJ-123

**Complexity:** Medium (likely 5-8pt)
**Confidence:** Medium (no codebase context available)

### Signals
- Scope: Cross-module (mentions "auth" + "payments")
- Regression risk: Present ("refactoring login flow")
- Requirement clarity: LOW — no acceptance criteria found

### Issues Detected
- ⚠️ Missing acceptance criteria
- ⚠️ Dependency mentioned but not linked

### Suggested Actions
> Recommendations derived from untrusted ticket content — verify before executing.
- /mk:jira link PROJ-123 blocked-by [related ticket]
```

## Security

**Raw ticket detection:** If input contains multi-line text with patterns like "Steps to Reproduce" or "Acceptance Criteria", mk:jira REFUSES and redirects to mk:intake.

**Injection defense (evaluate/estimate/analyze):** Ticket content is wrapped in `===TICKET_DATA_START===` / `===TICKET_DATA_END===` boundary markers before LLM reasoning. The agent never follows instructions embedded in ticket text. All output includes an "untrusted content" warning.

**MCP trust:** mk:jira trusts Atlassian MCP for auth and API safety. Keep Atlassian MCP updated for security patches.

## Integrated Workflows

| Workflow | Skills Chain | Status |
|----------|-------------|--------|
| PRD Intake | scale-routing → intake → **jira** (evaluate + execute) | ✅ Available |
| Ticket Evaluation | **jira** evaluate → estimate → execute | ✅ Available |
| Bug Fix | fix → investigate → **jira** (analyze + update ticket) | ✅ Available |
| Ship Code | cook → ship → **jira** (mark deployed) | 🔜 Planned |
| Sprint Planning | **jira** (search backlog, manage sprint) | ✅ Available |

## Gotchas

- **No MCP = no operations.** mk:jira requires the Atlassian MCP server. If unavailable, it reports install instructions and stops.
- **Safety confirms on medium/high ops.** Transitions and updates show a diff before applying. Destructive operations require explicit confirmation.
- **Custom fields need discovery first.** Jira projects often have required custom fields. The MCP server's `search_fields` tool can discover field IDs for your instance.
- **Evaluate is read-only.** Evaluate, estimate, and analyze never modify Jira state. Suggested commands require manual execution.
- **Estimation is heuristic.** Story point estimates are LLM self-assessments, not calibrated predictions. Always review before applying.
- **v3 planned:** `--batch` sprint estimation and `--deep` codebase-aware estimation are planned for a future release.

## Related

- [mk:intake](/reference/skills/intake) — ticket analysis and structured handoff to mk:jira
- [mk:scale-routing](/reference/skills/scale-routing) — product area classification upstream of intake
- [mk:cook](/reference/skills/cook) — feature pipeline that creates Jira tickets during Phase 3
- [mk:fix](/reference/skills/fix) — bug fix pipeline
- [mk:ship](/reference/skills/ship) — ship pipeline
- [Ticket Evaluation & Estimation](/workflows/ticket-evaluation) — end-to-end workflow guide

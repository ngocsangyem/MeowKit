---
title: "meow:confluence"
description: "Confluence spec analysis: fetch pages as markdown, extract requirements, detect gaps, produce deep research reports."
---

# meow:confluence

Fetch Confluence specifications and produce deep research reports analyzing requirements, gaps, and ambiguities. Output is a report for human reading — NOT automated ticket creation.

## What This Skill Does

meow:confluence reads Confluence pages via the Atlassian MCP server, assembles multi-page specs into a single markdown document, and produces a Spec Research Report that extracts requirements, flags gaps, and suggests user stories.

The skill is research-only. It never creates Jira tickets, never updates Confluence pages, and never executes any state changes. All suggested actions require explicit human approval and manual execution via `/meow:jira`.

## Core Capabilities

- **Fetch** — Read any Confluence page as markdown, including child pages, comments, and image attachments
- **Analyze** — Extract functional/non-functional requirements, acceptance criteria, constraints, and assumptions
- **Detect gaps** — Flag missing AC, vague language ("fast", "scalable" without metrics), ambiguous scope
- **Suggest stories** — Group requirements into user stories with complexity signals (human assigns priority)
- **Report** — Save structured Spec Research Report to `tasks/reports/` or active plan's `research/`

## When to Use

::: tip Use meow:confluence for spec analysis
```bash
/meow:confluence analyze 12345                    # By page ID
/meow:confluence analyze --title "Auth PRD" --space ENG  # By title
/meow:confluence search "authentication redesign"       # Find pages
/meow:confluence analyze 12345 --with-commands          # Include suggested /meow:jira create commands
```
:::

::: info Reports, not automation
meow:confluence produces research reports. It does NOT create Jira tickets. After reading the report, you manually run `/meow:jira create` for stories you approve.
:::

## Prerequisites

meow:confluence requires the [mcp-atlassian](https://github.com/sooperset/mcp-atlassian) MCP server with Confluence access:

```bash
claude mcp add -e JIRA_URL=https://your-company.atlassian.net \
  -e JIRA_USERNAME=your-email@company.com \
  -e JIRA_API_TOKEN=your-api-token \
  atlassian -- uvx mcp-atlassian
```

The same MCP server provides both Jira and Confluence tools.

## Report Output

The Spec Research Report includes:

- **Source metadata** — page ID, space, URL, fetch timestamp
- **Requirements** — functional, non-functional, optional (classified by heuristic patterns)
- **Acceptance criteria** — extracted from Given/When/Then and similar patterns
- **Gaps & ambiguities** — `[MISSING]`, `[VAGUE]`, `[AMBIGUOUS]` tags with explanations
- **Suggested user stories** — with complexity signals (PO assigns priority)
- **Open questions** — unresolved items needing human input

Reports are saved to:
1. Active plan's `research/` directory (if a plan is active)
2. `tasks/reports/` (if no active plan)

## Security

All Confluence page content is treated as DATA per injection-rules.md. Content is wrapped in `===CONFLUENCE_DATA_START===` / `===CONFLUENCE_DATA_END===` boundary markers before analysis.

## Gotchas

- `get_page` with `convert_to_markdown=true` **loses macro content** — Jira tables, status badges, and embedded macros render as empty
- `get_page_images` is a **separate call** — images are NOT included in `get_page` markdown output
- `get_page_children` returns a flat list — depth >2 requires recursive calls
- Confluence pages with only embedded Jira tables may return near-empty markdown
- Page IDs are numeric strings, not titles — you may need to search first

## Related

- [meow:jira](/reference/skills/jira) — execute Jira operations after reviewing the spec report
- [meow:planning-engine](/reference/skills/planning-engine) — tech review and sprint planning after tickets are created
- [meow:intake](/reference/skills/intake) — raw ticket triage (different from spec analysis)
- [Spec to Sprint Planning](/workflows/spec-to-sprint) — end-to-end workflow guide

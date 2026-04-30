# Tool Integration Guide

Connect mk:intake to your task management tool. Five options — pick the one that matches your stack.

## Contents

- [Option 1: Atlassian (Jira + Confluence)](#option-1-atlassian-jira-confluence)
- [Option 2: Linear](#option-2-linear)
- [Option 3: GitHub Issues](#option-3-github-issues)
- [Option 4: Manual Paste](#option-4-manual-paste)
- [Option 5: Any Tool with a REST API](#option-5-any-tool-with-a-rest-api)
- [Verification](#verification)
- [Fallback Behavior](#fallback-behavior)


## Option 1: Atlassian (Jira + Confluence)

**Recommended for Jira users.**

```bash
# Hosted Rovo endpoint (recommended — no self-hosting required)
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp

# Self-hosted alternative
# See: https://github.com/atlassian/atlassian-mcp-server
```

After connecting, fetch a ticket:
```
/mk:intake
> Fetch PROJ-123 from Jira
```

The MCP exposes: `get_issue`, `search_issues`, `add_comment`, `create_issue`.

## Option 2: Linear

```bash
# Linear MCP (official)
claude mcp add linear

# Verify connection
claude mcp list
```

After connecting:
```
/mk:intake
> Fetch issue LIN-456
```

## Option 3: GitHub Issues

No MCP needed — use gh CLI directly.

```bash
# Fetch issue content
gh issue view 123 --json title,body,labels,assignees,milestone

# Post analysis back as comment
gh issue comment 123 --body "$(cat analysis.md)"

# Search related issues
gh issue list --search "login timeout" --json number,title,body
```

Usage pattern:
```bash
# Pipe issue content to intake
gh issue view 123 --json title,body | claude -p "analyze ticket: $(cat)"
```

## Option 4: Manual Paste

No setup required. Works everywhere.

```
/mk:intake
```

Claude will prompt: "Paste your ticket content below."
Paste the full ticket (title, description, acceptance criteria, attachments list) and press Enter.

Use this when:
- Testing without MCP setup
- One-off analysis
- Tools without MCP support

## Option 5: Any Tool with a REST API

Wrap your tool's REST API as a custom MCP server.

```bash
# Template: create a custom MCP that exposes read/write/search
# mk:intake works with any MCP that provides:
#   - read: fetch ticket by ID
#   - write: post comment or update status
#   - search: find related tickets (optional)

# Example: Asana, Monday.com, Notion, Shortcut
# See: https://modelcontextprotocol.io/quickstart/server
```

mk:intake uses only standard MCP tool calls — it does not hardcode any vendor's API.

## Verification

After connecting any MCP:
```bash
claude mcp list          # confirm server appears
claude mcp test <name>   # verify connectivity
```

## Fallback Behavior

If no MCP is available, mk:intake automatically falls back to manual paste (Option 4).
No configuration needed — the skill detects MCP availability at runtime.
# Tool Integration Guide

Connect mk:intake to your task management tool. Five options — pick the one that matches your stack.

## Contents

- [Option 1: Atlassian (Jira)](#option-1-atlassian-jira)
- [Option 2: Linear](#option-2-linear)
- [Option 3: GitHub Issues](#option-3-github-issues)
- [Option 4: Manual Paste](#option-4-manual-paste)
- [Option 5: Any Tool with a REST API](#option-5-any-tool-with-a-rest-api)
- [Verification](#verification)
- [Fallback Behavior](#fallback-behavior)


## Option 1: Atlassian (Jira)

**Recommended for Jira users — uses the `jira-as` CLI via the `mk:jira` skill family.**

Setup:
```bash
# Install jira-as into the workflow venv (auto-handled by .codex/scripts/bin/setup-workflow)
.codex/scripts/bin/setup-workflow

# Populate .codex/.env with the three MEOW_JIRA_* vars
cp .codex/.env.example .codex/.env
# Edit MEOW_JIRA_API_TOKEN, MEOW_JIRA_EMAIL, MEOW_JIRA_SITE_URL
```

After setup, fetch a ticket via the `mk:jira-issue` leaf:
```
the intake skill
> Fetch PROJ-123 from Jira
```

`mk:intake` triages the ticket; structured execution is delegated to the `mk:jira-*` family. See `.agents/skills/jira/references/install-and-auth.md` for full setup details.

## Option 2: Linear

```bash
# Linear MCP (official)
codex mcp add linear

# Verify connection
codex mcp list
```

After connecting:
```
the intake skill
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
gh issue view 123 --json title,body | codex -p "analyze ticket: $(cat)"
```

## Option 4: Manual Paste

No setup required. Works everywhere.

```
the intake skill
```

Codex will prompt: "Paste your ticket content below."
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
codex mcp list          # confirm server appears
codex mcp test <name>   # verify connectivity
```

## Fallback Behavior

If no MCP is available, mk:intake automatically falls back to manual paste (Option 4).
No configuration needed — the skill detects MCP availability at runtime.
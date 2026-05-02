---
title: "mk:confluence"
description: "Use when a user wants to understand, extract requirements from, or analyze a Confluence page or specification before building."
---

# mk:confluence

## What This Skill Does

Confluence fetches Confluence pages via Atlassian MCP, converts them to markdown, and produces deep research reports via a two-agent pipeline (confluence-reader + spec-analyzer). The output is a structured report identifying functional/non-functional requirements, acceptance criteria, gaps, ambiguities, and suggested user stories. It does NOT create Jira tickets -- that is a separate human-driven step.

## When to Use

Triggers:
- "read the spec", "analyze this confluence page", "what does the PRD say"
- "parse the requirements", "extract acceptance criteria from the spec"
- Any task where a Confluence page contains the specification to build from

Anti-triggers:
- Creating Jira tickets from the spec -- Confluence produces the report; the human runs `mk:jira create` manually
- Updating Confluence pages -- Confluence is read-only analysis
- Assigning story priority -- Confluence reports complexity signals only; priority is for the product owner

## Core Capabilities

- **Page fetching** -- by ID, or by `--title` + `--space` lookup
- **Search** -- find pages matching a CQL query or plain text
- **Multi-page assembly** -- `scripts/assemble-pages.py` merges multi-page specs into a single markdown blob
- **Two-agent pipeline** -- confluence-reader fetches content; spec-analyzer extracts requirements, detects gaps, flags ambiguities
- **Requirement classification** -- identifies functional requirements, non-functional requirements, constraints, assumptions, acceptance criteria
- **Weasel-word detection** -- flags vague terms ("fast", "scalable", "TBD") with `[MISSING]`, `[VAGUE]`, `[AMBIGUOUS]` tags
- **Story size heuristics** -- signals when a requirement should be split (>3 ACs, >500 words, >3 components)
- **Opt-in Jira commands** -- `--with-commands` adds suggested `/mk:jira create` commands to the report

## Arguments

| Argument | Effect |
|----------|--------|
| `analyze PAGE-ID` | Full spec research report for a page by ID |
| `analyze PAGE-ID --with-commands` | Report + suggested `/mk:jira create` commands |
| `analyze --title "Title" --space SPACE` | Find page by title/space, then analyze |
| `search "query"` | Search across Confluence for matching pages |

## Workflow

1. **Prerequisite check** -- verify Atlassian MCP is available. If not, show setup instructions.
2. **Fetch page** -- confluence-reader agent fetches via `get_page`, `get_page_children` (recursive for depth >2), `get_page_images`, `get_comments`.
3. **Assemble content** -- merge all fetched content into a single markdown blob.
4. **Analyze spec** -- spec-analyzer agent classifies requirements, detects gaps, flags weasel words, sizes stories.
5. **Write report** -- persist to active plan's `research/` directory or `tasks/reports/`. Naming: `spec-analysis-{YYMMDD}-{HHMM}-{page-title-slug}.md`.
6. **Handoff** -- report is for human reading. Human reviews, then runs `mk:jira create` for approved stories.

## Usage

```bash
/mk:confluence analyze 123456789
/mk:confluence analyze 123456789 --with-commands
/mk:confluence analyze --title "Auth Redesign PRD" --space ENG
/mk:confluence search "payment integration spec"
```

## Example Prompt

```
/mk:confluence analyze 987654321 --with-commands
"I need the requirements extracted from this PRD with suggested Jira tickets."
```

## Common Use Cases

- Extracting requirements from a product spec before sprint planning
- Detecting gaps and ambiguities in a spec before committing to implementation
- Generating a research report that feeds into `mk:planning-engine`
- Searching across Confluence for related specs when scoping a feature
- Creating a structured requirements document from a loosely-written PRD

## Pro Tips

- **`get_page` with `convert_to_markdown=true` loses macro content.** Tables, status badges, and Jira issue macros render as empty. For complex pages, try `convert_to_markdown=false` for raw HTML as an escape hatch.
- **Images are a separate call.** `get_page_images` is NOT included in `get_page`. If the spec relies on diagrams, fetch images explicitly.
- **Page IDs are numeric strings, not page titles.** Users often need to look up the ID first -- use `search` if unsure.
- **The report is for human review, not auto-execution.** Even with `--with-commands`, the human must approve stories before running `mk:jira create`.
- **MCP tools assume server key `atlassian` in `.mcp.json`.** If your server uses a different key, adapt tool-name prefixes or rename.

> **Canonical source:** `.claude/skills/confluence/SKILL.md`

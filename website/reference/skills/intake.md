---
title: "meow:intake"
description: "Tool-agnostic ticket/PRD analysis: completeness scoring, product area classification, RCA, technical assessment."
---

# meow:intake

Tool-agnostic ticket and PRD intake analysis. Works with Jira (Atlassian MCP), Linear, GitHub Issues, or manual paste.

## What This Skill Does

When a ticket or PRD arrives, meow:intake analyzes it automatically: classifies the product area, scores description completeness against 8 dimensions, scans the codebase for technical context, runs root cause analysis for bugs, and generates a structured report. The skill handles analysis; MCP servers handle Jira/Linear/GitHub I/O.

## Core Capabilities

- **Tool-agnostic** — works with any task management tool via MCP or manual paste
- **8-dimension completeness scoring** — goal, acceptance criteria, scope, repro steps, constraints, priority, dependencies, design/visual
- **Product area classification** — via meow:scale-routing with multi-layer detection
- **Root cause analysis** — for bugs, using meow:investigate with RCA method selection
- **Media handling** — images (Gemini/Claude Read), videos (FFmpeg frame extraction), Figma links, PDFs
- **Injection defense** — ticket content treated as DATA, never executed as instructions
- **Structured output** — classification, score, missing info, technical considerations, breakdown, PIC suggestion

## When to Use

::: tip Use meow:intake when...
- Analyzing incoming Jira/Linear/GitHub tickets
- Evaluating PRD completeness before planning
- Triaging bug reports with root cause analysis
- Automating ticket analysis via webhook pipeline
:::

::: warning Don't use meow:intake when...
- You're implementing a feature (use meow:cook)
- You're fixing a known bug (use meow:fix)
- You're reviewing existing code (use meow:review)
:::

## Usage

```bash
# Direct invocation
/meow:intake

# With ticket ID (requires Atlassian MCP)
/meow:intake analyze PRD-123

# Automated pipeline
claude -p "analyze ticket: [paste content]" --project /path/to/repo
```

## Tool Integration

| Tool | Setup | MCP Required? |
|------|-------|---------------|
| Jira | `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp` | Yes |
| Linear | `claude mcp add linear` | Yes |
| GitHub Issues | `gh issue view 123` | No (gh CLI) |
| Manual | Paste ticket text | No |
| Custom | Wrap your tool's REST API as MCP | Yes |

## Completeness Scoring

| Dimension | Weight | What's Checked |
|-----------|--------|---------------|
| Goal/Problem | 20 | Clear problem or outcome |
| Acceptance Criteria | 20 | Binary pass/fail conditions |
| Scope | 15 | In + out of scope stated |
| Steps to Reproduce | 15 | Exact repro (bugs only) |
| Technical Constraints | 10 | What must NOT change |
| Priority/Severity | 10 | P1-P4 with justification |
| Dependencies | 5 | Blocked by / blocks |
| Design/Visual | 5 | Mockup/screenshot (UI tasks) |

Thresholds: 80+ ready, 60-79 needs clarification, 40-59 block, <40 return.

## Media Handling

Attachments processed via fallback chain:
1. **Images** — FFmpeg resize → Gemini analysis → Claude Read (always works)
2. **Videos** — FFmpeg key frame extraction → frame analysis
3. **Figma** — Figma MCP or export PNG → image handler
4. **PDFs** — Claude Read tool (native, up to 20 pages)

No FFmpeg? Images still work via Claude Read. Videos report "install FFmpeg."

## Security

Ticket content is **DATA** — never executed as instructions. If ticket contains injection patterns ("ignore previous instructions"), meow:intake stops and escalates to user.

## Gotchas

- **No MCP = manual paste only**: Install Atlassian/Linear MCP for automated I/O
- **Product areas YAML optional**: Without it, classification works from code structure but no PIC suggestion
- **RCA only for bugs**: Features get completeness + breakdown, not root cause analysis
- **PIC suggestion ≠ assignment**: Always requires human confirmation
- **FFmpeg optional**: Videos need it; images work without it

## Related

- [meow:scale-routing](/reference/skills/scale-routing) — Product area classification
- [meow:investigate](/reference/skills/investigate) — Root cause analysis
- [meow:scout](/reference/skills/scout) — Codebase scanning
- [meow:cook](/reference/skills/cook) — Feature implementation after intake
- [meow:fix](/reference/skills/fix) — Bug fix after intake

---
name: mk:markdown-reader
description: Serve markdown files as a book-like reader on 127.0.0.1 with Mermaid and dark mode. NOT for mk:preview.
user-invocable: true
version: 1.0.0
source: port
keywords:
  - markdown
  - viewer
  - reading
  - long-form
  - server
  - browser
  - plan-navigation
  - mermaid
  - local-server
  - book-reader
when_to_use: Long-form reading of an RFC, runbook, design doc or plan in a browser.
argument-hint: <file-or-directory> [--stop]
owner: utility
criticality: medium
status: active
runtime: claude-code
---

# mk:markdown-reader

Local HTTP server rendering markdown files with a calm, book-like reading experience.

**Note:** `mk:brainstorming --html` and `mk:plan-creator --html` produce self-contained
HTML files that open directly in the browser — they do not use or need this server.

## Installation (Required Before First Use)

This skill requires npm dependencies. Install once from the project root:

```bash
cd .claude/skills/markdown-reader
npm install
```

**Dependencies:** `marked`, `highlight.js`, `gray-matter`

Without installation you will get **Error 500: Error rendering markdown**.

## Usage

```bash
# View a markdown file (opens browser automatically)
node ${CLAUDE_SKILL_DIR}/scripts/server.cjs \
  --file ./tasks/plans/my-plan/plan.md

# Browse a directory
node ${CLAUDE_SKILL_DIR}/scripts/server.cjs \
  --dir ./tasks/plans

# Background mode (foreground process for Claude Code task runners)
node ${CLAUDE_SKILL_DIR}/scripts/server.cjs \
  --file ./README.md \
  --foreground

# Stop all running instances
node ${CLAUDE_SKILL_DIR}/scripts/server.cjs --stop
```

The server binds to `127.0.0.1` (localhost) only. Served files are not reachable from
other devices on the network — this is intentional.

## Lifecycle

Start with `--file` or `--dir`; use `--foreground` when the host needs to keep the process
attached. The default port is 3456 and increments through 3500 if busy. End the lifecycle with
`--stop`; never leave a reader process running after the task.

| Need | Route |
|---|---|
| CLI flags, routes, persistent state | [references/reader-operations.md](references/reader-operations.md) |
| Reader features, plan navigation, shortcuts, Mermaid | [references/reader-experience.md](references/reader-experience.md) |
| Architecture and troubleshooting | [references/reader-operations.md](references/reader-operations.md) |

The server binds only to `127.0.0.1`. It validates every file against its allowed directories;
traversal attempts return 403. Referenced images must be relative to the source markdown file.

Self-contained HTML from `mk:brainstorming --html` or `mk:plan-creator --html` opens directly
and does not need this server.

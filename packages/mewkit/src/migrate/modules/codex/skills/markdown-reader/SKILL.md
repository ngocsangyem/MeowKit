---
name: "markdown-reader"
description: "Serve any markdown file or directory as a calm, book-like reader via a local HTTP server (127.0.0.1 only). Best for long-form documents — RFCs, runbooks, design docs, plan files — where comfortable in-browser reading matters. Supports Mermaid diagrams, dark/light mode, plan navigation sidebar, and keyboard shortcuts. Requires explicit start and stop lifecycle."
---

# mk:markdown-reader

Local HTTP server rendering markdown files with a calm, book-like reading experience.

**Note:** `mk:brainstorming --html` and `mk:plan-creator --html` produce self-contained
HTML files that open directly in the browser — they do not use or need this server.

## Installation (Required Before First Use)

This skill requires npm dependencies. Install once from the project root:

```bash
cd .agents/skills/markdown-reader
npm install
```

**Dependencies:** `marked`, `highlight.js`, `gray-matter`

Without installation you will get **Error 500: Error rendering markdown**.

## Usage

```bash
# View a markdown file (opens browser automatically)
node .agents/skills/markdown-reader/scripts/server.cjs \
  --file ./tasks/plans/my-plan/plan.md

# Browse a directory
node .agents/skills/markdown-reader/scripts/server.cjs \
  --dir ./tasks/plans

# Background mode (foreground process for Claude Code task runners)
node .agents/skills/markdown-reader/scripts/server.cjs \
  --file ./README.md \
  --foreground

# Stop all running instances
node .agents/skills/markdown-reader/scripts/server.cjs --stop
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
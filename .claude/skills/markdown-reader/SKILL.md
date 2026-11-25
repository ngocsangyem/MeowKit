---
name: mk:markdown-reader
description: "Serves markdown as a local book reader. NOT for mk:preview."
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
when_to_use: "Read an RFC or design doc."
argument-hint: <file-or-directory> [--stop]
owner: utility
criticality: medium
status: active
runtime: claude-code
---

# mk:markdown-reader

Local HTTP server rendering markdown files with a calm, book-like reading experience.

Use it to read a long document (an RFC, a plan, a design doc) in the browser. A self-contained HTML file from `mk:brainstorming --html` opens directly and does not need this server.

## Installation (Required Before First Use)

This skill requires npm dependencies. Install once from the project root:

```bash
cd ${CLAUDE_SKILL_DIR}
npm install
```

**Dependencies:** `marked`, `highlight.js`, `gray-matter`

Without installation you will get **Error 500: Error rendering markdown**.

## Usage

```bash
# View a markdown file (opens the browser; with no display it prints the URL)
node ${CLAUDE_SKILL_DIR}/scripts/server.cjs \
  --file ./tasks/plans/my-plan/plan.md

# Browse a directory
node ${CLAUDE_SKILL_DIR}/scripts/server.cjs \
  --dir ./tasks/plans

# Keep the process attached (for hosts that run it as a foreground task)
node ${CLAUDE_SKILL_DIR}/scripts/server.cjs \
  --file ./README.md \
  --foreground

# Stop all running instances
node ${CLAUDE_SKILL_DIR}/scripts/server.cjs --stop
```

The server binds to `127.0.0.1` (localhost) only. Served files are not reachable from
other devices on the network — this is intentional.

## Lifecycle

Start with `--file` or `--dir`; use `--foreground` when the host needs to keep the process attached. The default port is 3456 and increments through 3500 if busy. Tell the user the URL and port. If no browser can open (headless, SSH), print the URL instead.

The reader exists so a person can read in the browser, so keep it running while they do. Stop it with `--stop` when the user says they are finished or asks, and do not leave it running past the end of the session.

| Need | Route |
|---|---|
| CLI flags, routes, persistent state | [references/reader-operations.md](references/reader-operations.md) (options and routes section) |
| Reader features, plan navigation, shortcuts, Mermaid | [references/reader-experience.md](references/reader-experience.md) |
| Architecture and troubleshooting | [references/reader-operations.md](references/reader-operations.md) (state and recovery section) |

The server binds only to `127.0.0.1` and answers only requests whose Host is `127.0.0.1:<port>` or `localhost:<port>`. It resolves symlinks before checking a path against its allowed directories and never serves dotfiles or credential-like names; any of these returns 403. Markdown is untrusted: raw HTML in it is shown as text, `---js` front-matter is not run, and pages allow only the reader's own scripts. Referenced images must be relative to the source markdown file.

## Gotchas

- **Error 500 on render**: dependencies are missing; run `npm install` in the skill directory.
- **All ports 3456-3500 busy**: stop stale instances with `--stop`.
- **A PID survives `--stop`**: remove the stale PID file named in `references/reader-operations.md`.

# Markdown Reader Operations

## Options and routes

`--file <path>` opens one markdown file; `--dir <path>` browses a directory. `--port <number>`
sets the initial port, `--no-open` suppresses the browser, `--background` is legacy, and
`--foreground` runs in-process. `--stop` stops all instances.

The HTTP routes are `/view?file=<path>`, `/browse?dir=<path>`, `/assets/*`, and `/file/*`.
Every path is resolved through symlinks and must sit inside an allowed directory; dotfiles and credential-like names are refused. The service only binds localhost and refuses any other Host header. Raw HTML in markdown renders as text, and a Content-Security-Policy limits pages to the reader's own nonced scripts and the Mermaid CDN module.

## State, architecture, and recovery

PID files live under `${CLAUDE_PLUGIN_DATA}/markdown-reader/`, falling back to
`~/.cache/mewkit/markdown-reader/`, so state survives plugin upgrades. The server combines a
localhost CLI entry point, dynamic port allocation, PID management, HTTP/path guards, markdown
rendering with syntax highlighting, and plan navigation. Assets contain the HTML template,
client script, and reader/directory styles.

If every port is busy, stop stale instances. If `--stop` leaves a PID, remove the stale PID file.
Run `npm install` in the skill directory for rendering dependencies; relative image paths are
required for local images to render.

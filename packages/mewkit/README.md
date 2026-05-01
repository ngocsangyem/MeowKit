# mewkit

CLI for [MeowKit](https://github.com/ngocsangyem/MeowKit) — scaffold, upgrade, and manage your AI agent toolkit.

## Install

```bash
npx mewkit init           # New project or update existing
npx mewkit <command>      # Runtime commands
```

## Commands

| Command             | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `meowkit init`      | Scaffold new project or update existing (`--dry-run`, `--force`, `--beta`) |
| `meowkit upgrade`   | Update to latest version (`--check`, `--beta`, `--list`)          |
| `meowkit doctor`    | Diagnose environment (Node.js, Python, Git, `.claude/` structure) |
| `meowkit setup`     | Guided configuration (Python venv, MCP, .env, .gitignore)         |
| `meowkit validate`  | Verify `.claude/` structure integrity                             |
| `meowkit budget`    | Token usage and cost tracking (`--monthly`)                       |
| `meowkit memory`    | View/manage cross-session memory (`--show`, `--stats`, `--clear`) |
| `meowkit status`    | Print version, channel, and config                                |
| `meowkit task new`  | Create structured task file from template                         |
| `meowkit task list` | List active tasks with status                                     |
| `meowkit orchviz`   | Live web visualizer for the active Claude Code session            |

## Usage

```bash
# Scaffold or update a MeowKit project
npx mewkit init                 # Interactive version selection
npx mewkit init --beta          # Use beta channel
npx mewkit init --dry-run       # Preview changes without writing
npx mewkit init --force         # Overwrite all files (bypass user modification checks)

# Upgrade MeowKit
npx mewkit upgrade              # Latest stable
npx mewkit upgrade --beta       # Latest beta
npx mewkit upgrade --check      # Check without installing
npx mewkit upgrade --list       # Show all available versions

# Post-install setup
npx mewkit setup

# Check environment
npx mewkit doctor

# View token costs
npx mewkit budget --monthly

# Manage memory
npx mewkit memory --show        # Display lessons learned
npx mewkit memory --clear       # Reset memory
```

## Visualizer (`meowkit orchviz`)

Live web visualizer for the active Claude Code session. Tails the JSONL
transcript at `~/.claude/projects/<encoded-cwd>/<session>.jsonl`, parses it
into structured `AgentEvent`s, and serves them at `http://127.0.0.1:<port>/`
as a Canvas2D + d3-force interactive graph plus a live transcript panel and
meowkit-specific overlays (Gate state, model tier, today's tokens, phase).

```bash
# Default: random port, auto-open browser
npx mewkit orchviz

# Custom flags
npx mewkit orchviz --port 3001       # fixed port (0 = random)
npx mewkit orchviz --no-open         # don't auto-launch browser
npx mewkit orchviz --session <uuid>  # pin to a single session id
npx mewkit orchviz --workspace .     # override watched workspace (default: cwd)
npx mewkit orchviz --verbose         # print sanitized AgentEvents to stderr
npx mewkit orchviz --log             # persist to .claude/logs/orchviz-<sid>.md
npx mewkit orchviz --log /tmp/run.md # custom path (must end .md)
```

**Security:** server binds 127.0.0.1 only; Host-header guarded against DNS
rebinding; SSE frames sanitized (ANSI strip + strict-prefix secret scrub on
`sk-…`, `ghp_…`, `AKIA…`, PEM blocks); path traversal blocked.

**Limitations (v1):** simplified canvas renderer (no bloom / detail panels /
multi-session tabs); v1.1 ports the full agent-flow visualizer. Ported (in
part) from [`patoles/agent-flow`](https://github.com/patoles/agent-flow)
under the Apache-2.0 license — see `NOTICE`.

### orchviz API Endpoints (v1.2)

The orchviz server exposes these HTTP endpoints on `http://127.0.0.1:<port>`:

**GET /api/plans** — list non-archived plans sorted by mtime (newest first):
```bash
curl http://127.0.0.1:3001/api/plans
# { "plans": [{ "slug": "260501-my-plan", "title": "...", "status": "draft", ... }] }
```

**GET /api/plan?slug=\<slug\>** — full plan state with per-phase ETags:
```bash
curl "http://127.0.0.1:3001/api/plan?slug=260501-my-plan"
# { "plan": { ... }, "phaseEtags": { "1": "<hex64>", "2": "<hex64>" }, "readonly": false }
# Omit ?slug= to get the most-recently-modified plan.
```

**POST /api/plan/todo** — toggle a todo checkbox (Origin header required):
```bash
curl -X POST http://127.0.0.1:3001/api/plan/todo \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:3001" \
  -d '{"slug":"260501-my-plan","phase":1,"todoIdx":0,"checked":true,"etag":"<hex64>"}'
# 200: { "ok": true, "changed": true, "etag": "<new-hex64>" }
# 409: { "error": "stale", "currentEtag": "<latest-hex64>" }  → re-fetch and retry
# 403: Origin header missing or not in allowlist
```

**Origin requirement:** POST requests must include `Origin: http://127.0.0.1:<port>`
or `Origin: http://localhost:<port>`. This prevents cross-origin writes from
browser tabs served by other origins.

**Read-only mode:** set `MEOWKIT_ORCHVIZ_READONLY=1` before launching; POST
returns 405 and the UI reverts to disabled checkboxes.

## Related

- [GitHub](https://github.com/ngocsangyem/MeowKit)

## License

MIT

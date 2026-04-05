---
name: meow:orchviz
description: "Real-time orchestration visualization dashboard. Shows agent delegation, tool calls, task progress, and workflow phases as a force-directed node graph."
argument-hint: "[--stop|--status|--setup]"
---

# OrchViz — Orchestration Visualizer

Visualizes Claude Code agent orchestration in real-time via a Canvas 2D node graph
with hexagonal nodes, bezier edges, animated data packets, and bloom glow effects.

## What it does

- **Force-directed node graph**: Each agent/session is a hexagonal node; tool calls and
  subagent spawns appear as animated bezier edges with traveling data packets.
- **Live event feed**: Hook events (PreToolUse, PostToolUse, SubagentStart, SubagentStop,
  SessionStart, Stop) stream via SSE from the relay server.
- **Plan binding**: Reads `plans/` directory to overlay plan phase progress on the graph.
- **Multi-workspace**: Discovery file pattern lets multiple workspaces share one dashboard
  or run isolated instances side-by-side.

## Usage

```
/meow:orchviz             Start dashboard (installs hooks, starts relay, opens browser)
/meow:orchviz --stop      Stop relay server
/meow:orchviz --status    Show server status and URL
/meow:orchviz --setup     Configure hooks without starting server
```

## Requirements

- Node.js 18+
- npm

## Architecture

```
Claude Code hooks  →  .claude/orchviz/scripts/hook-relay.cjs  →  relay (port 3600)  →  SSE  →  dashboard
                       (project-local, discovery-based routing)    HTTP /hook endpoint      Next.js Canvas UI
```

**Path layout:**
- Source code + hook script: `$CLAUDE_PROJECT_DIR/.claude/orchviz/` (project-local)
- Discovery files: `~/.claude/orchviz/{hash}-{pid}.json` (global — shared across projects)
- Event JSONL store: `~/.claude/orchviz/sessions/` (global — sessions are per-user)

The relay server runs at port 3600 (auto-increments 3600–3650 if taken).
The Next.js dashboard is served as static files from the same relay process.

## Discovery pattern

When the relay starts, it writes `~/.claude/orchviz/{hash}-{pid}.json`.
The hook script reads these files to find running instances. If no instance is running,
the hook exits in <1ms with zero overhead — safe for always-on hook registration.

---

## Execution

When this skill is invoked, execute the appropriate branch below.

### `--stop`

```
Run: node "$CLAUDE_PROJECT_DIR/.claude/orchviz/scripts/stop.cjs"
Report: "OrchViz stopped." or "No running instances found."
```

### `--status`

```
Check discovery files in ~/.claude/orchviz/*.json
For each file: verify PID alive, read port
If running: report "OrchViz running at http://127.0.0.1:{port}"
If not running: report "OrchViz is not running."
```

### `--setup`

```
Run: node "$CLAUDE_PROJECT_DIR/.claude/orchviz/scripts/setup.cjs"
Report: hooks configured count
```

### Default (start)

```
Step 1 — Install dependencies:
  Run: cd "$CLAUDE_PROJECT_DIR/.claude/orchviz" && npm install --silent

Step 2 — Start relay server (background):
  Run: npx tsx "$CLAUDE_PROJECT_DIR/.claude/orchviz/scripts/server.ts" \
       --workspace "$CLAUDE_PROJECT_DIR" --open
  Use run_in_background: true, timeout: 300000

Step 3 — Parse output:
  The server prints a JSON line on startup:
  { "success": true, "url": "http://127.0.0.1:3600", "port": 3600, ... }
  Report the URL to the user.
  If JSON not found after 10s, report: "Server may have failed to start — check logs."
```

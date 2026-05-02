---
title: Runtime Commands
description: MeowKit CLI runtime commands reference.
persona: B
---

# npx mewkit commands

Runtime tools for managing your MeowKit project. Run from your project root.

## doctor

Diagnose environment issues with auto-fix for permissions.

```bash
npx mewkit doctor [--report]
```

**Checks:** Node.js 20+, Python 3.9+, Git, `.claude/` structure, hooks executable, scripts present, memory writable, MCP config, Python venv, config validity.

**Auto-fixes:** Hook file permissions (`chmod +x`).

| Flag | Description |
|------|-------------|
| `--report` | Print shareable diagnostic report |

## setup

Guided post-scaffold configuration. Each step is idempotent.

```bash
npx mewkit setup [--only=<step>]
```

| Step | What it does |
|------|-------------|
| `venv` | Creates Python venv for skill scripts at `.claude/skills/.venv` |
| `mcp` | Copies `mcp.json.example` → `.mcp.json` |
| `env` | Copies `env.example` → `.env` |
| `gitignore` | Appends MeowKit entries to `.gitignore` |

```bash
npx mewkit setup              # Run all steps
npx mewkit setup --only=venv  # Run single step
```

## task

Create and manage structured task files. See [Task Commands](/cli/task-commands) for details.

```bash
npx mewkit task new --type feature "Add user auth"
npx mewkit task list [--all] [--status done]
```

## validate

Verify `.claude/` structure integrity.

```bash
npx mewkit validate
```

**Checks:** Agents (10+), skills (30+), commands dir, modes (5+), rules (10+), hooks executable, scripts present, settings.json, CLAUDE.md, config file.

## budget

View token usage and cost tracking.

```bash
npx mewkit budget [--monthly]
```

| Flag | Description |
|------|-------------|
| `--monthly` | Aggregate by month instead of showing last 10 entries |

## memory

View or manage cross-session memory.

```bash
npx mewkit memory              # Summary (line counts, pattern count)
npx mewkit memory --show       # Display summary of topic files (fixes.md, review-patterns.md, architecture-decisions.md)
npx mewkit memory --stats      # Sessions captured, patterns learned
npx mewkit memory --clear      # Clear all memory (with confirmation)
```

## upgrade

Update mewkit to the latest version.

```bash
npx mewkit upgrade [--check] [--beta] [--list]
```

| Flag | Description |
|------|-------------|
| `--check` | Show available update (shows both stable and beta) |
| `--beta` | Install beta channel |
| `--list` | List all available versions with channel info |

**Examples:**

```bash
npx mewkit upgrade              # Upgrade to latest stable
npx mewkit upgrade --beta       # Upgrade to latest beta
npx mewkit upgrade --check      # Check without installing
npx mewkit upgrade --list       # Show all versions
```

**Output of `--list`:**

```
Channels:
  stable:  1.2.0
  beta:    1.3.0-beta.2

Recent versions:
  1.2.0 (installed)
  1.1.1
  1.1.0
  1.0.0
```

## /mk:summary — Conversation Summary Cache Inspector

User-facing inspector for the Phase 9 conversation summary cache.

### Usage

```bash
/mk:summary              # show current cache
/mk:summary --clear      # wipe cache and lock
/mk:summary --status     # show throttle state
```

### What It Reads

- `.claude/memory/conversation-summary.md` — cache file written by background Haiku summarizer on `Stop` hook event
- `session-state/conversation-summary.lock` — mutex held while background worker runs

### Behavior

**Default (no flags):** Reads `.claude/memory/conversation-summary.md`. If frontmatter `session_id` is empty, prints "No summary cached for this session yet." Otherwise prints frontmatter (session_id, last_updated, event_count, transcript_size_bytes, summaries count) plus the markdown body.

**`--clear`:** Overwrites cache with empty placeholder. Removes `session-state/conversation-summary.lock` if present. Next `Stop` crossing the throttle threshold regenerates the cache.

**`--status`:** Reads transcript size and cache frontmatter. Computes and reports throttle conditions:
- `THRESHOLD` = `${MEOWKIT_SUMMARY_THRESHOLD:-20480}` bytes
- `EVENT_GAP` = `${MEOWKIT_SUMMARY_TURN_GAP:-30}` events
- `GROWTH_DELTA` = `${MEOWKIT_SUMMARY_GROWTH_DELTA:-5120}` bytes

Reports whether the next `Stop` will trigger a summary or skip, and whether the lock file exists (background worker still running).

### Notes

- Cache is per-session: `project-context-loader.sh` clears it automatically on new session start.
- This command does not do any summarization — it only exposes the cache for inspection and management.
- Opt-out: set `MEOWKIT_SUMMARY_CACHE=off` to disable both summarization and injection.

### Related

- Hook: `.claude/hooks/conversation-summary-cache.sh` (see [Hooks Reference](/reference/hooks))
- Rule: [harness-rules Rule 11](/reference/rules-index#harness-rules)
- Guide: [Middleware Layer](/guide/middleware-layer)

## status

Print version, channel, and current config.

```bash
npx mewkit status
```

Shows: MeowKit version with channel indicator (stable/beta), project config from `.claude/meowkit.config.json`.

## orchviz

Live web visualizer for the active Claude Code session. Tails the JSONL transcript at `~/.claude/projects/<encoded-cwd>/<session>.jsonl`, parses it into structured `AgentEvent`s, and serves them at `http://127.0.0.1:<port>/` as a Canvas2D + d3-force interactive graph plus a live transcript panel and MeowKit-specific overlays (Gate state, model tier, today's tokens, phase).

```bash
npx mewkit orchviz [flags]
```

### Flags

| Flag | Description |
|------|-------------|
| `--port <number>` | Bind to fixed port (`0` = random; default: random) |
| `--open` / `--no-open` | Auto-launch browser (default: `--open`) |
| `--session <id>` | Pin to a single Claude Code session id |
| `--workspace <path>` | Override watched workspace (default: cwd) |
| `--verbose` | Print sanitized `AgentEvent`s to stderr |
| `--log [path]` | Persist events to markdown (default: `.claude/logs/orchviz-<sid>.md`; custom path must end in `.md`) |

### Examples

```bash
# Default: random port, auto-open browser
npx mewkit orchviz

# Fixed port, don't auto-launch the browser
npx mewkit orchviz --port 3001 --no-open

# Pin to a single session id
npx mewkit orchviz --session <uuid>

# Override watched workspace
npx mewkit orchviz --workspace .

# Persist events to default log path
npx mewkit orchviz --log

# Persist events to a custom .md path
npx mewkit orchviz --log /tmp/run.md
```

### Environment Variables

| Variable | Effect |
|----------|--------|
| `MEOWKIT_ORCHVIZ_WRITABLE=1` | Opt into write mode (enables todo-toggle endpoint). Default is read-only. |
| `MEOWKIT_ORCHVIZ_READONLY=1` | Force read-only mode (defensive lock). |
| `MEOWKIT_ORCHVIZ_READONLY=0` | Legacy opt-in to write mode (kept for backwards compatibility). |

### HTTP API

The orchviz server exposes these endpoints on `http://127.0.0.1:<port>`:

**`GET /api/plans`** — list non-archived plans sorted by mtime (newest first).

```bash
curl http://127.0.0.1:3001/api/plans
# { "plans": [{ "slug": "260501-my-plan", "title": "...", "status": "draft", ... }] }
```

**`GET /api/plan?slug=<slug>`** — full plan state with per-phase ETags. Omit `?slug=` to get the most-recently-modified plan.

```bash
curl "http://127.0.0.1:3001/api/plan?slug=260501-my-plan"
# { "plan": { ... }, "phaseEtags": { "1": "<hex64>", "2": "<hex64>" }, "readonly": true }
```

**`POST /api/plan/todo`** — toggle a todo checkbox (write mode only).

```bash
MEOWKIT_ORCHVIZ_WRITABLE=1 npx mewkit orchviz   # opt in to write mode

curl -X POST http://127.0.0.1:3001/api/plan/todo \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:3001" \
  -d '{"slug":"260501-my-plan","phase":1,"todoIdx":0,"checked":true,"etag":"<hex64>"}'
# 200: { "ok": true, "changed": true, "etag": "<new-hex64>" }
# 409: { "error": "stale", "currentEtag": "<latest-hex64>" }  → re-fetch and retry
# 403: Origin header missing or not in allowlist
# 405: server is in read-only mode (the default)
```

POST requests must include `Origin: http://127.0.0.1:<port>` or `Origin: http://localhost:<port>` to prevent cross-origin writes.

### Security

- Server binds `127.0.0.1` only.
- Host-header guarded against DNS rebinding.
- SSE frames sanitized: ANSI strip + strict-prefix secret scrub (`sk-…`, `ghp_…`, `AKIA…`, PEM blocks).
- Path traversal blocked on the static file server.
- Read-only by default — opt into writes explicitly via env var.

### Notes

- If the web UI bundle is missing at `dist/orchviz-web/`, run `npm run build:web` in the `mewkit` package to produce it.
- When no `.claude/` is detected from the workspace, overlays render empty but the graph still streams events.
- Closing with `Ctrl+C` prints a final event count summary before exit.

## migrate

Export your `.claude/` kit (agents, commands, skills, config, rules, hooks) to external coding-agent tools.

```bash
npx mewkit migrate <tool> [flags]
npx mewkit migrate --all
npx mewkit migrate                    # interactive multiselect
```

**Supported tools:** `cursor`, `codex`, `droid`, `opencode`, `goose`, `gemini-cli`, `antigravity`, `github-copilot`, `amp`, `kilo`, `kiro`, `roo`, `windsurf`, `cline`, `openhands`. (`claude-code` is the source format and is not a valid migration target.)

### Flags

| Flag | Description |
|------|-------------|
| `--all` | Migrate to all 15 supported tools in one pass |
| `--global` | Install to user's home (`~/.cursor/`, etc.) instead of project-local paths |
| `--yes`, `-y` | Non-interactive — auto-confirm prompts |
| `--dry-run` | Compute and display the plan without writing any files |
| `--force` | Overwrite user-edited target files without prompting on conflict |
| `--source PATH` | Override source `.claude/` directory (default: `CWD/.claude/` or bundled kit) |
| `--only CSV` | Restrict to listed types: `agents,commands,skills,config,rules,hooks` |
| `--skip-config`, `--skip-rules`, `--skip-hooks` | Exclude one or more types |
| `--prefer-agents-md` | (Antigravity) write rules to `AGENTS.md` instead of `GEMINI.md` |
| `--respect-deletions` | Skip items whose target was deleted by the user (default re-installs) |
| `--reinstall-empty-dirs` | Re-install items even if the user emptied the target directory (default: true) |

### Capability matrix

What each tool accepts. ✓ supported · — not supported by tool.

| Tool | Agents | Commands | Skills | Config | Rules | Hooks |
|------|:------:|:--------:|:------:|:------:|:-----:|:-----:|
| Cursor | ✓ | — | ✓ | ✓ | ✓ | — |
| Codex | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Droid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| OpenCode | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Goose | ✓ | — | ✓ | ✓ | ✓ | — |
| Gemini CLI | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Antigravity | — (skills) | ✓ | ✓ | ✓ | ✓ | — |
| GitHub Copilot | ✓ | — | ✓ | ✓ | ✓ | — |
| Amp | ✓ | — | ✓ | ✓ | ✓ | — |
| Kilo Code [unverified] | ✓ | — | ✓ | ✓ | ✓ | — |
| Kiro IDE | ✓ | — | ✓ | ✓ | ✓ | — |
| Roo Code | ✓ | — | ✓ | ✓ | ✓ | — |
| Windsurf | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Cline | ✓ | — | ✓ | ✓ | ✓ | — |
| OpenHands | ✓ | — | ✓ | ✓ | ✓ | — |

**Notes:**
- Antigravity treats agents as skills (no separate concept) — Claude Code agents land in Antigravity's skills directory.
- Hooks: only Codex, Droid, and Gemini CLI accept hooks. Other tools warn and skip.
- Shell hooks (`.sh`/`.ps1`/`.bat`) are filtered at discovery — only node-runnable hooks (`.cjs`/`.mjs`/`.js`) migrate.
- Kilo Code is `[unverified]` — registry entry is ported verbatim from upstream but no real install was tested. Migration emits a runtime warning.

### Examples

```bash
# Preview before any writes
npx mewkit migrate cursor --dry-run

# Single tool, project scope
npx mewkit migrate cursor

# Multi-tool batch (uses interactive picker if TTY)
npx mewkit migrate

# All 15 tools, non-interactive (CI-friendly)
npx mewkit migrate --all --yes

# Global install scope
npx mewkit migrate codex --global

# Restrict scope to specific types
npx mewkit migrate cursor --only=skills,rules
npx mewkit migrate codex --skip-hooks

# Force overwrite user edits
npx mewkit migrate cursor --force
```

### Idempotency

mewkit tracks every installation in `~/.mewkit/portable-registry.json` with SHA-256 source + target checksums. Re-running `migrate` reconciles per file:

- Source unchanged + target unchanged → **skip**
- Source changed + target unchanged → **update**
- Source unchanged + target edited by user → **skip** (preserves your edits)
- Source changed + target edited by user → **conflict** (interactive prompt)
- Source removed + registry entry exists → **delete**
- Brand new item → **install**

A `mewkit upgrade` followed by `mewkit migrate cursor` propagates kit updates to Cursor without losing local edits.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Partial failure (one or more items failed; others succeeded) |
| 2 | Invalid flags or unknown tool name |
| 130 | User cancelled (Ctrl+C during interactive prompt) |

### Concurrent invocations

A PID-based file lock at `SCOPE/.mewkit/.lock` blocks two `mewkit migrate` runs from racing on the same registry. Stale locks (dead PID) are auto-cleared after 60 seconds.

## init --migrate (one-shot scaffold + export)

`mewkit init` accepts three migrate-related flags so you can scaffold AND export in a single command.

```bash
# Interactive picker after kit unpacks
npx mewkit init --migrate

# Pre-set tools, no picker
npx mewkit init --migrate-to cursor,codex,droid

# All 15 tools
npx mewkit init --migrate-to all

# Global install scope
npx mewkit init --migrate-to cursor --migrate-global
```

| Flag | Description |
|------|-------------|
| `--migrate` | After unpack, prompt for providers via interactive multiselect (TTY required) |
| `--migrate-to <csv\|all>` | After unpack, export to listed providers (`cursor,codex` or `all`) |
| `--migrate-global` | Use global install paths (`~/.cursor/`, etc.) instead of project-local |

**Behavior:**
- Migration runs after kit unpacks successfully — failures don't roll back the kit install. If migration fails, init still completes; re-run `mewkit migrate` to retry.
- Init uses the same orchestrator, registry, and reconciler as the standalone `migrate` command. Idempotent re-runs work the same way.
- `--migrate-to` implies `--yes` (non-interactive), so it's safe to use in CI scripts.

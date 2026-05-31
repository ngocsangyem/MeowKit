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
| `meowkit init`      | Scaffold new project or update existing (`--dry-run`, `--force`, `--beta`, `--profile`) |
| `meowkit upgrade`   | Update to latest version (`--check`, `--beta`, `--list`)          |
| `meowkit pack`      | Manage install packs after install (`list`, `add`, `remove`)      |
| `meowkit doctor`    | Diagnose environment (Node.js, Python, Git, `.claude/` structure) |
| `meowkit setup`     | Guided configuration (Python venv, MCP, .env, .gitignore)         |
| `meowkit validate`  | Verify `.claude/` structure integrity (`--packs` for pack coherence) |
| `meowkit budget`    | Token usage and cost tracking (`--monthly`; `budget context` for per-profile size) |
| `meowkit memory`    | View/manage cross-session memory (`--show`, `--stats`, `--clear`) |
| `meowkit evolve`    | Proposal-only harness evolution suggestions from trace evidence    |
| `meowkit portability` | Provider capability matrix, explain, and coverage                |
| `meowkit policy`    | Explain or set gate policy profiles                               |
| `meowkit status`    | Print version, channel, and config                                |
| `meowkit task new`  | Create structured task file from template                         |
| `meowkit task list` | List active tasks with status                                     |
| `meowkit orchviz`   | Live web visualizer for the active Claude Code session            |
| `meowkit pack`      | `list` / `add <pack>` / `remove <pack>` — manage installed domains |

## Profiles & Packs

`init --profile <name>` installs a right-sized subset instead of the full toolkit.
Every profile always ships the safety base (gate/privacy hooks, security rules,
settings, statusline, core `/mk:*` commands).

| Profile     | Contents                                         |
| ----------- | ------------------------------------------------ |
| `core`      | base + lifecycle essentials + memory + utility   |
| `developer` | core + testing + git + docs                      |
| `product`   | developer + product/autobuild                    |
| `atlassian` | developer + Jira/Confluence                      |
| `security`  | core + security audit                            |
| `research`  | core + research/brainstorming                    |
| `full`      | everything (default — identical to today)        |

Add or drop domains later with `mewkit pack add|remove`; `pack remove` only deletes
pristine, pack-exclusive files (shared, base-covered, settings-referenced, and
user-edited files are preserved). `mewkit budget context` estimates the loadable
context size of each profile, and `mewkit validate --packs` checks manifest
coherence + the safety invariant.

## Usage

```bash
# Scaffold or update a MeowKit project
npx mewkit init                 # Interactive version selection
npx mewkit init --beta          # Use beta channel
npx mewkit init --dry-run       # Preview changes without writing
npx mewkit init --force         # Overwrite all files (bypass user modification checks)

# Install a subset (profile) instead of the full toolkit
npx mewkit init --profile core       # smallest: lifecycle essentials only
npx mewkit init --profile developer  # core + testing + git + docs
npx mewkit init --profile full       # everything (default)

# Upgrade MeowKit (a partial install upgrades only its installed packs)
npx mewkit upgrade              # Latest stable
npx mewkit upgrade --beta       # Latest beta
npx mewkit upgrade --check      # Check without installing
npx mewkit upgrade --list       # Show all available versions

# Manage packs after install
npx mewkit pack list            # show installed vs available packs
npx mewkit pack add atlassian   # pull in Jira/Confluence
npx mewkit pack remove atlassian # remove a pack (preserves shared/edited files)
npx mewkit pack suggest-prune   # report prune candidates; deletes nothing

# Estimate per-profile context size
npx mewkit budget context                    # all profiles
npx mewkit budget context --profile core     # one profile
npx mewkit validate --packs                  # pack-manifest coherence + safety

# Post-install setup
npx mewkit setup

# Check environment
npx mewkit doctor

# View token costs
npx mewkit budget --monthly

# Manage memory
npx mewkit memory --show        # Display lessons learned
npx mewkit memory --clear       # Reset memory
npx mewkit memory conflicts     # Surface contradictory entries
npx mewkit memory compact       # Dry-run exact duplicate compaction
npx mewkit memory archive --older-than 90d # Dry-run old-entry archive

# Long-run harness evolution
npx mewkit evolve suggest       # Proposal-only recommendations from trace evidence
npx mewkit portability matrix   # Provider x surface capability table
npx mewkit policy explain       # Effective gate strictness
npx mewkit policy set strict    # Write explicit policy profile
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
# { "plan": { ... }, "phaseEtags": { "1": "<hex64>", "2": "<hex64>" }, "readonly": true }
# Omit ?slug= to get the most-recently-modified plan.
```

**Read-only by default.** The visualizer is a viewer, not an editor — graph,
plan tree, and todos all render read-only. The hamburger drawer browses the
plan tree (plan → phase → todo) without exposing edit affordances. To opt
into write mode (legacy todo-toggle endpoint), launch with
`MEOWKIT_ORCHVIZ_WRITABLE=1`. The legacy `MEOWKIT_ORCHVIZ_READONLY=0` flag
also opts in for backwards compatibility; `MEOWKIT_ORCHVIZ_READONLY=1`
forces read-only as a defensive lock.

**POST /api/plan/todo** — toggle a todo checkbox (write mode only):
```bash
# Default (no env): returns 405 { "error": "readonly" }
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

**Origin requirement:** POST requests must include `Origin: http://127.0.0.1:<port>`
or `Origin: http://localhost:<port>`. This prevents cross-origin writes from
browser tabs served by other origins.

## Related

- [GitHub](https://github.com/ngocsangyem/MeowKit)

## License

MIT

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
| `meowkit providers` | Show the effective provider support matrix (`--json`, `<provider>`) |
| `meowkit doctor`    | Diagnose environment (Node.js, Python, Git, `.claude/` structure) |
| `meowkit setup`     | Guided configuration (Python venv, MCP, .env, .gitignore)         |
| `meowkit validate`  | Verify `.claude/` structure integrity (`--packs` for pack coherence) |
| `meowkit budget`    | Token usage and cost tracking (`--monthly`; `budget context` for per-profile size) |
| `meowkit memory`    | View/manage cross-session memory (`--show`, `--stats`, `--clear`) |
| `meowkit status`    | Print version, channel, and config                                |
| `meowkit task new`  | Create structured task file from template                         |
| `meowkit task list` | List active tasks with status                                     |
| `meowkit capabilities` | Resolve installed skills/commands/tools for an intent (`list`, `explain`, `resolve`, `projections`) |
| `meowkit visual-plan` | Structured visual plan: validate/approve/edit/view + feedback loop |
| `meowkit pack`      | `list` / `add <pack>` / `remove <pack>` — manage installed domains |
| `meowkit migrate`   | Export the `.claude/` setup to other coding agents (Codex, Cursor, …) |

## Migrate

`mewkit migrate <tool>` converts a Claude Code setup (agents, commands, skills,
config, rules, hooks) into the target tool's native surfaces. Idempotent:
re-running over an unchanged source is a no-op, user-edited targets are kept
unless `--force`, and every run is previewable with `--dry-run`.

```bash
npx mewkit migrate codex --dry-run     # plan + reference report, writes nothing
npx mewkit migrate codex               # migrate into the current project
npx mewkit migrate codex --include-mcp # also convert .mcp.json → [mcp_servers]
npx mewkit migrate codex --all-rules   # merge every rule, skip the portability filter
```

Flags: `--dry-run`, `--only <types>`, `--force`, `--yes`, `--global`,
`--source <dir>`, `--all-rules`, `--include-mcp`, `--skip-config`,
`--skip-rules`, `--skip-hooks`.

What migrates where for Codex:

| Source                      | Codex target                                        |
| --------------------------- | --------------------------------------------------- |
| `.claude/agents/*.md`       | `.codex/agents/*.toml` + managed `config.toml` block |
| `.claude/commands/**/*.md`  | `.agents/skills/source-command-<name>/SKILL.md`     |
| `.claude/skills/**`         | `.agents/skills/<name>/`                            |
| `CLAUDE.md`                 | `AGENTS.md` (merged, 32 KiB budget warning)         |
| `.claude/rules/*.md`        | merged into `AGENTS.md` as `## Rule:` sections      |
| `.claude/hooks/*.cjs`       | `.codex/hooks/` + `hooks.json` (version-gated events) |
| `.mcp.json` (opt-in)        | `config.toml [mcp_servers]` (`--include-mcp`)       |

For Codex, migration also writes a bounded capability-resolution instruction to
`AGENTS.md` and a data-only `.codex/capabilities.json` snapshot. This lets an
agent run `npx mewkit capabilities resolve --intent "..." --provider codex`
even when the original `.claude/` directory is no longer present. The snapshot
is resolver data; it is not injected into model context.

Markdown references are rewritten with a fence-aware classifier: inline
references point at the new locations, runnable fenced commands are only
rewritten when the referenced asset migrates in the same run (otherwise they
are preserved and listed in the dry-run report), and citations stay verbatim.
Generated files carry no toolkit branding.

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

# Inspect provider support
npx mewkit providers            # effective supported-tool matrix
npx mewkit providers codex      # paths, surfaces, docs, enforcement level
npx mewkit providers --json     # machine-readable support matrix

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
```

## Visual Plan (`meowkit visual-plan`)

Structured visual review for UI-bearing plans. A plan's `visual-plan/plan.json`
(schema `visual-plan/v1`) is a coverage ledger + canvas (lanes, surface-locked
artboards, semantic-HTML wireframes, connectors, annotations). The CLI validates
and gates it; a transient 127.0.0.1 React studio renders and edits it.

```bash
# Deterministic contract commands
npx mewkit visual-plan validate <plan-dir> [--json]     # schema + coverage + refs + safe-HTML + hashes
npx mewkit visual-plan status <plan-dir> [--json]       # coverage summary + review status
npx mewkit visual-plan approve <plan-dir> --revision <n> # single writer of review.status (Gate 1)
npx mewkit visual-plan rehash <plan-dir>                # refresh source hashes (clears approval)
npx mewkit visual-plan export <plan-dir> --format html  # self-contained plan.html from the artifact

# Transient studio (127.0.0.1, exits with the process)
npx mewkit visual-plan view <plan-dir> [--no-open] [--port N]   # read-only
npx mewkit visual-plan edit <plan-dir> [--force]               # editable (single-editor lock)

# Feedback loop
npx mewkit visual-plan prepare-feedback <plan-dir> --ops <f.json>          # freeze an immutable batch
npx mewkit visual-plan apply-feedback <plan-dir> --batch <id> --check      # pre-apply stale gate
npx mewkit visual-plan apply-feedback <plan-dir> --batch <id> --receipt <f> # record per-op outcomes
npx mewkit visual-plan patch <plan-dir> --op <op.json>                     # apply one typed visual op
```

**Security:** the studio server binds 127.0.0.1 only, Host-header guarded against
DNS rebinding, path-traversal blocked, with a strict CSP (`script-src 'self'`).
Wireframe HTML is DOMPurify-sanitized at both save and render time via one shared
allowlist. Writes use optimistic concurrency (`PATCH` requires `If-Match`; 409 on
stale). These loopback primitives live in `src/local-web/`, ported in part from
[`patoles/agent-flow`](https://github.com/patoles/agent-flow) under Apache-2.0 —
see `NOTICE`.

## Related

- [GitHub](https://github.com/ngocsangyem/MeowKit)

## License

MIT

# mewkit

CLI for [MeowKit](https://github.com/ngocsangyem/MeowKit) — scaffold, migrate, upgrade, and manage your AI-agent toolkit. Requires Node.js ≥ 24.

## Install

```bash
npx mewkit init                  # provider picker (Claude Code / Codex / Cursor), then scaffold
npx mewkit init --target codex   # skip the picker — scaffold a Codex-native toolkit
npx mewkit <command>             # runtime commands (see below)
```

## Commands

| Command | Description |
| --- | --- |
| `mewkit init` | Scaffold or update a project. `--target <provider>`, `--profile`, `--dry-run`, `--force`, `--beta` |
| `mewkit upgrade` | Update to the latest release; auto-refreshes installed provider toolkits. `--check`, `--beta`, `--list` |
| `mewkit migrate <tool>` | Export the `.claude/` setup to Codex or Cursor. `--dry-run`, `--force`, `--global`, … |
| `mewkit pack` | Manage install packs: `list` / `add <pack>` / `remove <pack>` |
| `mewkit providers` | Show the supported-tool matrix. `--json`, `<provider>` |
| `mewkit memory` | View/manage `.meowkit/memory`: `--show`, `--stats`, `--clear`, `capture` |
| `mewkit doctor` | Diagnose environment (Node, Python, Git, `.meowkit/` / `.claude/` layout) |
| `mewkit validate` | Verify `.claude/` structure integrity. `--packs` |
| `mewkit setup` | Guided configuration (Python venv, MCP, `.env`, `.gitignore`) |
| `mewkit budget` | Token usage + cost. `--monthly`; `budget context` for per-profile size |
| `mewkit capabilities` | Resolve installed skills/commands for an intent: `list`, `explain`, `resolve`, `projections` |
| `mewkit visual-plan` | Structured visual plan: validate / approve / edit / view + feedback loop |
| `mewkit task` | `new` / `list` — structured task files |
| `mewkit status` | Print version, channel, and config |

## Init & targets

On a fresh install, `mewkit init` opens a provider multiselect — **Claude Code** (preselected), **Codex**, **Cursor** — and provisions each picked toolkit (Claude Code installs `.claude/` from the latest GitHub release). `--target` skips the picker.

- **`mewkit init --target codex`** — create a Codex-only project by copying the authored Codex bundle (`AGENTS.md`, `.codex/{config.toml,agents,hooks.json,hooks}`, `.agents/skills/`). No `.claude/`, no conversion.
- **`mewkit init --target cursor`** — unpack `.claude/`, then export to Cursor.
- **`mewkit init --profile <name>`** — install a right-sized subset (see Profiles).

## Migrate

`mewkit migrate <tool>` converts a Claude Code setup (agents, commands, skills, config, rules, hooks) into the target's native surfaces. Supported targets: **codex**, **cursor**. Idempotent — re-running over an unchanged source is a no-op, user-edited targets are kept unless `--force`, and every run previews with `--dry-run`.

```bash
npx mewkit migrate codex --dry-run     # plan + reference report, writes nothing
npx mewkit migrate codex               # migrate into the current project
npx mewkit migrate codex --include-mcp # also convert .mcp.json → [mcp_servers]
```

What migrates where for Codex:

| Source | Codex target |
| --- | --- |
| `.claude/agents/*.md` | `.codex/agents/*.toml` |
| `.claude/commands/**/*.md`, `.claude/skills/**` | `.agents/skills/*/SKILL.md` |
| `CLAUDE.md`, `.claude/rules/*.md` | `AGENTS.md` (merged, 32 KiB budget) |
| `.claude/hooks/*.cjs` | `.codex/hooks/` + `hooks.json` |
| `.mcp.json` (opt-in) | `config.toml [mcp_servers]` (`--include-mcp`) |

Markdown references are rewritten with a fence-aware classifier: inline refs are repointed, runnable fenced commands are rewritten only when the referenced asset migrates in the same run (otherwise preserved and listed in the dry-run report), and citations stay verbatim. Generated files carry no toolkit branding.

## Memory

Project memory lives in the runtime-neutral **`.meowkit/`** state root (`memory/`, `telemetry/`, `state/`, `cache/`), so the same state works across providers. Every structured write goes through one validated contract (schema → secret scrub → injection scan → lock → atomic replace). `mewkit migrate` safely relocates any legacy `.claude/memory/`, and `mewkit memory capture` routes a `##pattern` / `##decision` / `##note` prompt into the right store.

## Profiles & Packs

`init --profile <name>` installs a right-sized subset. Every profile ships the safety base (gate/privacy hooks, security rules, settings, statusline, core commands).

| Profile | Contents |
| --- | --- |
| `core` | base + lifecycle essentials + memory + utility |
| `developer` | core + testing + git + docs |
| `product` | developer + product / autobuild |
| `atlassian` | developer + Jira / Confluence |
| `security` | core + security audit |
| `research` | core + research / brainstorming |
| `full` | everything (default) |

Add or drop domains with `mewkit pack add|remove` (`remove` preserves shared, base-covered, and user-edited files). `mewkit budget context` estimates each profile's loadable context size; `mewkit validate --packs` checks manifest coherence and the safety invariant.

## Visual Plan

Structured visual review for UI-bearing plans. A plan's `visual-plan/plan.json` is a coverage ledger + canvas (lanes, artboards, semantic-HTML wireframes, connectors, annotations); the CLI validates and gates it, and a transient `127.0.0.1` React studio renders and edits it.

```bash
npx mewkit visual-plan validate <plan-dir> [--json]      # schema + coverage + refs + safe-HTML + hashes
npx mewkit visual-plan approve <plan-dir> --revision <n> # single writer of review.status (Gate 1)
npx mewkit visual-plan view <plan-dir>                   # read-only studio
npx mewkit visual-plan edit <plan-dir>                   # editable (single-editor lock)
```

**Security:** the studio binds `127.0.0.1` only, is Host-header guarded against DNS rebinding, blocks path traversal, and enforces a strict CSP (`script-src 'self'`). Wireframe HTML is DOMPurify-sanitized at save and render. The loopback primitives in `src/local-web/` are ported in part from [`patoles/agent-flow`](https://github.com/patoles/agent-flow) under Apache-2.0 — see `NOTICE`.

## Related

- [GitHub](https://github.com/ngocsangyem/MeowKit) · [Docs](https://docs.meowkit.dev)

## License

MIT

# mewkit

CLI for [MeowKit](https://github.com/ngocsangyem/MeowKit) — scaffold, upgrade, and manage your AI-agent toolkit. Requires Node.js ≥ 24.

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
| `mewkit pack` | Manage install packs: `list` / `add <pack>` / `remove <pack>` |
| `mewkit providers` | Show the supported-tool matrix. `--json`, `<provider>` |
| `mewkit memory` | View/manage `.meowkit/memory`: `--show`, `--stats`, `--clear`, `capture` |
| `mewkit doctor` | Diagnose environment (Node, Python, Git, `.meowkit/` / `.claude/` layout) |
| `mewkit validate` | Verify `.claude/` structure integrity. `--packs` |
| `mewkit setup` | Guided configuration (Python venv, MCP, `.env`, `.gitignore`) |
| `mewkit budget` | Token usage + cost. `--monthly`; `budget context` for per-profile size |
| `mewkit capabilities` | Resolve installed skills/commands for an intent: `list`, `explain`, `resolve`, `projections` |
| `mewkit task` | `new` / `list` — structured task files |

## Init & targets

On a fresh install, `mewkit init` opens a provider multiselect — **Claude Code** (preselected), **Codex**, **Cursor** — and provisions each picked toolkit (Claude Code installs `.claude/` from the latest GitHub release). `--target` skips the picker.

- **`mewkit init --target codex`** — create a Codex-only project by copying the authored Codex bundle (`AGENTS.md`, `.codex/{config.toml,agents,hooks.json,hooks}`, `.agents/skills/`). No `.claude/`, no conversion.
- **`mewkit init --target cursor`** — create a Cursor project by copying the authored Cursor bundle (`.cursor/{rules,agents,hooks,skills}`, `hooks.json`). No `.claude/`, no conversion.
- **`mewkit init --profile <name>`** — install a right-sized subset (see Profiles).

## Memory

Project memory lives in the runtime-neutral **`.meowkit/`** state root (`memory/`, `telemetry/`, `state/`, `cache/`), so the same state works across providers. Every structured write goes through one validated contract (schema → secret scrub → injection scan → lock → atomic replace). A legacy `.claude/memory/` is not imported; copy what you still need into `.meowkit/memory/`. `mewkit memory capture` routes a `##pattern` / `##decision` / `##note` prompt into the right store.

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

## Related

- [GitHub](https://github.com/ngocsangyem/MeowKit) · [Docs](https://docs.meowkit.dev)

## License

MIT

# create-meowkit

> **Deprecated.** Use `npx mewkit init` instead. This package still works for existing users but will not receive new features.

Scaffold the [MeowKit](https://github.com/ngocsangyem/MeowKit) AI agent toolkit into your project.

## Usage

```bash
npx mewkit init
```

## How it works

This is a thin CLI (~50KB). It downloads the latest release from [GitHub Releases](https://github.com/ngocsangyem/MeowKit/releases), extracts it, and installs `.claude/` into your project. No templates are bundled.

```
npx mewkit init
  → Fetches latest release from GitHub
  → Prompts for config (description, Gemini API key)
  → Downloads release zip
  → Scaffolds .claude/ into your project
  → Validates installation
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--force` | `-f` | Overwrite all files (ignore user modifications) |
| `--dry-run` | `-n` | Preview files without writing |
| `--beta` | | Use latest beta release |
| `--global` | `-g` | Install as global config (`~/.claude/`) |
| `--json` | | Structured JSON output for CI |
| `--verbose` | `-v` | Debug logging |

## What it installs

```
your-project/
├── CLAUDE.md              # Entry point for Claude Code
├── tasks/templates/       # Task templates
└── .claude/
    ├── agents/            # 14 specialist agents
    ├── skills/            # 49 skills (meow: namespace)
    ├── rules/             # 14 enforcement rules
    ├── hooks/             # 6 lifecycle hooks
    ├── commands/          # 18 slash commands
    ├── modes/             # 7 behavioral modes
    ├── scripts/           # Python validators + shell utilities
    └── settings.json
```

## Smart update

Re-running on an existing project preserves your modifications:

- **Core files** — overwritten only if unchanged (tracked via SHA-256 checksums)
- **User-modified files** — skipped with a warning
- **User config** (`CLAUDE.md`, `.env`, `meowkit.config.json`) — never overwritten

## After scaffold

```bash
npx mewkit setup      # Configure: Python venv, MCP, .env, .gitignore
npx mewkit doctor     # Verify environment
```

## Links

- [Documentation](https://github.com/ngocsangyem/MeowKit)
- [GitHub Releases](https://github.com/ngocsangyem/MeowKit/releases)
- [Runtime CLI: mewkit](https://www.npmjs.com/package/mewkit)

## License

MIT

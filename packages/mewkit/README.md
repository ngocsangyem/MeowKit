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

## Related

- [GitHub](https://github.com/ngocsangyem/MeowKit)

## License

MIT

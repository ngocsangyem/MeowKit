# meowkit-cli

Runtime CLI for [MeowKit](https://github.com/ngocsangyem/MeowKit) — manage your AI agent toolkit after installation.

## Install

```bash
npm install -g meowkit-cli
```

Or use directly:

```bash
npx meowkit-cli <command>
```

## Commands

| Command | Description |
|---------|-------------|
| `meowkit doctor` | Diagnose environment (Node.js, Python, Git, `.claude/` structure) |
| `meowkit setup` | Guided configuration (Python venv, MCP, .env, .gitignore) |
| `meowkit upgrade` | Update to latest version (`--check`, `--beta`, `--list`) |
| `meowkit validate` | Verify `.claude/` structure integrity |
| `meowkit budget` | Token usage and cost tracking (`--monthly`) |
| `meowkit memory` | View/manage cross-session memory (`--show`, `--stats`, `--clear`) |
| `meowkit status` | Print version, channel, and config |
| `meowkit task new` | Create structured task file from template |
| `meowkit task list` | List active tasks with status |

## Usage

```bash
# Post-install setup
meowkit setup

# Check environment
meowkit doctor

# Upgrade MeowKit
meowkit upgrade              # Latest stable
meowkit upgrade --beta       # Latest beta
meowkit upgrade --check      # Check without installing
meowkit upgrade --list       # Show all available versions

# View token costs
meowkit budget --monthly

# Manage memory
meowkit memory --show        # Display lessons learned
meowkit memory --clear       # Reset memory
```

## Related

- [create-meowkit](https://www.npmjs.com/package/create-meowkit) — Scaffold CLI (`npm create meowkit@latest`)
- [GitHub](https://github.com/ngocsangyem/MeowKit)

## License

MIT

# mewkit

Runtime CLI for [MeowKit](https://github.com/ngocsangyem/MeowKit) — manage your AI agent toolkit after installation.

## Install

```bash
npx mewkit <command>
```

## Commands

| Command             | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `meowkit doctor`    | Diagnose environment (Node.js, Python, Git, `.claude/` structure) |
| `meowkit setup`     | Guided configuration (Python venv, MCP, .env, .gitignore)         |
| `meowkit upgrade`   | Update to latest version (`--check`, `--beta`, `--list`)          |
| `meowkit validate`  | Verify `.claude/` structure integrity                             |
| `meowkit budget`    | Token usage and cost tracking (`--monthly`)                       |
| `meowkit memory`    | View/manage cross-session memory (`--show`, `--stats`, `--clear`) |
| `meowkit status`    | Print version, channel, and config                                |
| `meowkit task new`  | Create structured task file from template                         |
| `meowkit task list` | List active tasks with status                                     |

## Usage

```bash
# Post-install setup
npx mewkit setup

# Check environment
npx mewkit doctor

# Upgrade MeowKit
npx mewkit upgrade              # Latest stable
npx mewkit upgrade --beta       # Latest beta
npx mewkit upgrade --check      # Check without installing
npx mewkit upgrade --list       # Show all available versions

# View token costs
npx mewkit budget --monthly

# Manage memory
npx mewkit memory --show        # Display lessons learned
npx mewkit memory --clear       # Reset memory
```

## Related

- [create-meowkit](https://www.npmjs.com/package/create-meowkit) — Scaffold CLI (deprecated; use `npx mewkit init`)
- [GitHub](https://github.com/ngocsangyem/MeowKit)

## License

MIT

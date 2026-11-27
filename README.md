<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/branding/meow-logo-dark.svg" />
    <img src="assets/branding/meow-logo.svg" alt="MeowKit" width="320" />
  </picture>
</p>

<h1 align="center">MeowKit</h1>

<p align="center">
  <strong>AI agent toolkit for Claude Code, Codex, Cursor, Grok, Pi and OMP</strong><br>
  121 skills &middot; 42 agents &middot; 6 rules &middot; 28 hook scripts
</p>

<p align="center">
  <a href="https://meowkit.dev"><img src="https://img.shields.io/badge/website-meowkit.dev-2f66b3?style=flat" alt="Website" /></a>
  <a href="https://docs.meowkit.dev/"><img src="https://img.shields.io/badge/docs-docs.meowkit.dev-131a27?style=flat" alt="Docs" /></a>
  <a href="https://github.com/ngocsangyem/MeowKit/releases"><img src="https://img.shields.io/github/v/release/ngocsangyem/MeowKit" alt="GitHub release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-566178" alt="License" /></a>
</p>

---

> [!IMPORTANT]
> **The Node/npm `mewkit` CLI is no longer maintained.** Its last release is `mewkit@2.3.1`, and
> `npx mewkit` gets no new fixes or kit support. Use the native `mewkit` binary instead (short
> alias: `mk`). Install it as shown in [Install the CLI](#install-the-cli); moving over is covered
> in [Moving from `npx mewkit`](#moving-from-npx-mewkit) and the
> [installation guide](https://docs.meowkit.dev/installation).

## What is MeowKit

MeowKit is a kit of skills, agents, rules and hooks for AI coding agents. The native `mewkit` binary installs it into a project for Claude Code, Codex, Cursor, Grok, Pi or OMP. The kit is written once in `.claude/`, and `mewkit init` projects it into the files each runtime reads.

Once installed, the kit guides a 7-phase workflow, refuses a commit or push whose lint, related tests or type-check fail, blocks reads of credential files, and keeps a two-file team memory (`.meowkit/memory/decisions.md`, `gotchas.md`) that agents read with grep. The core workflow needs no external services.

**Homepage:** [meowkit.dev](https://meowkit.dev) &nbsp;·&nbsp; **Docs:** [docs.meowkit.dev](https://docs.meowkit.dev/)

## Quick Start

### Install the CLI

macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ngocsangyem/MeowKit/main/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ngocsangyem/MeowKit/main/install.ps1 | iex
```

The installer checks the archive's size and SHA-256 against the pins it carries, then puts
`mewkit` on your PATH with `mk` beside it. `mk` is the same binary under a shorter name, so
`mk doctor` and `mewkit doctor` do the same thing. Later updates come from `mewkit self-update`.

### Add MeowKit to a project

```bash
mewkit init
```

`init` downloads the newest kit release, checks it against the release's `checksums.txt`, and asks
which runtimes to set up. Pass `--target` to skip the question:

| Command | Installs for |
| --- | --- |
| `mewkit init --target claude-code` | Claude Code: `.claude/` |
| `mewkit init --target codex` | Codex |
| `mewkit init --target cursor` | Cursor |
| `mewkit init --target grok`, `pi` or `omp` | Grok, Pi or OMP (project scope only) |
| `mewkit init --target all` | Every runtime above |

Each runtime gets the skills and agents from `.claude/`, rewritten into the names, paths and tool
words it loads, plus its overlay from `kit/overlays/` (hooks, rules, always-on text). Where the
files land depends on which runtimes are installed together, because some read each other's
folders: [Portability](https://docs.meowkit.dev/cli/portability). Everything the kit writes at
runtime goes under `.meowkit/`.

Enforcement differs by runtime. The credential read guard and the ship check are hooks on all six;
the rest is advisory on most hosts. Codex runs a new or changed hook only after you review it.
Grok, Pi and OMP enforcement follows each vendor's documentation and has not been run in a live
session. The full table: [Enforcement & Security](https://docs.meowkit.dev/core-concepts/enforcement).
`mewkit providers <runtime> --lifecycle` shows the same for one runtime.

`mewkit upgrade` moves the kit to a newer release. It removes files the new kit dropped and keeps
files you changed. `mewkit uninstall` removes what the install recorded. Commit
`.meowkit/state/ownership/*.json` so a clone carries that record.

#### Claude Code as a plugin

```bash
mewkit init --target claude-code --delivery plugin
```

Same content as the default install, plus the `.claude-plugin/plugin.json` manifest Claude Code
reads to load the kit as a plugin. `--delivery` applies to Claude Code only. MeowKit is not
published to a plugin marketplace, so `claude plugin marketplace add` has nothing to install.

### Setup

```bash
mewkit setup
```

This copies `.mcp.json` from the kit's example, creates `.meowkit/.env` for API keys, and writes
`.meowkit/.gitignore`. Skills that run Python get their own environment under
`.meowkit/envs/<skill>/`: pass `--skills <a,b>` or run `mewkit skill env <skill>`.
`--system-deps` offers to install ImageMagick, FFmpeg and Playwright browsers. `--dry-run` shows
what would change. Safe to re-run after an upgrade.

To get `docs/project-context.md`, the conventions file every agent loads, run
`/mk:project-context generate` in your first session.

To verify your environment after setup:

```bash
mewkit doctor     # Verify environment
```

### What `doctor` reports

Besides the toolchain and the installs at each scope, `doctor` reports where
MeowKit shares a host with something else, and when a check is installed but not
doing its job. These rows are `ok` or `warn` and change no exit code, except
`kit copies: unrecorded` and a lost rule in `rules: always-on`, which fail; add `--json` for the same rows as
`{name, status, detail}`.

| Row | Warns when |
| --- | --- |
| `coexistence: agent names` | the same agent name is defined in the project and in your home directory. The nearer definition wins, per the hosts' own documentation — not verified here |
| `coexistence: foreign hooks` | a hook this install does not own runs on an event it also uses. Named by executable only; arguments are not read. Every matching hook runs and a deny wins, so a foreign hook cannot override a MeowKit guard |
| `coexistence: instruction files` | another always-on instruction source is present — a user-level instruction file, user rules, or the same rule file name at both scopes, where both copies load |
| `coexistence: skill listing` | the skill names and descriptions every installed toolkit shares exceed the figure above which a host may start dropping descriptions. The row prints each source's count and characters so you can judge against your own context window |
| `coexistence: cross-runtime load` | an installed runtime loads the kit's skills, agents or hooks from more than one root in this project, because it also reads another installed runtime's tree (Cursor, for one, also loads `.claude/` and `.agents/skills`). The row lists each second root with the vendor setting that stops the load, where one is documented; every matching hook runs once per copy |
| `kit copies: unrecorded` | **fails** when a copy of a kit skill or agent that no install here recorded sits under a second root an installed runtime reads, for example `.pi/skills/mk-cook` beside `.agents/skills/mk-cook`. It loads beside the installed one and no upgrade or uninstall removes it; delete what the row lists |
| `checks: weakened` | an observer is toggled off in a config file, `MEOWKIT_HOOK_PROFILE=fast` or the Cursor kill switch is set in the environment, or a host setting (`disableAllHooks`, `allowManagedHooksOnly`, the Codex hooks feature) stops kit hooks from running. The privacy block and the ship check cannot be switched off by config at all |
| `guards: integrity` | an installed guard file no longer matches the bytes recorded at install, or a hook registration names a file that is not there |
| `rules: always-on` | **fails** when one of the six always-on rule files of a Claude Code tree, or a rule file another runtime's install recorded, is missing or holds only whitespace. Warns when the project's session marker log claims the safety baseline is verified but the rule files no longer match the digest the marker recorded, or the marker was written by an older hook that recorded no digest |

The coexistence rows read names, sizes and hook executable names outside the
project — never a file's body beyond its frontmatter, never an environment
value, and never through a symlink inside a scanned tree. Host configuration
files are read under a size cap, and anything that is not a plain file (a named
pipe, a device) is reported unread rather than opened. A home directory that
cannot be read is one scope fewer, reported in the row, not an error. Plugin
directories are not scanned, and a directory with more than 200 entries makes
the counts a floor, which the row says.
`.meowkit/host-guard-profile.example.json` in this repository is an optional
host profile to copy into your own settings: it makes the session refuse to
write the files `guards: integrity` watches. It is a reference to merge by hand,
not a file `mewkit init` installs.

**What `doctor` cannot see.** It reads files, not hosts. It has no way to learn
which version of your host you are running, so it does not
report whether your host is new enough for `privacy-block` to fail closed on a
hook error — check your host's version yourself if that matters to you. It
reads `allowManagedHooksOnly` and `allow_managed_hooks_only` only from the
project's and your home directory's own config; a machine-wide managed policy
lives outside both and is invisible here. Nor can it tell whether Codex has
been asked to trust a changed hook, or whether a session was started in a
subdirectory that has no `.claude/` — both stop installed hooks from running
with nothing on disk to show it.

## Moving from `npx mewkit`

1. Install the binary as shown in [Install the CLI](#install-the-cli).
2. Remove the npm package wherever you installed it: `npm uninstall -g mewkit`, or drop
   `mewkit` from a project's `devDependencies`.
3. Run `mewkit doctor` in each project. The kit already in `.claude/` and `.meowkit/` keeps
   working; `mewkit upgrade` takes it forward from here.

Hooks look for the binary on your PATH first. A project that still has the npm CLI in
`node_modules/.bin` keeps running it until you remove it.

## Requirements

- The `mewkit` binary (see [Install the CLI](#install-the-cli))
- Node.js 24+ (the kit's hooks run on Node)
- Python 3.9+ (optional — only for the skills that run Python; the core workflow needs none)
- Git

## Project Structure

```
meowkit/
├── .claude/                  Source of truth — agents, skills, rules, hooks
│   ├── agents/               42 specialist agents
│   ├── skills/               121 skills (mk: namespace) — 121 ship; benchmark is maintainer-only
│   ├── rules/                6 enforcement rules (always-on)
│   ├── hooks/                28 hook scripts (dispatch, pre-ship, privacy-block, append-trace + 24 handlers) and their libraries
│   ├── statusline.cjs
│   └── settings.json
├── .meowkit/memory/          Team store: decisions.md + gotchas.md (committed)
├── crates/                   The mewkit CLI (Rust): mewkit-cli, mewkit-core, mewkit-adapters
├── kit/overlays/             What one runtime needs and cannot be derived: codex, cursor, grok, pi, omp, antigravity, shared
├── packages/
│   ├── docs/                 Documentation site (docs.meowkit.dev, Fumadocs)
│   └── landing/              Landing page (meowkit.dev, Nuxt + Tailwind v4)
├── scripts/                  Release and validation scripts
├── install.sh, install.ps1   Binary installers, pinned to one binary release
├── CLAUDE.md                 Maintainer guide for this repo (not shipped to projects)
└── .github/workflows/        ci.yml (kit and docs), rust-ci.yml, release*.yml (beta and stable releases)
```

## Releasing

See **[RELEASING.md](RELEASING.md)** for the complete release guide — manual steps, CI/CD automation, troubleshooting.

## Development

```bash
cargo build -p mewkit-cli          # Build the CLI (target/debug/mewkit)
cargo test --workspace             # CLI tests
pnpm install                       # Dependencies for the hook, script and docs tests
npm test                           # Hook, script and kit tests
npm run lint                       # Lint
```

## License

MIT

## Inspiration

- [gstack](https://github.com/garrytan/gstack) — Skills, review patterns, ship workflow
- [antigravity-kit](https://github.com/vudovn/antigravity-kit) — Clean code standards, vulnerability scanning
- [aura-frog](https://github.com/nguyenthienthanh/aura-frog) — Agent detection, workflow orchestration
- [claudekit-engineer](https://claudekit.cc) — Cook/fix pipelines, release model

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/branding/meow-logo-dark.svg" />
    <img src="assets/branding/meow-logo.svg" alt="MeowKit" width="320" />
  </picture>
</p>

<h1 align="center">MeowKit</h1>

<p align="center">
  <strong>AI agent toolkit for Claude Code</strong><br>
  127 skills &middot; 42 agents &middot; 6 rules &middot; 26 hook scripts &middot; 4-layer+ security
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

MeowKit installs a `.claude/` directory that Claude Code reads at session start. It guides a structured 7-phase workflow, refuses a commit or push whose lint, related tests or type-check fail, blocks reads of credential files, and keeps a two-file team memory store (`.meowkit/memory/decisions.md`, `gotchas.md`) read by grep. Zero external dependencies for core workflow.

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

MeowKit installs two ways. Pick **one** per project — running both resolves the
same skills and agents twice (`mewkit doctor` warns when it detects both).

### Flat-copy (default, supported)

```bash
mewkit init
```

The CLI fetches the latest release from GitHub, prompts for config, and scaffolds `.claude/` and `.meowkit/` into your project — the only two directories it adds. Skills resolve as `/mk:*`, agents as `mk:*`.

### Native plugin (recommended on Claude Code; experimental on Codex)

Installs the `mk` plugin from the MeowKit marketplace. Skills (`/mk:*`), agents (`mk:*`), and hooks all resolve under the plugin; nothing is copied into your project.

> **Codex support is an experimental projection.** On Claude Code and Codex the ship check and the credential guard run as hooks; Codex runs a new or changed hook only after the user reviews it, and the rest of the Codex projection is advisory. What each runtime enforces: `docs/core/enforcement-matrix.md`. Run `mewkit providers codex --lifecycle` to see exactly what is enforced vs advisory.
>
> **Codex and Cursor are projected from the one authored kit.** `mewkit init --target codex|cursor` rewrites the skills and agents under `.claude/` into the form that runtime loads (names, paths, tool words) and adds that runtime's overlay from `kit/overlays/`: hooks, rules and the always-on text, which cannot be derived. CI checks the installed result (instruction criteria, references that resolve, denied tokens, install idempotency). That is evidence the installed files are well formed, not of identical behavior across hosts.
>
> **Validate a generated Codex project** with `mewkit validate --target codex <dir>` — a read-only post-install gate that checks the config/hook wiring, that hook wrappers exist + are executable + carry the deny contract, that agent TOMLs parse, and that installed skills declare a supported runtime and carry no host-bound tool tokens. `mewkit doctor --providers` run inside a Codex project recognizes it and points at this command.

```bash
mewkit init --target claude-code --delivery plugin
```

The plugin shape is produced by the install itself, which is why there is nothing to build ahead of
time: the same emitter writes the kit's skills, agents and hooks for both deliveries, and
`--delivery plugin` adds the `.claude-plugin/plugin.json` manifest the host reads. There is no
`build-plugin` verb, no committed `plugin/` payload, and no marketplace publication — MeowKit is not
published to a plugin marketplace, so `claude plugin marketplace add` and its Codex equivalent have
nothing to resolve. Run `mewkit providers claude-plugin --lifecycle` to see what the plugin delivery
enforces.

### Setup (required for Python skills)

After installing MeowKit, run:

```bash
mewkit setup
```

This writes `.mcp.json` and `.meowkit/.env`, extends `.gitignore`, seeds
`docs/project-context.md`, and prepares the per-skill Python environments under
`.meowkit/envs/<skill>/` — one environment per skill, created on demand rather
than one shared venv. `--system-deps` interactively prompts for optional system
deps (ImageMagick, FFmpeg, Playwright browsers).

Run once per project. Idempotent — safe to re-run after upgrades.

To verify your environment after setup:

```bash
mewkit doctor     # Verify environment
```

### What `doctor` reports

Besides the toolchain and the installs at each scope, `doctor` reports where
MeowKit shares a host with something else, and when a check is installed but not
doing its job. These rows are `ok` or `warn` and never `fail`, so they change no
exit code; add `--json` for the same rows as `{name, status, detail}`.

| Row | Warns when |
| --- | --- |
| `coexistence: agent names` | the same agent name is defined in the project and in your home directory. The nearer definition wins, per the hosts' own documentation — not verified here |
| `coexistence: foreign hooks` | a hook this install does not own runs on an event it also uses. Named by executable only; arguments are not read. Every matching hook runs and a deny wins, so a foreign hook cannot override a MeowKit guard |
| `coexistence: instruction files` | another always-on instruction source is present — a user-level instruction file, user rules, or the same rule file name at both scopes, where both copies load |
| `coexistence: skill listing` | the skill names and descriptions every installed toolkit shares exceed the figure above which a host may start dropping descriptions. The row prints each source's count and characters so you can judge against your own context window |
| `coexistence: cross-runtime load` | one project carries the kit for Cursor and for another runtime. Cursor also loads `.claude/` and `.codex/` by default, so both hook sets fire and every skill and agent appears twice |
| `checks: weakened` | an observer is toggled off in a config file, `MEOWKIT_HOOK_PROFILE=fast` or the Cursor kill switch is set in the environment, or a host setting (`disableAllHooks`, `allowManagedHooksOnly`, the Codex hooks feature) stops kit hooks from running. The privacy block and the ship check cannot be switched off by config at all |
| `guards: integrity` | an installed guard file no longer matches the bytes recorded at install, or a hook registration names a file that is not there |

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
which version of Claude Code, Codex or Cursor you are running, so it does not
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
│   ├── skills/               127 skills (mk: namespace) — 126 ship; benchmark is maintainer-only
│   ├── rules/                6 enforcement rules (always-on)
│   ├── hooks/                26 hook scripts — lifecycle hooks + handlers — plus their libraries
│   ├── statusline.cjs
│   └── settings.json
├── .meowkit/memory/          Team store: decisions.md + gotchas.md (committed)
├── crates/                   The mewkit CLI (Rust)
├── kit/overlays/             What only Codex or Cursor needs: hooks, rules, catalogs
├── packages/
│   └── landing/              Landing page (meowkit.dev, Nuxt + Tailwind v4)
├── scripts/                  Release automation
├── packages/docs/            Fumadocs documentation
├── CLAUDE.md                 Maintainer guide for this repo (not shipped to projects)
├── .releaserc.cjs            Semantic release config
└── .github/workflows/        CI/CD (release, beta, PR validation)
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

<p align="center">
  <img src="assets/branding/meowkit-logo-black.png" alt="MeowKit Banner" width="300px" height="300px" />
</p>

<h1 align="center">MeowKit</h1>

<p align="center">
  <strong>AI agent toolkit for Claude Code</strong><br>
  74+ skills &middot; 16+ agents &middot; 20+ commands &middot; 7 modes &middot; 18 rules &middot; 14+ hooks &middot; 4-layer+ security
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mewkit"><img src="https://img.shields.io/npm/v/mewkit" alt="npm version" /></a>
  <a href="https://github.com/ngocsangyem/MeowKit/releases"><img src="https://img.shields.io/github/v/release/ngocsangyem/MeowKit" alt="GitHub release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

---

## What is MeowKit

MeowKit installs a `.claude/` directory that Claude Code reads at session start. It enforces a structured 7-phase workflow with hard gates, TDD, security scanning, and scoped topic-file memory (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`). Zero external dependencies for core workflow.

**Documentation:** [docs.meowkit.dev](https://docs.meowkit.dev/) (VitePress)

## Quick Start

```bash
npx mewkit init
```

The CLI fetches the latest release from GitHub, prompts for config, and scaffolds `.claude/` into your project.

### Setup (required for Python skills)

After installing MeowKit, run:

```bash
npx mewkit setup
```

This creates the Python venv at `.claude/skills/.venv`, installs pip packages
(`google-genai`, `pillow`, `python-dotenv`), and interactively prompts for
optional system deps (ImageMagick, FFmpeg, Playwright browsers).

Run once per project. Idempotent — safe to re-run after upgrades.

To verify your environment after setup:

```bash
npx mewkit doctor     # Verify environment
```

## Packages

| Package                                          | npm                | Description                                           |
| ------------------------------------------------ | ------------------ | ----------------------------------------------------- |
| [`mewkit`](https://www.npmjs.com/package/mewkit) | `npx mewkit <cmd>` | CLI — init, upgrade, doctor, validate, budget, memory |

## Requirements

- Node.js 20+
- Python 3.9+ (stdlib only, for validation scripts)
- Git

## Project Structure

```
meowkit/
├── .claude/                  Source of truth — agents, skills, rules, hooks
│   ├── agents/               16 specialist agents
│   ├── skills/               74 skills (meow: namespace)
│   ├── rules/                18 enforcement rules
│   ├── hooks/                14+ lifecycle hooks + handler libs
│   ├── commands/             20 slash commands
│   ├── modes/                7 behavioral modes
│   ├── memory/               Machine-local topic files (gitignored; scaffolded by `mewkit setup`)
│   ├── scripts/              Python validators + shell utilities
│   └── settings.json
├── tasks/                    Task templates
├── packages/
│   └── mewkit/               CLI (npm as mewkit)
├── scripts/                  Release automation
├── website/                  VitePress documentation
├── CLAUDE.md                 Entry point for Claude Code
├── .releaserc.cjs            Semantic release config
└── .github/workflows/        CI/CD (release, beta, PR validation)
```

## Releasing

See **[RELEASING.md](RELEASING.md)** for the complete release guide — manual steps, CI/CD automation, troubleshooting.

## Development

```bash
npm install              # Install dependencies
npm run build            # Build both packages
npm test                 # Run tests
npm run lint             # Lint
npm run typecheck        # Type check
```

## License

MIT

## Inspiration

- [gstack](https://github.com/garrytan/gstack) — Skills, review patterns, ship workflow
- [antigravity-kit](https://github.com/vudovn/antigravity-kit) — Clean code standards, vulnerability scanning
- [aura-frog](https://github.com/nguyenthienthanh/aura-frog) — Agent detection, workflow orchestration
- [claudekit-engineer](https://claudekit.cc) — Cook/fix pipelines, release model

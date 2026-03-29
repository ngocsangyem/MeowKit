<p align="center">
  <img src="assets/branding/logo.png" alt="MeowKit Banner" width="300px" height="300px" />
</p>

<h1 align="center">MeowKit</h1>

<p align="center">
  <strong>AI agent toolkit for Claude Code</strong><br>
  49 skills &middot; 14 agents &middot; 18 commands &middot; 7 modes &middot; 14 rules &middot; 6 hooks &middot; 4-layer security
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-meowkit"><img src="https://img.shields.io/npm/v/create-meowkit" alt="npm version" /></a>
  <a href="https://github.com/ngocsangyem/MeowKit/releases"><img src="https://img.shields.io/github/v/release/ngocsangyem/MeowKit" alt="GitHub release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

---

## What is MeowKit

MeowKit installs a `.claude/` directory that Claude Code reads at session start. It enforces a structured 7-phase workflow with hard gates, TDD, security scanning, and cross-session memory. Zero external dependencies for core workflow.

**Documentation:** [meowkit.dev](https://meowkit.dev) (VitePress)

## Quick Start

```bash
npm create meowkit@latest
```

The CLI fetches the latest release from GitHub, prompts for config, and scaffolds `.claude/` into your project.

```bash
npx meowkit-cli setup      # Configure: Python venv, MCP, .env, .gitignore
npx meowkit-cli doctor     # Verify environment
```

## Packages

| Package                                                          | npm                         | Description                                             |
| ---------------------------------------------------------------- | --------------------------- | ------------------------------------------------------- |
| [`create-meowkit`](https://www.npmjs.com/package/create-meowkit) | `npm create meowkit@latest` | Scaffold CLI — downloads release from GitHub            |
| [`meowkit-cli`](https://www.npmjs.com/package/meowkit-cli)       | `npx meowkit-cli <cmd>`     | Runtime CLI — upgrade, doctor, validate, budget, memory |

## Requirements

- Node.js 20+
- Python 3.9+ (stdlib only, for validation scripts)
- Git

## Project Structure

```
meowkit/
├── .claude/                  Source of truth — agents, skills, rules, hooks
│   ├── agents/               14 specialist agents
│   ├── skills/               49 skills (meow: namespace)
│   ├── rules/                14 enforcement rules
│   ├── hooks/                6 lifecycle hooks
│   ├── commands/             18 slash commands
│   ├── modes/                7 behavioral modes
│   ├── scripts/              Python validators + shell utilities
│   └── settings.json
├── tasks/                    Task templates
├── packages/
│   ├── create-meowkit/       Scaffold CLI (npm)
│   └── meowkit/              Runtime CLI (npm as meowkit-cli)
├── scripts/                  Release automation
├── website/                  VitePress documentation
├── CLAUDE.md                 Entry point for Claude Code
├── .releaserc.cjs            Semantic release config
└── .github/workflows/        CI/CD (release, beta, PR validation)
```

## Release & Publishing

### How releases work

1. **Source of truth:** `.claude/`, `tasks/`, `CLAUDE.md` at repo root
2. **GitHub Release:** `prepare-release-assets.cjs` zips these into `meowkit-release.zip`
3. **npm CLI:** `create-meowkit` is a thin CLI that downloads the zip at runtime
4. **Version channels:** `main` branch = stable, `dev` branch = beta

### Manual release

```bash
# 1. Build release assets
node scripts/prepare-release-assets.cjs "<version>"

# 2. Tag and push
git tag v<version>
git push origin v<version>

# 3. Create GitHub release
gh release create v<version> dist/meowkit-release.zip#"MeowKit Release Package" \
  --title "v<version>" --notes "Release notes here"

# 4. Publish CLI packages to npm
cd packages/create-meowkit && npm publish
cd ../meowkit && npm publish
```

### Automated release (CI/CD)

Push to `main` or `dev` triggers GitHub Actions:

- Semantic-release analyzes commits, determines version
- Syncs version across both packages
- Builds release zip, creates GitHub Release
- Publishes both packages to npm

```bash
# Conventional commits drive version bumps
feat: new skill      → MINOR (0.1.0 → 0.2.0)
fix: skill bug       → PATCH (0.2.0 → 0.2.1)
feat!: breaking      → MAJOR (0.2.1 → 1.0.0)
```

### Release scripts

| Script                                  | Purpose                                 |
| --------------------------------------- | --------------------------------------- |
| `scripts/sync-package-versions.cjs`     | Sync version across both packages       |
| `scripts/generate-release-manifest.cjs` | SHA-256 checksums for all release files |
| `scripts/prepare-release-assets.cjs`    | Metadata + manifest + zip archive       |

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

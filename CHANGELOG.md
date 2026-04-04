# Changelog

All notable changes to MeowKit are documented here.

See [website changelog](https://meowkit.dev/changelog)

## 2.1.0 (2026-04-04)

Custom statusline, dependency management, SEO, and mewkit CLI improvements.

### Custom Statusline

- **`.claude/statusline.cjs`** — 5-line ANSI status bar for Claude Code: model+tier, context usage bar with `/clear` warning at 60%/80%, active plan+phase tracking, 5h/weekly rate limits with reset countdown, token usage breakdown
- **Smart update permissions** — `mewkit init` auto-sets executable on `.cjs` files
- **Settings merge** — preserves new top-level keys (like `statusLine`) during updates

### Dependency Management

- **Install prompt during init** — asks "Install Python skill dependencies?" after project description (default: no). Installs into `.claude/skills/.venv` only
- **Per-skill requirements.txt** — walks `skills/*/scripts/requirements.txt`, merges and deduplicates with input validation
- **`mewkit setup --only=deps`** — manual re-run with smart skip (verifies already-installed)
- **`mewkit doctor` pip check** — verifies installed pip packages against expected skill dependencies
- **Security** — package name validation, path traversal prevention, 120s pip timeout, `execFileSync` array args

### mewkit CLI

- **Version picker** — shows top 4 versions + "Enter version manually..." option
- **Cross-platform Python detection** — `where` on Windows, `py` launcher support

### SEO

- Sitemap generation, robots.txt, OG/Twitter meta tags, canonical URLs

## 2.0.1 (2026-04-04)

- Update branding assets and implement custom 404 error page

## 2.0.0 (2026-04-04) — The Leverage Release

Extracted high-leverage patterns from ECC's 38-agent ecosystem. 5 new skills, 17 reference merges, hook profiling, naming cleanup, rule relaxations.

## 1.6.0 (2026-04-04)

- Add Jira skill and expanded skill definitions

## 1.5.0 (2026-04-03)

- Add v1.4.0 changelog detailing plan red-team, personas, parallel execution, and two-approach workflow modes

## 1.4.0 (2026-04-03) — The Plan Intelligence Release

Dedicated plan red-team with CK-style adjudication, plan-specific personas, and new workflow modes.

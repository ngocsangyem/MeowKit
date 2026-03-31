# Releasing MeowKit

Complete guide to building, tagging, and publishing MeowKit releases.

## Architecture

```
Source of truth (.claude/, tasks/, CLAUDE.md)
    ↓
prepare-release-assets.cjs → dist/meowkit-release.zip
    ↓
GitHub Release (tag + zip asset)
    ↓
create-meowkit CLI fetches zip at npm create meowkit@latest
```

**Key insight:** `create-meowkit` is a thin CLI that downloads `meowkit-release.zip` from GitHub Releases at runtime. If the release has no zip asset, the CLI cannot find it and falls back to an older version.

## Version Channels

| Branch | npm Tag   | GitHub Release | Example         |
| ------ | --------- | -------------- | --------------- |
| `main` | `@latest` | Stable         | `v1.2.0`        |
| `dev`  | `@beta`   | Pre-release    | `v1.3.0-beta.1` |

## Manual Release (Step-by-Step)

### 1. Update VitePress docs

Create the what's-new page and update affected docs BEFORE tagging.

#### 1a. Create what's-new page

```bash
# Create new version page
website/guide/whats-new/v<version>.md
```

Use this frontmatter and structure:

```yaml
---
title: "v<version> — <Release Title>"
description: "<One-line summary>"
persona: A
---
```

Include: features, flow diagrams (Mermaid), files changed table.

#### 1b. Update VitePress sidebar

In `website/.vitepress/config.ts`, add the new version to the sidebar:

```ts
{ text: 'v<version> — <Title>', link: '/guide/whats-new/v<version>' },
```

Add above the previous version entry in the `What's New` collapsed section.

#### 1c. Update what's-new index

In `website/guide/whats-new.md`, add a summary section for the new version at the top of the `## Releases` section.

#### 1d. Update affected guide pages

Check and update these pages if the release affects them:

| Page                                | Update when                                      |
| ----------------------------------- | ------------------------------------------------ |
| `guide/memory-system.md`            | Memory schema, capture, or consolidation changes |
| `guide/workflow-phases.md`          | Phase behavior changes (new steps, hook changes) |
| `guide/agent-skill-architecture.md` | New skills, agents, or Mermaid diagram changes   |
| `guide/model-routing.md`            | Model tier or routing changes                    |
| `reference/agents/*.md`             | Agent capability changes                         |
| `reference/skills/*.md`             | Skill behavior or schema changes                 |

#### 1e. Verify VitePress builds

```bash
cd website && npx vitepress build
```

Must complete with no errors. Chunk size warnings are normal.

### 2. Update CHANGELOG.md

Add a new version section at the top of `CHANGELOG.md`:

```markdown
## [<version>](https://github.com/ngocsangyem/MeowKit/releases/tag/v<version>) (YYYY-MM-DD)

### Features

- **feature name** — description

### Documentation

- description of doc changes

### Bug Fixes (if any)

- description
```

Follow the existing format. Use `**bold**` for feature names and `—` (em dash) before descriptions.

### 3. Bump versions

```bash
npm -w packages/create-meowkit version <version> --no-git-tag-version
npm -w packages/meowkit version <version> --no-git-tag-version
```

### 4. Build and verify

```bash
npm run build
npm run lint
npm run typecheck
npm test
```

### 5. Build release assets

```bash
node scripts/prepare-release-assets.cjs "<version>"
```

This creates:

- `.claude/metadata.json` — version metadata
- `release-manifest.json` — SHA-256 checksums for all files
- `dist/meowkit-release.zip` — the release package (`.claude/` + `tasks/` + `CLAUDE.md` + manifest)

Verify the zip:

```bash
python3 -c "import os,zipfile; z=zipfile.ZipFile('dist/meowkit-release.zip'); print(f'Size: {os.path.getsize(\"dist/meowkit-release.zip\")/1024:.0f} KB, Files: {len(z.namelist())}')"
```

### 6. Commit and tag

```bash
git add -A
git commit -m "chore: release v<version>"
git tag -a v<version> -m "v<version> — <release title>

<Brief description of what changed>"
```

### 7. Push to GitHub

```bash
git push origin main
git push origin v<version>
```

### 8. Create GitHub Release with zip

**This is the critical step.** The zip file MUST be attached as a release asset.

````bash
gh release create v<version> dist/meowkit-release.zip \
  --title "v<version> — <release title>" \
  --notes-file - <<'NOTES'
## <Release Title>

<Release notes in markdown>

### Install

```bash
npm create meowkit@latest
# or upgrade:
npx mewkit upgrade
````

Upload separately:

```bash
gh release create v<version> --title "..." --notes "..."
gh release upload v<version> /tmp/meowkit-v<version>.zip --clobber
```

### 9. Verify the release

```bash
# Check tag exists
git tag | grep v<version>

# Check zip is attached
gh release view v<version> --json assets -q '.assets[].name'
# Must show: meowkit-release.zip or meowkit-v<version>.zip

# Check release URL
gh release view v<version> --json url -q '.url'
```

### 10. Publish to npm (if package versions bumped)

```bash
npm -w packages/create-meowkit publish
npm -w packages/meowkit publish
```

### 11. Test end-to-end

```bash
npx create-meowkit@latest test-project
# Should fetch the new version
```

## Release Checklist

Copy this checklist for each release:

```markdown
## Release v<version> Checklist

### Docs

- [ ] Created `website/guide/whats-new/v<version>.md`
- [ ] Updated `website/.vitepress/config.ts` sidebar
- [ ] Updated `website/guide/whats-new.md` index
- [ ] Updated affected guide/reference pages
- [ ] VitePress build passes (`npx vitepress build`)

### Changelog

- [ ] Added v<version> section to `CHANGELOG.md`

### Build

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes

### Release

- [ ] `prepare-release-assets.cjs` ran successfully
- [ ] `dist/meowkit-release.zip` exists with expected size
- [ ] Committed and tagged
- [ ] Pushed to GitHub (commits + tag)
- [ ] GitHub Release created with zip asset
- [ ] Release notes include install instructions

### Verify

- [ ] `gh release view v<version>` shows asset
- [ ] `npx create-meowkit@latest` fetches new version (if npm published)
```

## Automated Release (CI/CD)

Push to `main` or `dev` triggers `.github/workflows/release.yml`:

1. Semantic-release analyzes conventional commits → determines version bump
2. `sync-package-versions.cjs` syncs version across both packages
3. `prepare-release-assets.cjs` builds zip + metadata + manifest
4. `@semantic-release/github` creates GitHub Release with zip asset
5. `@semantic-release/exec` publishes both packages to npm
6. `@semantic-release/git` commits version files back to repo

**Note:** Automated releases do NOT update VitePress docs or CHANGELOG.md. Those must be done manually before the release commit.

### Conventional commits → version bumps

```
feat: new skill            → MINOR (1.0.0 → 1.1.0)
fix: skill bug             → PATCH (1.1.0 → 1.1.1)
feat!: breaking change     → MAJOR (1.1.1 → 2.0.0)
chore: cleanup             → no release
docs: update readme        → no release
```

## Release Scripts

| Script                                  | Purpose                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| `scripts/sync-package-versions.cjs`     | Sync version across both npm packages                     |
| `scripts/generate-release-manifest.cjs` | Generate SHA-256 checksums for all release files          |
| `scripts/prepare-release-assets.cjs`    | Build metadata.json + manifest + dist/meowkit-release.zip |

## Release History

| Version | Date       | Title                            |
| ------- | ---------- | -------------------------------- |
| v1.3.0  | 2026-03-31 | The Integration Integrity Release |
| v1.2.1  | 2026-03-31 | Memory capture enforcement fix    |
| v1.2.0  | 2026-03-31 | The Memory Activation Release    |
| v1.1.0  | 2026-03-30 | The Reasoning Depth Release      |
| v1.0.0  | 2026-03-30 | The Disciplined Velocity Release |
| v0.1.2  | 2026-03-29 | Interactive version selection     |
| v0.1.1  | 2026-03-29 | Runtime dir exclusion fix         |
| v0.1.0  | 2026-03-29 | Initial pre-release               |

## Troubleshooting

### `create-meowkit` fetches wrong version

**Cause:** The target release has no `meowkit-release.zip` asset. The code in `github-releases.ts` filters out releases without a `.zip` asset.

**Fix:** Upload the zip to the release:

```bash
gh release upload v<version> dist/meowkit-release.zip --clobber
```

### Tag already exists

```bash
git tag -d v<version>                    # delete local
git push origin :refs/tags/v<version>    # delete remote
git tag -a v<version> -m "message"       # recreate
git push origin v<version>               # push
```

### npm publish fails with 403

Check you're logged in: `npm whoami`. Check package name isn't taken. Check `publishConfig` in package.json.

### GitHub Release exists but no zip

```bash
gh release upload v<version> dist/meowkit-release.zip --clobber
```

### Semantic-release skips release

No `feat:` or `fix:` commits since last release. Add a commit with the right prefix, or use `--force` on the workflow dispatch.

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
mewkit CLI fetches zip at npx mewkit init
```

**Key insight:** `mewkit` CLI downloads `meowkit-release.zip` from GitHub Releases at runtime. If the release has no zip asset, the CLI cannot find it and falls back to an older version.

## Version Channels

| Branch | npm Tag   | GitHub Release | Example         |
| ------ | --------- | -------------- | --------------- |
| `main` | `@latest` | Stable         | `v1.2.0`        |
| `dev`  | `@beta`   | Pre-release    | `v1.3.0-beta.1` |

## Quick Release (Script)

For standard releases, use the release script:

```bash
./scripts/release.sh <version> "<release title>"
```

Example:

```bash
./scripts/release.sh 2.3.2 "The Agent-Skills Integration Release"
```

The script automates steps 3-9 below: bump version → build/lint/typecheck/test → prepare release assets → VitePress build check → commit + tag → push → create GitHub Release with zip. Stops on any failure, warns on uncommitted changes.

**Before running the script:** Complete step 2 (update CHANGELOG) manually. If the release affects guide/reference pages, complete step 1a as well.

**After the script:** Run step 10 (npm publish) and step 11 (end-to-end test) manually.

## Manual Release (Step-by-Step)

### 1. Update CHANGELOG and affected docs

Update the changelog and any affected guide/reference pages BEFORE tagging.

**Patch releases:** Only update `website/changelog.md` (step 2). Skip the doc update step below unless a guide page documents behavior that changed.

#### 1a. Update affected guide pages

Check and update these pages if the release affects them:

| Page                                | Update when                                      |
| ----------------------------------- | ------------------------------------------------ |
| `guide/memory-system.md`            | Memory schema, capture, or consolidation changes |
| `guide/workflow-phases.md`          | Phase behavior changes (new steps, hook changes) |
| `guide/agent-skill-architecture.md` | New skills, agents, or Mermaid diagram changes   |
| `guide/model-routing.md`            | Model tier or routing changes                    |
| `reference/agents/*.md`             | Agent capability changes                         |
| `reference/skills/*.md`             | Skill behavior or schema changes                 |

#### 1b. Verify VitePress builds

```bash
cd website && npx vitepress build
```

Must complete with no errors. Chunk size warnings are normal.

### 2. Update CHANGELOG (`website/changelog.md`)

> **Note:** Root `CHANGELOG.md` is a stub that points at `website/changelog.md` (the live source). Edit `website/changelog.md`.

Add a new version section at the **top** (just below the `## Upgrade` block). Use the schema below — only include sections that have content. Empty sections are dropped, not stubbed.

#### Section schema (in this order)

| Section | When to include | Format |
|---|---|---|
| `### Highlights` | Always for feature/breaking releases. Optional for patches. | 1–3 sentences. State the user-visible thesis of the release. No file paths, no internal IDs. |
| `### New Skills` | Whenever ≥1 new skill ships. | Markdown table: `\| Skill \| Purpose \|` |
| `### New Agents` | Whenever ≥1 new agent ships. | Bullet list: `- ``agent-name`` — purpose.` |
| `### New Commands` | Whenever ≥1 new slash command ships. | Bullet list: `- ``/command`` — purpose.` |
| `### CLI` | Whenever `mewkit` CLI changes. | Bullet list. |
| `### Features` | New user-facing functionality not covered by the New-* sections. | Bullet list. |
| `### Improvements` | Refactors, ergonomics, perf, prunes that the user notices. | Bullet list. |
| `### Removals` | Deletions, deprecations, renames. | Bullet list. State migration path inline. |
| `### Bug Fixes` | All user-visible fixes. | Bullet list. State the symptom + the fix briefly. |
| `### Beta` | Opt-in / experimental features (env var or flag-gated). | Bullet list. State the opt-in mechanism. |
| `### Migration Notes` | Only if user action is required. | Bullet list. Include the exact command or env var. |
| `### Breaking Changes` | Only if there are any. | Bullet list. State the before/after behavior. |

#### Style rules (DRY: enforced by these rules, not duplicated everywhere)

- **One sentence per bullet** unless an env var table or migration command is needed.
- **No internal IDs** in published bullets — drop `RT-C1`, `M2`, `CF3`, `RF-14`, `phase-XX`, `[CHM]<n>`. They belong in commit messages, not the changelog.
- **No test counts** (e.g. "40 passed / 3 todo") — that is CI noise, not a user-impact signal.
- **No audit metadata** ("5 parallel red-team teams audited 78 skills, 64 findings dedup'd") — summarize the *outcome* in Highlights and let bullets describe what changed.
- **No file counts** ("286 lines, 11 sections, 16 agents wired") — describe what the user gets, not how big the diff was.
- **No internal plan-directory paths** (`plans/260411-1906-...`).
- **No `**bold:**` prefix per bullet.** Sentence-case content is enough; bold is reserved for skill / command / agent names referenced inline (use backticks, not bold).
- **Em dash `—`** between subject and explanation. Hyphens are for compound words.
- **CLI commands in fenced blocks** when ≥3 chars or a flag combination. Inline backticks for short ones (`mewkit doctor`).
- **Env vars in tables** when ≥2 are introduced in the same release.
- **Section dividers `---`** between major versions only, not minor patches.

#### Patch vs. minor vs. major releases

| Release type | Required sections | Optional sections |
|---|---|---|
| Patch (`x.y.Z`) | At least one of: `Bug Fixes`, `Improvements` | `Highlights` (only if non-trivial), CLI |
| Minor (`x.Y.0`) | `Highlights` + at least one of: `Features`, `New Skills`, `New Agents`, `New Commands` | All others |
| Major (`X.0.0`) | `Highlights` + `Breaking Changes` + `Migration Notes` (if action required) | All others |

#### What goes in `Highlights` vs `Features`

- **Highlights** is the elevator pitch — *what changed in this release at the level the user cares about*. 1–3 sentences. No bullets.
- **Features** is the granular list of additions. Bullets, one per addition.

If you only have one feature and it's the whole release, put it in **Highlights** as prose and skip **Features**.

#### Worked example

```markdown
## 2.5.0 (YYYY-MM-DD) — Release Title

### Highlights

One-paragraph user-facing thesis. State what shipped and why a user
would want it.

### New Skills

| Skill | Purpose |
|-------|---------|
| `mk:example` | One-line purpose. |

### Features

- `--new-flag` — what it does.
- New env var `MEOWKIT_THING` — purpose, default value.

### Improvements

- Existing thing X now does Y instead of Z.

### Bug Fixes

- Symptom — fix.

### Migration Notes

- `npx mewkit upgrade` to pick up the new defaults.
```

### 3. Bump versions

```bash
npm -w packages/mewkit version <version> --no-git-tag-version
```

> **Note:** Only bump `mewkit`.

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
npx mewkit init
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
npm -w packages/mewkit publish
```

> **Note:** Only publish `mewkit`.

### 11. Test end-to-end

```bash
npx mewkit init test-project
# Should scaffold using the new version
```

## Release Checklist

Copy this checklist for each release:

```markdown
## Release v<version> Checklist

### Docs

- [ ] Updated affected guide/reference pages (step 1a)
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
- [ ] `npx mewkit init` scaffolds new version correctly
```

## Automated Release (CI/CD)

Push to `main` or `dev` triggers `.github/workflows/release.yml`:

1. Semantic-release analyzes conventional commits → determines version bump
2. `sync-package-versions.cjs` syncs version across both packages
3. `prepare-release-assets.cjs` builds zip + metadata + manifest
4. `@semantic-release/github` creates GitHub Release with zip asset
5. `@semantic-release/exec` publishes both packages to npm
6. `@semantic-release/git` commits version files back to repo

**Note:** Automated releases do NOT update `CHANGELOG.md` or affected guide/reference pages. Those must be done manually before the release commit.

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
| `scripts/release.sh`                    | Automated release: bump → build → assets → commit → tag → push → GitHub Release |

## Release History

| Version | Date       | Title                            |
| ------- | ---------- | -------------------------------- |
| v2.7.4  | 2026-05-02 | Browser skill consolidation          |
| v2.7.3  | 2026-05-01 | `npx mewkit` resolution fix          |
| v2.7.2  | 2026-05-01 | Checkpoint subsystem cleanup         |
| v2.7.1  | 2026-04-30 | Phase Frontmatter Contract           |
| v2.7.0  | 2026-04-30 | The Namespace Rename Release         |
| v2.6.2  | 2026-04-29 | The Telemetry & Validator Release    |
| v2.6.1  | 2026-04-22 | The project-manager Release          |
| v2.6.0  | 2026-04-22 | The Skills Compliance Release        |
| v2.5.1  | 2026-04-20 | mk:henshin                         |
| v2.5.0  | 2026-04-19 | The Native Fit Release               |
| v2.3.4  | 2026-04-11 | Centralized Dotenv Loading           |
| v2.3.3  | 2026-04-11 | The Wiring Integrity Release         |
| v2.3.2  | 2026-04-11 | The Agent-Skills Integration Release |
| v2.3.1  | 2026-04-11 | The Plan Creator Intelligence Release |
| v1.4.0  | 2026-04-03 | The Plan Intelligence Release    |
| v1.3.4  | 2026-04-02 | Hook path resolution fix            |
| v1.3.3  | 2026-04-02 | The Hook Safety Release             |
| v1.3.2  | 2026-04-01 | The Plan Quality Release            |
| v1.3.1  | 2026-04-01 | The Red Team Depth Release         |
| v1.3.0  | 2026-03-31 | The Integration Integrity Release |
| v1.2.1  | 2026-03-31 | Memory capture enforcement fix    |
| v1.2.0  | 2026-03-31 | The Memory Activation Release    |
| v1.1.0  | 2026-03-30 | The Reasoning Depth Release      |
| v1.0.0  | 2026-03-30 | The Disciplined Velocity Release |
| v0.1.2  | 2026-03-29 | Interactive version selection     |
| v0.1.1  | 2026-03-29 | Runtime dir exclusion fix         |
| v0.1.0  | 2026-03-29 | Initial pre-release               |

## Troubleshooting

### CLI fetches wrong version

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

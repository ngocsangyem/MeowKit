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

| Branch | npm Tag | GitHub Release | Example |
|--------|---------|----------------|---------|
| `main` | `@latest` | Stable | `v1.0.0` |
| `dev` | `@beta` | Pre-release | `v1.1.0-beta.1` |

## Manual Release (Step-by-Step)

### 1. Bump versions

```bash
npm -w packages/create-meowkit version <version> --no-git-tag-version
npm -w packages/meowkit version <version> --no-git-tag-version
```

### 2. Build and verify

```bash
npm run build
npm run lint
npm run typecheck
npm test
```

### 3. Build release assets

```bash
node scripts/prepare-release-assets.cjs "<version>"
```

This creates:
- `.claude/metadata.json` — version metadata
- `release-manifest.json` — SHA-256 checksums for all files
- `dist/meowkit-release.zip` — the release package (`.claude/` + `tasks/` + `CLAUDE.md` + manifest)

### 4. Commit and tag

```bash
git add -A
git commit -m "chore: bump version to v<version>"
git tag -a v<version> -m "v<version> — <release title>"
```

### 5. Push to GitHub

```bash
git push origin main
git push origin v<version>
```

### 6. Create GitHub Release with zip

**This is the critical step.** The zip file MUST be attached as a release asset.

```bash
gh release create v<version> dist/meowkit-release.zip \
  --title "v<version> — <release title>" \
  --notes "<release notes>"
```

### 7. Verify the release

```bash
# Check zip is attached
gh release view v<version> -R ngocsangyem/MeowKit --json assets -q '.assets[].name'
# Must show: meowkit-release.zip
```

### 8. Publish to npm

```bash
npm -w packages/create-meowkit publish
npm -w packages/meowkit publish
```

### 9. Test end-to-end

```bash
npx create-meowkit@latest test-project
# Should fetch the new version
```

## Automated Release (CI/CD)

Push to `main` or `dev` triggers `.github/workflows/release.yml`:

1. Semantic-release analyzes conventional commits → determines version bump
2. `sync-package-versions.cjs` syncs version across both packages
3. `prepare-release-assets.cjs` builds zip + metadata + manifest
4. `@semantic-release/github` creates GitHub Release with zip asset
5. `@semantic-release/exec` publishes both packages to npm
6. `@semantic-release/git` commits version files back to repo

### Conventional commits → version bumps

```
feat: new skill            → MINOR (1.0.0 → 1.1.0)
fix: skill bug             → PATCH (1.1.0 → 1.1.1)
feat!: breaking change     → MAJOR (1.1.1 → 2.0.0)
chore: cleanup             → no release
docs: update readme        → no release
```

## Release Scripts

| Script | Purpose |
|--------|---------|
| `scripts/sync-package-versions.cjs` | Sync version across both npm packages |
| `scripts/generate-release-manifest.cjs` | Generate SHA-256 checksums for all release files |
| `scripts/prepare-release-assets.cjs` | Build metadata.json + manifest + dist/meowkit-release.zip |

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

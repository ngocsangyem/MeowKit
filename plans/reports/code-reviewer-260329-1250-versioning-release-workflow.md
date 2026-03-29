# Code Review: Versioning & Release Workflow

**Reviewer:** code-reviewer
**Date:** 2026-03-29
**Scope:** 11 files (3 modified, 8 new) — release pipeline, CLI enhancements, CI/CD workflows

---

## Overall Assessment

Solid implementation of semantic-release with dual-channel publishing. The pipeline architecture is well-structured: version sync, asset preparation, and npm publish are logically sequenced. Several issues need attention before shipping — one critical, two high-priority.

---

## Critical Issues

### 1. `prepare-release-assets.cjs` — Shell injection via unsanitized version string

**File:** `scripts/prepare-release-assets.cjs:54,93`

The version argument is interpolated directly into shell commands:

```js
execSync(`node scripts/generate-release-manifest.cjs "${version}"`, { stdio: "inherit" });
execSync(`zip -r ${archivePath} ${archiveTargets.join(" ")}`, { stdio: "inherit" });
```

While semantic-release controls the version string in CI, manual invocation could inject arbitrary shell commands via the version arg (e.g., `"; rm -rf /"`).

**Fix:** Validate version format before use:
```js
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  process.exit(1);
}
```

Also applies to `sync-package-versions.cjs:12` and `generate-release-manifest.cjs:67`.

---

## High Priority

### 2. Hardcoded VERSION in `index.ts` won't update on release

**File:** `packages/meowkit/src/index.ts:14`

```ts
const VERSION = "0.1.0";
```

`sync-package-versions.cjs` updates `package.json` files but NOT the hardcoded `VERSION` constant in source code. After a release, `meowkit --version` will still report `0.1.0`.

**Fix options:**
- A) Read version from `package.json` at runtime: `JSON.parse(fs.readFileSync(...)).version`
- B) Add a build step that replaces the constant (e.g., `define` in esbuild or a simple sed in prepareCmd)
- C) Add `index.ts` to `sync-package-versions.cjs` with a regex replace

Option A is simplest and most resilient.

### 3. Generated artifacts not in `.gitignore`

**Files:** `release-manifest.json`, `dist/meowkit-release.zip`, `.claude/metadata.json`

These are generated during release but not listed in `.gitignore`. The `@semantic-release/git` plugin commits `metadata.json` intentionally, but `release-manifest.json` and `dist/` zip could pollute the repo if a developer runs the scripts locally.

`dist/` IS in `.gitignore` (good), but `release-manifest.json` is not.

**Fix:** Add to `.gitignore`:
```
release-manifest.json
```

### 4. Dual-CD `publishCmd` uses `cd` — fragile in chained `&&`

**File:** `.releaserc.cjs:85-87`

```js
publishCmd: [
  `cd packages/create-meowkit && npm publish --tag ${npmTag}`,
  `cd packages/meowkit && npm publish --tag ${npmTag}`,
].join(" && "),
```

After the first `cd && npm publish`, the shell CWD is `packages/create-meowkit`. The second `cd packages/meowkit` is relative to THAT directory, not root. This will fail.

**Fix:** Use absolute-ish paths or subshells:
```js
publishCmd: [
  `(cd packages/create-meowkit && npm publish --tag ${npmTag})`,
  `(cd packages/meowkit && npm publish --tag ${npmTag})`,
].join(" && "),
```

Or use `npm publish -w packages/create-meowkit --tag ${npmTag}`.

---

## Medium Priority

### 5. Beta/stable workflow duplication

**Files:** `.github/workflows/release.yml`, `.github/workflows/release-beta.yml`

These two files are identical except for the branch trigger (`main` vs `dev`). This violates DRY. Any future change (e.g., adding a step) must be duplicated.

**Fix:** Consolidate into one workflow with branch-conditional logic or use a reusable workflow:
```yaml
on:
  push:
    branches: [main, dev]
```
Semantic-release already handles branch routing via `.releaserc.cjs`.

### 6. `.releaserc.cjs` conditional branches array may confuse semantic-release

**File:** `.releaserc.cjs:31-33`

```js
branches: isBeta
  ? ["main", { name: "dev", prerelease: "beta" }]
  : ["main"],
```

When running on `main`, the `dev` branch config is excluded. This is fine for the release itself, but semantic-release may warn about missing branch configuration. The standard approach is to always include all branch configs and let semantic-release pick the right one:

```js
branches: ["main", { name: "dev", prerelease: "beta" }],
```

### 7. `upgrade.ts` — `execSync` for npm global install is sync-blocking

**File:** `packages/meowkit/src/commands/upgrade.ts:119`

`execSync("npm install -g ...")` blocks the event loop. For a CLI tool this is acceptable, but using `stdio: "inherit"` means error output goes to stderr directly, bypassing the error handler's formatted message. Consider using `spawnSync` for finer control, or keep as-is if simplicity is preferred.

**Severity:** Low — acceptable for CLI context.

### 8. CI workflow missing caching

**File:** `.github/workflows/ci.yml`

No npm cache step. For PRs, this means full `npm ci` on every run.

**Fix:** Add:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'
```

Same applies to both release workflows.

---

## Low Priority

### 9. `generate-release-manifest.cjs` — `process.cwd()` dependency

The script uses `process.cwd()` as project root. If invoked from a subdirectory (unlikely in CI, possible locally), paths break. Could add a check for `package.json` existence at cwd.

### 10. `build-templates.mjs` — `.env` in SKIP_PATTERNS matches path substrings

**File:** `packages/create-meowkit/scripts/build-templates.mjs:24`

```js
const SKIP_PATTERNS = [... ".env" ...];
```

`src.includes(".env")` will match any path containing `.env` as a substring, including legitimate files like `setup-environment.ts`. Should use basename matching instead.

**Fix:**
```js
function shouldSkip(src) {
  const base = path.basename(src);
  if (SKIP_PATTERNS.some((p) => base === p || base.endsWith(p))) return true;
  // ...
}
```

---

## Edge Cases Found by Scout

1. **Partial publish failure:** If `create-meowkit` publishes but `meowkit` fails, npm has inconsistent versions. No rollback mechanism. Mitigation: npm unpublish within 72h window, or accept version gap.
2. **Concurrent releases:** Both workflows share concurrency group `release-${{ github.repository }}` — good, prevents parallel releases.
3. **`fetchRegistryInfo` for unpublished package:** Before first publish, all fetch calls in `upgrade.ts` will fail. The error handling covers this, but user message could be friendlier ("Package not yet published to npm").
4. **`zip` command availability:** `prepare-release-assets.cjs:93` assumes `zip` is available. Ubuntu runners have it, but it's not guaranteed on all platforms. Since this only runs in CI, acceptable.

---

## Positive Observations

- Atomic write pattern in `generate-release-manifest.cjs` (write to `.tmp`, then rename) — good practice
- SHA-256 checksums in manifest enable integrity verification
- Proper error handling with typed catches throughout upgrade.ts
- Concurrency groups prevent race conditions in release workflows
- `fetch-depth: 0` in checkout — required for semantic-release commit analysis
- Clean separation: version sync, manifest gen, asset prep as distinct scripts

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix shell injection: validate version format in all 3 scripts
2. **[HIGH]** Fix `publishCmd` subshell issue — releases will fail without this
3. **[HIGH]** Fix hardcoded VERSION — users will see wrong version post-release
4. **[HIGH]** Add `release-manifest.json` to `.gitignore`
5. **[MEDIUM]** Consolidate release workflows into one
6. **[MEDIUM]** Simplify `.releaserc.cjs` branches to always include both
7. **[LOW]** Add npm caching to all workflows
8. **[LOW]** Fix `.env` substring matching in build-templates

---

## Metrics

- Type Coverage: N/A (scripts are CJS, CLI is TypeScript with proper interfaces)
- Test Coverage: Unknown — no tests for new scripts
- Linting Issues: 0 detected in review

## Unresolved Questions

1. Is `meowkit` package intended to be published to npm public registry? No `publishConfig` in its `package.json`.
2. Should release scripts have their own test suite? Currently untested.
3. The `@semantic-release/git` plugin commits back to the branch — does the repo have branch protection that would block this? If so, a GitHub App token or PAT with bypass is needed instead of `GITHUB_TOKEN`.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Release pipeline is well-architected but has a breaking bug in `publishCmd` (issue #4) and a version display bug (issue #2). Shell injection risk in scripts should be fixed before merge.
**Concerns:** Issues #2 and #4 will cause visible failures in production. Issue #1 is a security hardening item.

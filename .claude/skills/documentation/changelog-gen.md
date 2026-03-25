# Skill: Changelog Generation from Conventional Commits

**Purpose:** Automatically generate a structured changelog by parsing git log for conventional commit prefixes.

## When to Use

Invoke this skill when:
- Preparing a release
- Generating a changelog for a version bump
- Summarizing changes since the last release

---

## Steps

### Step 1: Determine Version Range

Find the last tagged version (or the beginning of the repo if no tags exist):

```bash
# Get the last tag
last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# If no tag exists, use the first commit
if [ -z "$last_tag" ]; then
  range="HEAD"
else
  range="${last_tag}..HEAD"
fi
```

### Step 2: Parse Conventional Commits

Extract commits and group by type:

```bash
git log $range --pretty=format:"%s|%h|%an" --no-merges
```

Parse each line for the conventional commit prefix:

| Prefix | Changelog Section |
|--------|------------------|
| `feat:` | Features |
| `fix:` | Bug Fixes |
| `refactor:` | Refactoring |
| `docs:` | Documentation |
| `chore:` | Chores |
| `perf:` | Performance |
| `test:` | Tests |
| `ci:` | CI/CD |
| `breaking:` or `BREAKING CHANGE:` | Breaking Changes |

Commits that do not follow conventional commit format go into an "Other" section.

### Step 3: Format the Changelog Entry

```markdown
## [version] - YYYY-MM-DD

### Breaking Changes
- **scope:** description (commit-hash)

### Features
- **scope:** description (commit-hash)

### Bug Fixes
- **scope:** description (commit-hash)

### Performance
- **scope:** description (commit-hash)

### Refactoring
- **scope:** description (commit-hash)

### Documentation
- **scope:** description (commit-hash)

### Tests
- **scope:** description (commit-hash)

### Chores
- **scope:** description (commit-hash)
```

**Rules:**
- Breaking Changes ALWAYS go first
- Empty sections are omitted
- Each entry includes the short commit hash for traceability
- Scope (if present in commit message) is bolded

### Step 4: Append to CHANGELOG.md

1. If `CHANGELOG.md` does not exist, create it with a header:
   ```markdown
   # Changelog

   All notable changes to this project will be documented in this file.

   The format is based on [Keep a Changelog](https://keepachangelog.com/).
   ```

2. Insert the new version entry at the top (after the header, before previous entries).

3. Do NOT modify existing entries.

### Step 5: Determine Version Number

If the version number is not provided, suggest one based on changes:

- **Major** (X.0.0) — if there are any Breaking Changes
- **Minor** (0.X.0) — if there are any Features
- **Patch** (0.0.X) — if there are only Bug Fixes, Refactoring, Chores, etc.

---

## Example Output

```markdown
## [1.3.0] - 2026-03-25

### Features
- **auth:** add biometric login support (a1b2c3d)
- **dashboard:** add real-time notifications widget (d4e5f6a)

### Bug Fixes
- **payments:** fix decimal rounding in invoice total (b7c8d9e)

### Performance
- **api:** add database query caching for user profiles (f0a1b2c)
```

## Validation

- [ ] All commits in range are accounted for
- [ ] Breaking changes are listed first
- [ ] Version number follows semver based on change types
- [ ] Date is correct
- [ ] Existing changelog entries are not modified

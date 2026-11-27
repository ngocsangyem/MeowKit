# Changelog fragments

Every pull request with a user-visible change adds one file here instead of editing the
changelog page. Name it after your branch: `changes/fix-init-dry-run.md`.

```markdown
---
section: Bug Fixes
---
- `mewkit init --dry-run` no longer ...
```

`section` is one of: Highlights, New Skills, New Agents, New Commands, CLI, Features,
Improvements, Removals, Bug Fixes, Migration Notes. The body is the bullet(s) exactly as they
should read in the changelog.

- A beta release lists the fragments added since the previous beta in its GitHub Release notes.
- A stable release (`release/vX.Y.Z`) writes all fragments into
  `packages/docs/content/docs/changelog/index.mdx` as `## X.Y.Z (date)` and deletes them.
- CI fails a pull request that changes shipped files (`.claude/`, `kit/`, `crates/`,
  `.meowkit/`, `install.*`) without a fragment, unless it carries the `no-changelog` label.

Check locally: `node scripts/release/assemble-changelog.cjs check`.

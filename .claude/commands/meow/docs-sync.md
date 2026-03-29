# /docs:sync — Living Documentation Update

## Usage

```
/docs:sync
```

## Behavior

Incrementally updates documentation to reflect code changes. Keeps docs in sync with the codebase as a living document. Phase 6 automatically triggers this after feature completion.

### Execution Steps

1. **Diff against main.** Run `git diff main` (or the project's default branch) to identify all changed files since the last sync.

2. **Map changed files to doc sections.** For each changed file, determine which documentation section it affects:
   - New/changed API endpoint → update `docs/api-reference.md`
   - New/changed component → update `docs/components.md`
   - New/changed service/module → update `docs/modules.md`
   - Changed setup/config → update `docs/setup.md`
   - New ADR → already handled by `/arch`, skip

3. **Update affected docs only.** For each affected section:
   - Read the current doc content
   - Read the changed source files
   - Update the doc to reflect the new state
   - Do NOT rewrite unchanged sections

4. **Generate changelog entry** if conventional commits exist in the diff:
   - Parse commit messages for `feat:`, `fix:`, `breaking change:` prefixes
   - Append entry to `docs/changelog.md` with date and grouped changes
   - Format:
     ```
     ## [YYYY-MM-DD]
     ### Features
     - description (commit-hash)
     ### Fixes
     - description (commit-hash)
     ```

5. **Verify no stale doc references.** Check that:
   - No docs reference files/functions/endpoints that no longer exist
   - No broken internal links between doc files
   - Flag any stale references found

### When to Use

- After completing a feature (Phase 6 auto-triggers this)
- Before a release to ensure docs are current
- Periodically during long-running development

### Output

Updated documentation files in `docs/`. Changelog entry if conventional commits detected. List of any stale references found.

# /upgrade — Self-Update Toolkit

## Usage

```
/upgrade
/upgrade --check
/upgrade --beta
```

## Behavior

Self-update the installed toolkit to the latest version. Preserves learned knowledge in `.claude/memory/`.

### Execution Steps

1. **Check current version.** Read `the workflow config` for the current installed version.

2. **Fetch latest version.** Query npm registry for the latest published toolkit version.

3. **Compare versions.** If current version matches latest:
   - Print: "Toolkit is up to date (vX.Y.Z)"
   - Exit.

4. **If update is available:**
   - Print: "Update available: vX.Y.Z → vA.B.C"
   - Download the new version.
   - Replace `.claude/` files with updated versions: commands, modes, rules, skills, scripts, agents, hooks.
   - **NEVER overwrite `.claude/memory/`.** Topic files, cost logs, and learned patterns are preserved across updates.
   - Update version in `the workflow config`.

5. **Post-update validation.** Run `/validate` to confirm the update installed correctly and all scripts are functional.

### Flags

| Flag | Behavior |
|------|----------|
| `--check` | Check for updates only. Print whether an update is available without installing. |
| `--beta` | Install the latest beta version instead of stable. Use for early access to new features. |

### Safety

- The `.claude/memory/` directory is NEVER overwritten. This ensures:
  - The canonical JSON stores (`fixes.json`, `review-patterns.json`, `architecture-decisions.json`) persist — these are the authoritative curated memory (see `.claude/rules/memory-read-rules.md`)
  - The matching `.md` files (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`, `security-notes.md`) also persist — these are generated/non-authoritative views; they can be regenerated via `mewkit memory render-views` from the JSON stores
  - `.claude/memory/cost-log.json` (cost history) persists
  - Any other accumulated knowledge is preserved
- If the update fails mid-way, the previous version's files remain intact.
- After update, `/validate` confirms everything works.

### Output

- Current version and latest version comparison
- Update progress (if updating)
- Post-update validation results

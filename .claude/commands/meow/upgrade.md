# /upgrade — Self-Update MeowKit

## Usage

```
/upgrade
/upgrade --check
/upgrade --beta
```

## Behavior

Self-update MeowKit to the latest version. Preserves learned knowledge in `memory/` directory.

### Execution Steps

1. **Check current version.** Read `.claude/meowkit.config.json` for the current installed version.

2. **Fetch latest version.** Query npm registry for the latest published MeowKit version.

3. **Compare versions.** If current version matches latest:
   - Print: "MeowKit is up to date (vX.Y.Z)"
   - Exit.

4. **If update is available:**
   - Print: "Update available: vX.Y.Z → vA.B.C"
   - Download the new version.
   - Replace `.claude/` files with updated versions: commands, modes, rules, skills, scripts, agents, hooks.
   - **NEVER overwrite `memory/` directory.** Lessons, cost logs, and learned patterns are preserved across updates.
   - Update version in `.claude/meowkit.config.json`.

5. **Post-update validation.** Run `/validate` to confirm the update installed correctly and all scripts are functional.

### Flags

| Flag | Behavior |
|------|----------|
| `--check` | Check for updates only. Print whether an update is available without installing. |
| `--beta` | Install the latest beta version instead of stable. Use for early access to new features. |

### Safety

- The `memory/` directory is NEVER overwritten. This ensures:
  - `memory/lessons.md` (project learnings) persists
  - `memory/cost-log.json` (cost history) persists
  - Any other accumulated knowledge is preserved
- If the update fails mid-way, the previous version's files remain intact.
- After update, `/validate` confirms everything works.

### Output

- Current version and latest version comparison
- Update progress (if updating)
- Post-update validation results

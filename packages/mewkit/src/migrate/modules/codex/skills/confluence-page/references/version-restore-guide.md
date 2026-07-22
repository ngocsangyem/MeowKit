# Version + Restore Guide

How Confluence Cloud page versioning works, what `version restore` actually does, and how to use it without surprises.

## Contents

- [Version Mechanics](#version-mechanics)
- [List vs Get](#list-vs-get)
- [Restore Semantics](#restore-semantics)
- [Common Pitfalls](#common-pitfalls)

## Version Mechanics

- Every page edit creates a new version: 1, 2, 3, ...
- The current version is always the highest number
- Older versions are read-only — you can fetch them, but you cannot edit them in place
- Version metadata: `number`, `when`, `by`, `message`

## List vs Get

| Need | Verb |
|---|---|
| List all versions of a page | `version list --page-id 12345` |
| Read a specific historical version | `page get --page-id 12345 --version 4` |
| Diff two versions | `page get` each, then external diff tool (no native diff in `confluence-as`) |

## Restore Semantics

Important: **`version restore` creates a new version on top of the head — it is not in-place rollback**.

```
Before restore (page at version 7):
  v1 ──> v2 ──> v3 ──> v4 ──> v5 ──> v6 ──> v7 (head)

Run: confluence-as version restore --page-id 12345 --version 4

After:
  v1 ──> v2 ──> v3 ──> v4 ──> v5 ──> v6 ──> v7 ──> v8 (head, body of v4)
```

- The restored content lands as version 8, not as a new v4
- v5 / v6 / v7 still exist in history (audit trail preserved)
- Any references to "version 4" still point to the original v4

## Common Pitfalls

- **No undo.** `version restore` cannot itself be undone — to revert the restore, run another `version restore` pointing at v7 (or whatever pre-restore head was).
- **Macros may flatten.** Restoring a version with macros (panel, expand, decision) round-trips through ADF and may flatten — see `field-formats.md` Round-Trip Caveats.
- **Only the body restores.** Title, labels, and parent are NOT changed by `version restore`. To restore the full page state (title + body + parent), update those fields explicitly after restore.
- **Permission caveat.** Restoring requires the same permission as `update`. If user lacks update permission on a space, the wrapper will return exit 5 (permission).
- **Concurrent edit collision.** If someone edits the page between your `version list` read and your `version restore`, the restored content lands on top of their edit. Re-list versions immediately before restoring on hot pages.

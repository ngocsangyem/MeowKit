# Freeze Mechanics

Technical details of how `mk:freeze` enforces directory boundaries.

## Path Resolution

When the user provides a directory path, it is resolved to an absolute path before storing:

```bash
FREEZE_DIR=$(cd "<user-provided-path>" 2>/dev/null && pwd)
FREEZE_DIR="${FREEZE_DIR%/}/"   # Ensure trailing slash
```

The trailing `/` is critical: it prevents `/src` from matching `/src-old` or `/src-backup`.
Without the trailing slash, a prefix check would produce false matches on sibling directories.

## State File

The resolved freeze path is persisted to a state file:

```
${PLUGIN_DATA:-.meowkit/memory}/freeze-dir.txt
```

The hook script reads this file on every Edit and Write invocation. The state persists for
the entire session — the user does not need to re-specify the path on each invocation.

## Hook Enforcement

The `check-freeze.sh` script runs as a pre-write guard on both edit and write operations,
invoked by this project's configured hooks when present.

On each invocation:
1. Read `file_path` from the tool input
2. Read the freeze boundary from `freeze-dir.txt`
3. Check if `file_path` starts with the freeze directory string
4. If yes → allow
5. If no → deny with a message stating the boundary

## Symlink Handling

The guard checks the stated `file_path`, not the resolved path. If a symlink is resolved
internally by the editing tool, the file could end up being written outside the frozen directory
even though the stated path was inside it.

Mitigation: In sensitive environments, avoid placing symlinks inside the frozen directory that point
outside it.

## Tool Scope

Freeze only applies to edit and write operations. The following are NOT restricted:

- File reads — read anywhere
- Shell commands — unrestricted; `sed`, `awk`, `cp`, `mv` can still modify files outside the boundary
- glob/file-pattern search — searches anywhere
- Text/content search — searches anywhere

This is an intent guardrail, not a security boundary. The freeze prevents accidental agent-initiated
edits, but deliberate shell commands can still touch any file.

## Deactivation

Freeze is session-scoped. It deactivates when:
- The conversation ends or a new session starts
- A new freeze is set with a different path (overwrites state file)
- The user manually deletes the state file at `${PLUGIN_DATA:-.meowkit/memory}/freeze-dir.txt`

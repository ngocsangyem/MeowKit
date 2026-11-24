# Freeze Mechanics

Technical details of how `mk:freeze` enforces directory boundaries.

## Path Resolution

`scripts/set-freeze.cjs` resolves the user's path to an absolute, symlink-free directory and requires that it exists. The saved value ends in `/`, so `/src` cannot match `/src-old` or `/src-backup`. A path that does not resolve to an existing directory is an error and leaves the saved boundary alone; the filesystem root is refused.

## State File

The resolved path is persisted to:

```
${CLAUDE_PLUGIN_DATA:-.meowkit/state}/freeze-dir.txt
```

The hook reads it on every Edit and Write call. The file stays until it is cleared (`scripts/set-freeze.cjs --clear`) or overwritten by a new `/mk:freeze`; it does not expire with the session.

## Hook Enforcement

`check-freeze.cjs` is registered by this skill as a `PreToolUse` hook on Edit and Write, and runs on each call:

1. Read `file_path` from the tool input.
2. Read the boundary from `freeze-dir.txt`; with no boundary, or no file path, allow.
3. If the path is the boundary or inside it, allow (the hook prints `{}`).
4. Otherwise deny, with a message naming the boundary.

## Symlink Handling

The hook checks the stated `file_path`, not the resolved path. If the Edit tool resolves a symlink
internally, the file could end up being written outside the frozen directory even though the stated
path was inside it.

Mitigation: In sensitive environments, avoid placing symlinks inside the frozen directory that point
outside it.

## Tool Scope

Freeze only applies to Edit and Write tools. The following are NOT restricted:

- `Read` — reads anywhere
- `Bash` — unrestricted; `sed`, `awk`, `cp`, `mv` can still modify files outside the boundary
- `Glob` — searches anywhere
- `Grep` — searches anywhere

This is an intent guardrail, not a security boundary. The freeze prevents accidental Claude-initiated
edits, but deliberate bash commands can still touch any file.

## Deactivation

The boundary is removed when:
- `scripts/set-freeze.cjs --clear` runs, or the state file is deleted by hand
- a new `/mk:freeze` sets a different path (it overwrites the state file)

A new session does not clear it.

---
section: Improvements
---
- Internal cleanup with no behavior change: duplicated constants and helpers in the CLI (invocation ids, digest hex, timestamps, hook file paths, PATH and home lookups) now have one owner, never-used code is removed, and a test keeps the hand-copied Codex, Cursor, Grok and agents overlay files in step with the canonical hook library.

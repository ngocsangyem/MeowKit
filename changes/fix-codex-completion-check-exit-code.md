---
section: Bug Fixes
---
- Codex: the opt-in completion check no longer continues every turn that changed files. Codex passes a hook the shell command's output but not its exit code, so the check could never record a passing test, build, lint or type-check run there. It no longer runs on Codex; its Stop hook keeps syncing plan state.

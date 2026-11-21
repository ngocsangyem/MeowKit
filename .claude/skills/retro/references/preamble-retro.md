<!-- Per-skill additions to the shared preamble; SKILL.md loads both. -->

## Memory

- **Writes memory:** at task end append ONE entry to `.meowkit/memory/gotchas.md` (or `decisions.md` for a decision) via `mewkit note gotchas` (entry on stdin, lint-checked and locked by the CLI — never a bare `Edit`), in the format defined by `mk:memory`, and only when the lesson is non-derivable from the code, the diff, or `git log`. Never write secrets or vulnerability detail. A failed write is not silent: print `⚠ memory write skipped: <reason>` and continue.

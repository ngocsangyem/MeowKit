# .meowkit/

Runtime-neutral state for this project's installed toolkit(s) — shared across every
authored provider bundle (Codex, Cursor, ...), not just this one.

- `memory/` — canonical MeowKit memory (imported from `.claude/memory/` when present;
  `.claude/agent-memory/` is never auto-ingested).
- `state/` — reconciliation ledgers and lock files (e.g. `cursor-ledger.json`,
  `codex-ledger.json`) that record what an authored bundle installed here, so re-running
  `mewkit init` / `mewkit upgrade` is idempotent and never silently overwrites your edits.
- `telemetry/` — local hook/run telemetry.
- `cache/` — disposable, rebuildable cache data.

`state/` and `telemetry/` are gitignored by default: they are machine-local, and the
ledger is a trust anchor that should never be hand-edited or committed.

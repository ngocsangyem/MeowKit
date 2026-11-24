# Git index audit

`scripts/git-index-audit.sh` records a reproducible git tracked-state fingerprint as a
JSON artifact — independent of the canary benchmark loop. Use it to verify two checkouts
of a repo are identical, or to snapshot tracked state over time.

```bash
# single-repo snapshot
bash ${CLAUDE_SKILL_DIR}/scripts/git-index-audit.sh [repo-path]
# comparison (adds local/remote-only counts + recursive diff status)
bash ${CLAUDE_SKILL_DIR}/scripts/git-index-audit.sh <local> <remote>
```

**Artifact location:** `.claude/benchmarks/audits/{YYMMDD-HHMMSS}-audit.json` — a SIBLING
of `results/`, NOT inside it. `compare-runs.sh` prefix-globs `results/*.json` and assumes a
`tier` key; an audit artifact placed in `results/` would crash it. Every audit artifact
carries a top-level `"type": "audit"` discriminator. Override the output dir with
`MEOWKIT_AUDIT_OUT_DIR`.

**Artifact schema:** `type`, `run_id`, `ts`, `repo`, `tracked_file_count`,
`directory_count_excl_git`, `tracked_path_sha256`, `tracked_index_sha256`, `comparison`
(null in single-repo mode), `working_tree_clean`. A best-effort `audit_result` trace event
is appended via `append-trace.cjs`.

**Index-hash definition (toolkit canonical):** `tracked_index_sha256 = sha256(sort(git
ls-files -s))`. The `-s` flag includes mode + blob hash + stage, so the index hash captures
tracked CONTENT, not just paths; `tracked_path_sha256 = sha256(sort(git ls-files))` captures
paths only. The source method did not specify an index-hash command — this definition is
the toolkit's, documented here and in the script header so future comparisons are reproducible.

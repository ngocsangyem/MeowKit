# Git Memory & Rollback

Git history is the loop's only persistent memory across iterations. Read it every
iteration; commit before verifying; discard with `revert`, never `reset --hard`.

## Contents

- Preconditions
- Git is memory
- Commit classification
- Discard policy
- Exit & guard-file rule
- Back to [`loop-protocol.md`](loop-protocol.md)

---

## Preconditions (checked once at Stage 1)

1. **Git repo** — `git rev-parse --git-dir` succeeds.
2. **Named branch** — reject detached HEAD; loop commits need a branch to live on.
3. **Clean tree** — `git status --porcelain` is empty. A dirty tree → STOP and ask the
   user to commit or stash their own work first. NEVER auto-stash: mixing the user's
   uncommitted work into loop commits loses or corrupts it.

---

## Git Is Memory

Each iteration, before picking a change, read the memory of record — not the whole history:

```bash
git log --oneline -20           # recent loop commits + reverts
git diff HEAD~1                 # exact last change
tail -n 20 <report_dir>/loop-results.tsv   # metric trend + keep/discard record
```

Answer three questions: what kept (improving rows), what was discarded (repeated
file+technique pairs to avoid), and where the trend is going (recent deltas).

---

## Commit Classification

Commit BEFORE verify so every trial is a recoverable SHA. Choose the conventional type by
the **dominant** change, scope `loop`. Subject ≤ 60 chars, describing the atomic change —
NOT a metric promise, NOT a plan reference.

| Type | Use when the change is mostly… |
| --- | --- |
| `test(loop):` | adding/strengthening tests |
| `refactor(loop):` | restructuring without behavior change |
| `perf(loop):` | speed / size / latency |
| `fix(loop):` | a behavior correction |
| `chore(loop):` | config / tooling / deps |

```
test(loop): cover parseToken edge cases in lexer
perf(loop): tree-shake unused lodash imports
```

The `(loop)` scope enables `git log --oneline --grep="(loop)"` to list the run's commits.
Reverted attempts remain in history with the standard `Revert "..."` message — discards are
part of the experiment record.

---

## Discard Policy

```bash
git revert HEAD --no-edit       # the only automatic discard path
```

NEVER run `git reset --hard` (or any history-destroying reset) automatically — it erases the
trial record that pattern analysis depends on. If `git revert` reports a conflict, STOP and
ask the user; do not fall back to a destructive reset on your own.

---

## Exit & Guard-File Rule

- **Exit:** kept commits remain on the branch. Note in the summary that the user may
  interactively squash the `*(loop):` commits before shipping.
- **Guard files are read-only.** Never edit a file the Guard command itself checks (e.g.
  the test files a `npm test` guard runs) — editing what the guard measures makes the guard
  meaningless. A guard failure means the optimization is wrong, not that the guard is wrong.

# Recorded npm CLI behaviour

One `<case-name>.json` per case in `tests/npm_behaviour/`: the exit code, stdout,
stderr and every file the npm `mewkit` CLI left in the project for that case's
fixture and arguments.

Captured once, on 2026-11-14, from npm mewkit at origin/main 861db010 (package version 2.3.1),
built from a pristine checkout. The TypeScript CLI has since been deleted, so
these files **can no longer be regenerated**. They are the reference; edit one by
hand only for a deliberate change, and record why in the case or in
`../DIVERGENCES.md`.

Text holds the run's temp directory as `<project>`. Timestamps, versions and a
case's declared redactions are folded at compare time, on both sides.
`review-prepare-success.json` additionally holds `<session>` for the random
session id the command generates.

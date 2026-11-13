# Cutover: retiring the npm `mewkit` CLI for `mewkit-next`

`mewkit-next` (Rust, `crates/`) installs, upgrades, removes and diagnoses the kit for Claude
Code, Codex and Cursor. Everything else the kit asks of a CLI still lives in the npm `mewkit`
package (`packages/mewkit/`). This page says when the npm CLI can be retired and in what
order the rest is ported. Release mechanics: [`RELEASING.md`](../../RELEASING.md), "Binary
release stream". Why two streams: ADR
[`261110-two-release-streams.md`](../architecture/adr/261110-two-release-streams.md).

## Criteria

The npm CLI is retired only when **all** of these hold:

1. **Every subcommand the kit references exists in the binary**, with a parity test against
   the npm behaviour it replaces. "References" means a `mewkit <verb>` anywhere under
   `.claude/` (re-measure with the command below; the table must have no row left in a
   port group).
2. **The lifecycle matrix is green** on Linux, macOS and Windows CI
   (`crates/mewkit-cli/tests/lifecycle_matrix.rs`: each runtime × project/global, install →
   doctor → edit → upgrade → uninstall).
3. **One beta cycle has passed**: a `mewkit-vX.Y.Z-beta.N` release installed through
   `install.sh` / `install.ps1`, used through at least one kit release, with the
   [runtime smoke checklist](mewkit-next-runtime-smoke-checklist.md) recorded as passing on all
   three runtimes.
4. **The binary is renamed** `mewkit-next` → `mewkit`, with a transition period where both
   names run, and the kit's references updated in the same kit release.

Then `packages/mewkit` stops publishing to npm. The last npm release prints where the binary
is and keeps installing kits, since deployed copies cannot be updated.

## What the kit references

Measured 2026-11-11 on `main` 62948d93:

```bash
grep -rhoE "\bmewkit (next )?[a-z][a-z-]+" .claude | sed -E 's/mewkit (next )?//' | sort | uniq -c | sort -rn
```

"TS lines" is the npm command's entry file(s) plus its own directory, tests excluded; shared
modules under `packages/mewkit/src/core/` and `src/state/` are not counted, so each port is
larger than its number.

| Verb | Kit refs | TS lines | Status |
| --- | ---: | ---: | --- |
| `init` | 2 | — | ported |
| `upgrade` | 2 | — | ported |
| `uninstall` | 2 | — | ported |
| `doctor` | 10 | — | ported |
| `providers` | 2 | — | ported |
| `versions` | 2 | — | ported |
| `plan` (incl. `approve`, `archive`) | 31 | 537 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`) |
| `task` | 5 | 458 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`) |
| `task-state` | 11 | 239 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`) |
| `note` | 28 | 164 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`) |
| `orient` | 3 | 82 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`) |
| `validate` | 11 | 1,461 | ported (parity cases incl. the real repo kit); `--portable` on a project that carries a generated Codex tree still refers to the npm CLI |
| `review` | 30 | 2,077 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`); `cleanup` delegates to the kit's worktree script as the npm CLI does |
| `advice` | 40 | 624 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`) |
| `verdict-gate` | 3 | 30 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`); a markdown-only verdict is still tolerated as in the npm CLI, where `validate-gate-2.cjs` blocks a FAIL line |
| `trace` | 12 | 175 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`) |
| `budget` | 9 | 477 | ported (TS-vs-Rust parity cases: `cargo test -p mewkit-cli --test parity`) |
| `visual-plan` | 56 | 3,075 | removed from the npm CLI and the kit; not ported |
| `setup` | 2 | 707 | port group 3 |
| `skill` (`skill env`) | 15 | 174 | port group 3 |
| `pack` | 4 | 436 | port group 3 |
| `capabilities` | 9 | 297 | port group 3 |
| `backups` | 3 | 122 | port group 3 |
| `migrate` | 3 | 15,155 | retired from the npm CLI, not ported — `init --target codex|cursor` replaces it; the kit's references point at `init --target` |

The measurement also matches `mewkit sync` (a prose mention in a third-party skill's
`SYNC.md`) and `mewkit runtime` (a code comment); neither is a command.

## Port order

Each group is its own plan, in this order, because later groups call earlier ones:

1. **Plan and state** — `plan`, `task`, `task-state`, `note`, `orient`, `validate`. Gate 1,
   memory writes and session orientation depend on them; every workflow skill calls one.
2. **Review and evidence** — `review`, `advice`, `verdict-gate`, `trace`, `budget`. Gate 2's
   structural check and the review pipeline; they read state written by group 1.
3. **Tooling** — `setup`, `skill`, `pack`, `capabilities`, `backups` (`visual-plan` and
   `migrate` were removed instead of ported).
4. **Rename and retire** — the criteria above, then rename the binary, update the kit's
   references in one kit release, and stop npm publishing.

A port lands with parity tests that run the npm command and the binary on the same fixture
and compare their output and exit code, until the npm command is deleted.

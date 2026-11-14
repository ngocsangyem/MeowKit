# Retiring the npm `mewkit` CLI

The kit's CLI is the native `mewkit` binary (Rust, `crates/`), with `mk` as a short alias. It
replaced the npm `mewkit` package (`packages/mewkit/`), which has been deleted from this
repository; the last npm release prints where the binary is and keeps installing kits, since
deployed copies cannot be updated. This page records the criteria the retirement had to meet
and how each verb was ported, so a later change can tell a deliberate difference from a
regression. Release mechanics: [`RELEASING.md`](../../RELEASING.md), "Binary release stream".
Why two streams: ADR [`261110-two-release-streams.md`](../architecture/adr/261110-two-release-streams.md).
Users moving a project: [Moving from the npm CLI](https://docs.meowkit.dev/migration/from-npx-mewkit).

## Criteria

The npm CLI was retired once **all** of these held:

1. **Every subcommand the kit references exists in the binary**, with a test against the npm
   behaviour it replaces. The npm side of each case was recorded from the npm CLI before it was
   deleted and is frozen in `crates/mewkit-cli/tests/golden/npm/`
   (`cargo test -p mewkit-cli --test npm_behaviour`); deliberate differences are listed in
   `crates/mewkit-cli/tests/golden/DIVERGENCES.md`. `crates/mewkit-cli/tests/kit_verbs.rs`
   keeps every `mewkit <verb> [<sub>]` under `.claude/` resolving.
2. **The lifecycle matrix is green** on Linux, macOS and Windows CI
   (`crates/mewkit-cli/tests/lifecycle_matrix.rs`: each runtime × project/global, install →
   doctor → edit → upgrade → uninstall).
3. **One beta cycle has passed**: a `mewkit-vX.Y.Z-beta.N` release installed through
   `install.sh` / `install.ps1`, used through at least one kit release, with the
   [runtime smoke checklist](runtime-smoke-checklist.md) recorded as passing on all
   three runtimes.
4. **The binary is renamed** to `mewkit`, with the pre-rename name still running for one
   release (it prints a notice), and the kit's references updated in the same kit release.

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
| `init` | 2 | — | ported, incl. `--profile`, `--delivery`, `--mcp-profiles`, `--allow-cloud-mcp` and the target and profile pickers; what it writes differs from the npm CLI by design (`crates/mewkit-cli/tests/golden/DIVERGENCES.md`) |
| `upgrade` | 2 | — | ported, incl. `--check`, `--list`, `--yes`; `--no-cleanup` is accepted and has nothing to keep |
| `uninstall` | 2 | — | ported |
| `doctor` | 10 | — | ported, incl. `provenance`, `--explain`, `--adopt`, `--hard-gates` (recorded npm behaviour); `--report`, `--providers`, `--state` extend the binary's own report |
| `providers` | 2 | — | ported, incl. `--lifecycle` and `<provider>` (recorded npm behaviour); without `--lifecycle` it shows what the kit projects for each runtime, not the npm CLI's support matrix |
| `versions` | 2 | — | ported; reports installed, cached and available kits rather than the npm CLI's four install facts |
| `plan` (incl. `approve`, `archive`) | 31 | 537 | ported (recorded npm behaviour) |
| `task` | 5 | 458 | ported (recorded npm behaviour) |
| `task-state` | 11 | 239 | ported (recorded npm behaviour) |
| `note` | 28 | 164 | ported (recorded npm behaviour) |
| `orient` | 3 | 82 | ported (recorded npm behaviour) |
| `validate` | 11 | 1,461 | ported (recorded npm behaviour incl. the real repo kit) |
| `review` | 30 | 2,077 | ported (recorded npm behaviour); `cleanup` delegates to the kit's worktree script as the npm CLI does |
| `advice` | 40 | 624 | ported (recorded npm behaviour) |
| `verdict-gate` | 3 | 30 | ported (recorded npm behaviour); a markdown-only verdict is still tolerated as in the npm CLI, where `validate-gate-2.cjs` blocks a FAIL line |
| `trace` | 12 | 175 | ported (recorded npm behaviour) |
| `budget` | 9 | 477 | ported (recorded npm behaviour) |
| `visual-plan` | 56 | 3,075 | removed from the npm CLI and the kit; not ported |
| `setup` | 2 | 707 | ported (recorded npm behaviour); adds `--yes` for the system-deps question, which the npm CLI cannot answer without a terminal |
| `skill` (`skill env`) | 15 | 174 | ported (recorded npm behaviour) |
| `pack` | 4 | 436 | ported (recorded npm behaviour for listing and refusals; installs and removals end to end in `tests/init_flags.rs`) |
| `capabilities` | 9 | 297 | ported (recorded npm behaviour) |
| `backups` | 3 | 122 | ported (recorded npm behaviour); reads and restores the npm CLI's snapshots, refuses a snapshot whose manifest names a path outside the project (the npm CLI writes it), and lists the plain copies `init`/`upgrade`/`uninstall` take as not restorable here |
| `migrate` | 3 | 15,155 | retired from the npm CLI, not ported — `init --target codex|cursor` replaces it; the kit's references point at `init --target` |

The measurement also matches `mewkit sync` (a prose mention in a third-party skill's
`SYNC.md`) and `mewkit runtime` (a code comment); neither is a command.

## Port order

The verbs were ported in groups, each its own plan, because later groups call earlier ones:

1. **Plan and state** — `plan`, `task`, `task-state`, `note`, `orient`, `validate`. Gate 1,
   memory writes and session orientation depend on them; every workflow skill calls one.
2. **Review and evidence** — `review`, `advice`, `verdict-gate`, `trace`, `budget`. Gate 2's
   structural check and the review pipeline; they read state written by group 1.
3. **Tooling** — `setup`, `skill`, `pack`, `capabilities`, `backups` (`visual-plan` and
   `migrate` were removed instead of ported).
4. **Rename and retire** — the criteria above, then the binary was renamed, the kit's
   references updated in one kit release, and npm publishing stopped.

Until the npm command was deleted, each port ran the npm command and the binary on the same
fixture and compared their output and exit code. Those recordings are now the frozen goldens
named in criterion 1.

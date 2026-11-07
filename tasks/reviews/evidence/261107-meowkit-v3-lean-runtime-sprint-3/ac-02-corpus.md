# AC-02 — Golden corpus recorded from BASE bash

Sprint 3, `meowkit-v3-lean-runtime`. Recorded 2026-11-07.
BASE = `b8556870d9f9f65ff82ececec44f9d2a751b2e37`.

## Artifacts

| Path | Purpose |
| --- | --- |
| `scripts/record-hook-golden-corpus.cjs` | the recorder (committed, so the corpus can be re-recorded from BASE) |
| `scripts/lib/hook-corpus-env.cjs` | BASE extraction via `git archive`, the pinned environment, the named normalizers |
| `scripts/lib/hook-corpus-fs.cjs` · `hook-corpus-content.cjs` · `hook-corpus-payload.cjs` | file-tree, git and artifact builders; the hook stdin payload shapes |
| `scripts/lib/hook-corpus-cases-{gate1,preship,privacy,feedback,guards,d1,observers,cli}.cjs` | the case definitions, one file per group family |
| `tests/hooks/golden/*.json` | 82 fixtures |
| `tests/hooks/golden/index.json` | manifest: per-group counts, every fixture's exit and marker, and the not-recorded table |

The recorder is the one place in this sprint that still runs bash on purpose. AC-13 excludes it from the CI suites; the
replay suite (AC-03) spawns no shell.

## Determinism

The recorder extracts BASE with `git archive b8556870 -- .claude/hooks .claude/skills/{careful,freeze,investigate,sprint-contract} .claude/skills/cook/scripts .claude/scripts`
into a throwaway directory, then gives every case its own fresh copy of that tree as a project root. Nothing reads the
working tree, so a dirty checkout cannot leak into a fixture.

Pinned per run (`hook-corpus-env.cjs`): `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin`), a per-case `HOME`
inside the throwaway project, `TZ=UTC`, `LC_ALL=C`, `LANG=C`, `GIT_CONFIG_GLOBAL=/dev/null`,
`GIT_CONFIG_SYSTEM=/dev/null`, a fixed git author/committer identity and a fixed `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`
of `2026-01-01T00:00:00+0000`, plus `NO_COLOR`, `TERM=dumb` and the quiet `npm_config_*` flags. The environment is
**replaced**, not extended, so no inherited `MEOWKIT_*`, `CLAUDE_*` or `HOOK_*` variable from the recording session can
reach a hook.

Pinning the git identity and dates makes commit SHAs reproducible, which the Gate 2 revision-binding fixtures depend on:
`preship-commit-verdict-not-naming-head` records `revision under review (b5c9dd3)` and that SHA is stable across runs.

### Verification run

```
$ node scripts/record-hook-golden-corpus.cjs                       # writes tests/hooks/golden
$ node scripts/record-hook-golden-corpus.cjs --out <tmp>/verify    # re-records at BASE into a temp dir
$ diff -r tests/hooks/golden <tmp>/verify
$ echo $?
0
```

**Result: identical, no output from `diff`.** Independently repeated three times into four separate output directories
(`run1`/`run2`, then `run3`/`run4` after the file split) — byte-identical every time.

Corpus checksum, for the reviewer to re-derive:

```
$ cat tests/hooks/golden/*.json | shasum -a 256
9d269c8c95e6b06fe20f7e0cb7dc94a15d245dc00c58b65c245fce3718f08bf0  -
```

### Normalizers

Each fixture records the normalizers applied to it, in `normalizers`. The default — and the only one on every safety,
Gate 2, privacy, stdin, post-write, pre-completion-check and D1 fixture's `stdout`/`stderr` — is a single substitution:

- **`tmpdir`** — the absolute throwaway-project path → `{{TMP}}`. This is the one substitution AC-03 allows.

Opt-in, used only where BASE writes a wall-clock value, and named per fixture:

- **`isoTimestamp`** — `date -u +%Y-%m-%dT%H:%M:%SZ` → `{{TS}}` (the LEAN bypass log, the careful security log, the
  trace log, the hook-fire log, the learning-observer ledger, the precompact re-arm sentinel)
- **`homedir`**, **`isoDate`**, **`pid`** — declared in `hook-corpus-env.cjs` for the observer ports; no fixture in this
  corpus needs them yet

Every `isoTimestamp` fixture is an observer or a side-effect file. The 12 safety fixtures AC-03 replays carry
`["tmpdir"]` only, with one bookkeeping exception: `gate1-lean-mode-contract-bypass` also declares `isoTimestamp`, which
applies **only** to its side-effect log — its `stdout` and `stderr` are both empty, so AC-03's "stderr matches after one
normalization" still holds on the streams.

## Fixtures by group (82 total)

| Group | Count |
| --- | --- |
| `gate1` | 13 |
| `gate2-preship` | 12 |
| `privacy` | 5 |
| `stdin-d2` | 6 |
| `post-write` | 2 |
| `pre-completion-check` | 2 |
| `guard-careful` | 2 |
| `guard-freeze` | 3 |
| `guard-investigate` | 3 |
| `d1-validate-contract` | 3 |
| `d1-check-contract-signed` | 4 |
| `d1-validate-gate-2` | 3 |
| `observer-pre-task-check` | 3 |
| `observer-tdd-flag-detector` | 3 |
| `observer-learning-observer` | 2 |
| `observer-capability-bootstrap` | 2 |
| `observer-jira-env-loader` | 3 |
| `observer-precompact-probe` | 1 |
| `observer-posttoolfailure-probe` | 1 |
| `observer-control-probe` | 1 |
| `cli-pre-implement` | 5 |
| `cli-append-trace` | 3 |

### AC-02 required cases, mapped

| AC-02 case | Fixture | Exit · marker |
| --- | --- | --- |
| Gate 1: source edit with no plan | `gate1-source-edit-no-plan` | 2 · `@@GATE_BLOCK@@` |
| Gate 1: plan without receipt | `gate1-plan-without-receipt` | 2 · `@@GATE_BLOCK@@` |
| Gate 1: stale `plan_hash` | `gate1-plan-stale-hash` | 2 · `@@GATE_BLOCK@@` |
| Gate 1: approved plan → allow | `gate1-approved-plan-signed-contract` | 0 |
| Gate 1: `tasks/plans/*` write → allow | `gate1-plans-write-allowed` | 0 |
| Gate 1: unsigned contract | `gate1-approved-plan-unsigned-contract`, `gate1-approved-plan-no-contracts-dir` | 2 · `@@CONTRACT_GATE_BLOCK@@` |
| Gate 1: invalid contract file edit | `gate1-contract-edit-invalid` | 2 · `@@GATE_BLOCK@@` |
| Gate 1: `MEOWKIT_GATE1_PRESENCE_ONLY=1` + announcement | `gate1-presence-only-downgrade` | 0, announcement on stderr |
| Gate 2: commit with no verdict | `preship-commit-no-verdict` | 2 · `@@GATE_BLOCK@@` |
| Gate 2: FAIL verdict | `preship-commit-fail-verdict` | 2 · `@@GATE_BLOCK@@` |
| Gate 2: docs-only → N/A allow | `preship-commit-docs-only-na` | 0 |
| Gate 2: two matching verdicts | `preship-commit-two-verdicts` | 2 · `@@GATE_BLOCK@@` |
| Gate 2: verdict not naming HEAD | `preship-commit-verdict-not-naming-head` | 2 · `@@GATE_BLOCK@@` |
| Gate 2: passing verdict → allow | `preship-commit-passing-verdict` | 0 |
| `lib/gate2-check.sh:206` security-verdict BLOCK | `preship-commit-security-verdict-block` | 2 · `@@GATE_BLOCK@@` |
| `pre-ship.sh:38` gate2-check non-zero | `preship-commit-no-active-plan-pointer` (and every Gate 2 block above) | 2 · `@@GATE_BLOCK@@` |
| `pre-ship.sh:54` Gate 2 checker absent | `preship-gate2-checker-absent` | 2 · `@@GATE_BLOCK@@` |
| `pre-ship.sh:99` team-memory lint failure | `preship-memory-lint-failure` | 2 · `@@GATE_BLOCK@@` |
| `pre-ship.sh:220` failing build/lint/test step | `preship-build-step-failure` | 2, no marker |
| privacy: `.env` read | `privacy-read-dotenv` | 2 · `@@PRIVACY_BLOCK@@` |
| privacy: web-fetch manifest read | `privacy-read-webfetch-manifest` | 2 · `@@PRIVACY_BLOCK@@` |
| privacy: ordinary file | `privacy-read-ordinary-file` | 0 |
| privacy: a Bash command reading `.env` | `privacy-bash-reads-dotenv` | **0 — see the discrepancy below** |
| stdin: six D2 empty/non-JSON cases | `stdin-{empty,not-json}-{gate-enforcement,privacy-block,pre-ship}` | all 0, no output |
| post-write: blocked pattern · clean | `postwrite-blocked-pattern` (2, findings on stderr) · `postwrite-clean-file` (0) | |
| pre-completion-check: security BLOCK · clean | `precompletion-security-verdict-block` (0, `{"decision":"block",...}` on stdout) · `precompletion-clean-signed-contract` (0) | |
| careful: destructive · safe | `careful-destructive-command` (ask JSON + security-log entry) · `careful-safe-command` (`{}`) | |
| freeze: outside · inside | `freeze-edit-outside-boundary` (deny JSON) · `freeze-edit-inside-boundary` (`{}`) | |
| investigate: wrong path · right path | `investigate-report-path-wrong` (2, deny JSON) · `investigate-report-path-right` (0, `{}`) | |
| D1: one valid + one invalid each | `validate-contract-{valid,invalid}` (0/1) · `check-contract-signed-{valid,invalid}` (0/1) · `validate-gate-2-{valid,invalid}` (0/1) | |

Extra fixtures beyond the AC-02 minimum, recorded because the node port has to preserve them too:
`gate1-test-file-allowed`, `gate1-contract-edit-valid`, `gate1-lean-mode-contract-bypass`,
`gate1-backup-directory-blocked`, `preship-non-ship-command`, `privacy-bash-webfetch-loopback`,
`freeze-no-boundary-configured`, `investigate-report-path-missing`, `validate-contract-usage-error`,
`check-contract-signed-{no-plans-dir,lean-bypass}`, `validate-gate-2-file-missing`, and the observer/CLI groups for
AC-07.

## Discrepancy that needs a user decision

**AC-02 lists "privacy: … a Bash command reading `.env` → block". BASE does not block it.**

`privacy-block.sh:35` guards Check 1 (the sensitive-path patterns) with `if [ -n "$FILE_PATH" ]`, and `FILE_PATH` comes
from `tool_input.file_path`, which a `Bash` payload does not carry. `COMMAND` (`tool_input.command`) is examined only by
Check 2 (`:59-87`), whose `case` matches `*fetch_as_markdown.py*`, `*web-to-markdown*` and `*mk:web-to-markdown*` — not
the sensitive-path regex. So `{"tool_name":"Bash","tool_input":{"command":"cat .env"}}` reaches `exit 0`.

The fixture records exit 0 with empty streams, per the instruction not to fake a case. This is the same class of item as
D2: making the node port block it is a **deliberate behavior change** that Scope (Out) currently forbids ("Do not change
what … privacy-block … decides, except D2 and the AC-04 crash-path hardening"). It needs an explicit decision —
either a **D4** carving it out the way D2 was carved out (and then this fixture is excluded from AC-03's parity set), or
an AC-02 amendment striking the case. The generator should not resolve it silently in either direction.

Related, recorded for the same reviewer: AC-09 counts `freeze/SKILL.md`'s two registrations toward the BASE per-`Edit`
process count, but per the AC-01 evidence those registrations never fire at BASE, so the real BASE count with
`mk:freeze` active is 5, not 6.

## Cases deliberately not recorded

Also carried in `tests/hooks/golden/index.json` under `notRecorded`, so the omission is machine-visible rather than
tacit.

| Observer | Why no deterministic BASE fixture |
| --- | --- |
| `post-session` | Reads the live `transcript_path` and writes session duration and token-count fields derived from it. No fixture transcript yields stable derived numbers across runs, and normalizing the numbers away would leave the fixture asserting nothing about the behavior under test. The node port's parity has to be asserted by a unit test over a pinned transcript file instead. |
| `project-context-loader` | Emits the content of `docs/` and `.claude/rules/` at BASE, so its output is a copy of files this sprint also changes. A BASE recording would be stale on its own replay. Assert the port against a pinned fixture rule tree in the AC-07 node suite. |

Neither is a safety entrypoint, a feedback handler, a guard or a D1 module, so no AC-02/AC-03 requirement depends on
them; both are AC-07 observers whose verification shifts from "replay a BASE recording" to "unit test over a pinned
input", which must be stated in the AC-07 test file.

## Known environment dependencies

These do not affect run-to-run determinism on one host, but they are the corpus's portability limits and matter for the
`hooks-windows` job (AC-13):

1. **`python3` on `PATH`.** `lib/read-hook-input.sh` parses stdin with python, so every BASE fixture that reads a hook
   payload needs it. Recorded with `/usr/bin/python3` (CPython 3.15.2). Python's own parse error is swallowed by the
   `2>/dev/null` at `read-hook-input.sh:108`, so no python version string leaks into a fixture — verified by the
   `stdin-not-json-*` fixtures, which are byte-empty.
2. **`npm` on `PATH`.** Only `preship-build-step-failure` needs it (`npm test` against a `"test": "exit 1"` script).
   `run_check` discards the child's output, so npm's version banner cannot reach the fixture.
3. **`mewkit` must NOT be on `PATH`.** The pinned `PATH` has no global `mewkit` and the throwaway project has no
   `node_modules/.bin/mewkit`, so `pre-ship.sh:88` takes the documented `SKIP:` branch. If a host has a global
   `mewkit`, `preship-commit-{docs-only-na,passing-verdict,build-step-failure}` would record a lint run instead of the
   SKIP line. The recorder cannot detect this; re-recording on such a host would be caught by the AC-02 diff.
4. **`MEOWKIT_CLI` stub.** `preship-memory-lint-failure` points `MEOWKIT_CLI` at a generated node script with a
   `#!/usr/bin/env node` shebang, because `pre-ship.sh:80` requires the value to be `-x`. A shebang does not make a file
   executable on Windows, so the replay harness must materialize a platform-appropriate stub from the fixture's `setup`
   id rather than reusing the recorded path verbatim.

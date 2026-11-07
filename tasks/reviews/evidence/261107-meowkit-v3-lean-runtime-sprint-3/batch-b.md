# Batch B — node safety entrypoints, gate libraries and their proofs

Sprint 3, `meowkit-v3-lean-runtime`. Recorded 2026-11-08.
BASE = `b8556870d9f9f65ff82ececec44f9d2a751b2e37`. Amendment 1 (`0a78152f`) applied: D4, D5, the observer
unit-test method and the per-platform CLI stub.

## What landed

### Safety entrypoints (`.claude/hooks/`)

| File | Lines | Notes |
| --- | --- | --- |
| `gate-enforcement.cjs` | 171 | `@@GATE_BLOCK@@` / `@@CONTRACT_GATE_BLOCK@@` |
| `privacy-block.cjs` | 150 | `@@PRIVACY_BLOCK@@` |
| `pre-ship.cjs` | 120 | `@@GATE_BLOCK@@` |

Each installs `uncaughtException` and `unhandledRejection` handlers that print its marker and exit 2 **before the first
`require`**. The handlers are written inline rather than imported on purpose: importing them would reintroduce the
dependency they exist to survive. Each requires only modules under `.claude/hooks/lib/`.

### Libraries (`.claude/hooks/lib/`)

Reused and extended, not duplicated: `parse-stdin.cjs` gained `readHookInput()` (fail-closed reader; reports *why*
input was unreadable; returns the file path exactly as the payload spelled it, because the guards echo that value and
match it against repo-relative rules). `parseStdin()` and `normalizeFilePath()` are untouched, so the dispatcher and the
existing handlers are unaffected. `meowkit-paths.cjs` and `secret-scrub.cjs` were not needed on any safety path and are
not imported there.

New: `approval-receipt.cjs` (146), `plan-discovery.cjs` (70), `gate1-path-rules.cjs` (90), `gate2-check.cjs` (174),
`gate2-change-set.cjs` (94), `gate2-verdict-lookup.cjs` (100), `gate2-structural-checks.cjs` (123),
`validate-contract.cjs` (123), `check-contract-signed.cjs` (148), `validate-gate-2.cjs` (75),
`memory-store-lint.cjs` (69), `preship-checks.cjs` (112).

### Thin CLIs

`.claude/skills/sprint-contract/scripts/validate-contract.cjs` (18),
`.claude/skills/sprint-contract/scripts/check-contract-signed.cjs` (19),
`.claude/skills/cook/scripts/validate-gate-2.cjs` (29). Each only renders; the rules live in the library, so a guard
and the diagnostic a human runs can never disagree.

### Library API for the completion check

Every gate helper returns `{ exit, stdout: string[], stderr: string[] }` rather than printing. The completion check can
therefore call `validateGate2({ input })` in-process and act on `exit` without spawning anything — which is what the
next batch needs when it stops shelling out to the verdict parser.

## Test results

```
$ npx vitest run tests/hooks
 ✓ tests/hooks/golden-replay.test.ts   (86 tests | 36 todo)
 ✓ tests/hooks/crash-paths.test.ts     (16 tests)
 ✓ tests/hooks/isolation.test.ts       (17 tests)
 ✓ tests/hooks/env-allowlist.test.ts   (8 tests)
 Test Files  4 passed (4)
      Tests  91 passed | 36 todo (127)
```

| Suite | Asserts |
| --- | --- |
| `golden-replay.test.ts` | 40 parity fixtures (gate1 13, gate2-preship 12, privacy 5, D1 10) replayed against the node tree: exit, marker, stdout and stderr compared whole; 6 unreadable-stdin fixtures asserted as the new block; 2 corpus-shape checks; 1 pending-coverage check; 36 observer/guard/feedback fixtures kept as `todo` |
| `crash-paths.test.ts` | 3 entrypoints × 5 scenarios = 15 runs, each exit 2 with its marker, plus a matrix-shape guard. Scenarios: a required library has a syntax error · is deleted · stdin empty · stdin not JSON · a library function patched to throw. All damage is done to a throwaway copy; nothing in the repo is modified and no shipped switch simulates any of it |
| `env-allowlist.test.ts` | Per entrypoint: reads nothing undeclared **and** declares nothing unread (both directions, so a stale entry cannot quietly widen the set); no dotenv read on any safety path; the two dead profile reads stayed dropped |
| `isolation.test.ts` | Require graph reaches no dispatcher, registry or handler, and nothing outside `lib/`; no `http`/`https`/`net`/`dgram`/`tls`; the four child-process call sites enumerated by file and target; no shell binary, no `.sh` target, no `shell: true`; node targets limited to the two in-repo validators; the store-lint and build/lint/test targets diffed against the allowlist; credential tokens absent from every hook and guard source |

```
$ node --test .claude/hooks/__tests__/*.test.cjs
 ℹ tests 36 · pass 36 · fail 0

$ npx vitest run                     # whole repo
 Test Files  241 passed (241)
      Tests  2741 passed | 36 todo (2777)

$ pnpm lint                          # packages/*/src scope
 ✖ 3 problems (0 errors, 3 warnings)  # all pre-existing, none in this change

$ npx eslint --no-ignore <every new .cjs>
 exit 0, 0 errors

$ pnpm typecheck
 exit 0

$ npx tsc --noEmit  (tests/hooks/**/*.ts, strict)
 exit 0
```

### The suites have teeth

Two mutations were introduced and reverted immediately:

| Mutation | Result |
| --- | --- |
| added `process.env.MEOWKIT_SECRET_BACKDOOR` to a reachable library | `env-allowlist` failed: `reads undeclared variables: expected [ 'MEOWKIT_SECRET_BACKDOOR' ] to deeply equal []` |
| removed `*.bak/*` from the suspicious-directory rule | `golden-replay` failed: `exit code for gate1-backup-directory-blocked: expected +0 to be 2` |

Tree restored and re-verified green after each.

## Deviation that needs sign-off: three diagnostics quote their own filename

Three recorded stderr lines name the implementation file they are about. The node port changes that filename, so one
line differs while the decision, the exit code, the marker and every other line match:

| Fixture | Recorded line | Node line |
| --- | --- | --- |
| `gate1-contract-edit-invalid` | `Run for diagnostics: .claude/skills/sprint-contract/scripts/validate-contract.sh <p>` | `…validate-contract.cjs <p>` |
| `preship-gate2-checker-absent` | `Gate 2 checker {{TMP}}/.claude/hooks/lib/gate2-check.sh not found` | `…gate2-check.cjs not found` |
| `validate-contract-usage-error` | `usage: {{TMP}}/…/validate-contract.sh <path-to-contract.md>` | `…validate-contract.cjs …` |

**This is a direct conflict between two signed criteria.** AC-03 requires stderr to match "after one documented
normalization that replaces the absolute temp-dir path with a placeholder, and no other normalization is applied".
AC-11 requires every reference to a deleted `.sh` in `.claude/` to "point at the node module or be removed". Printing
the `.sh` path satisfies AC-03 and fails AC-11 — and is a lie once the file is deleted. Printing the `.cjs` path
satisfies AC-11 and fails AC-03's single-normalization rule.

Resolved in code the AC-11 way (the `.cjs` path is printed), and the suite applies a **second named normalizer**,
`selfPath`, to **exactly those three fixtures, listed by name** in `golden-replay.test.ts`. It is one substitution,
`(\.claude/[\w./-]+)\.cjs` → `$1.sh`, never applied corpus-wide. Everything else is compared whole with `tmpdir` only.

**Requested: an AC-03 amendment** naming `selfPath`, its three fixtures, and the rule that it may only ever rewrite a
kit module's own path. Two more fixtures in the same class (`preimplement-no-feature-argument`,
`preimplement-strict-tdd-helper-missing`) land in the next batch and should be added to the same list; the amendment
should cover all five. Nothing was relaxed and no fixture was edited.

## Decisions made inside the port, for review

1. **A missing `gate2-check` module prints the specific "checker absent" block, not a generic crash.** A bare eager
   `require` would have produced node's own module-not-found text and failed that fixture's parity. The load is wrapped,
   and a failure yields the recorded message and exit 2 regardless of the command — stricter than the shell form, which
   only blocked on a ship command. No fixture covers a non-ship command with the module deleted, and a ship guard that
   cannot load its gate cannot prove anything about any command.
2. **Tool discovery stopped reading the search path.** The first draft scanned `PATH`/`PATHEXT` to decide whether
   `pytest`, `ruff`, `flake8`, `swiftlint` and the kit CLI exist. That is two variables outside the closed environment
   set the guard is allowed to consult, and the probe is a second answer that can disagree with the launch after it.
   Discovery is now "attempt the spawn, read `ENOENT`", which keeps the SKIP wording and the output order identical and
   leaves the environment set closed. This is why the allowlist test passes without a `PATH` entry.
3. **The bypass log line still says `LEAN` for a `MINIMAL` bypass.** Faithful to the shell form. It under-reports a
   `MINIMAL` bypass, which is a real if minor audit gap; left as a follow-up rather than changed here, since the log is
   append-only and read by date and a mid-file wording change would split one log into two formats.
4. **`chdir` failure exits 0.** The shell form did the same. For a guard this is fail-OPEN, but an unreachable project
   root leaves nothing to evaluate and the host reports it; recorded here so the choice is visible rather than assumed.
5. **Observer, guard and feedback fixtures are `todo`, not deleted.** 36 of them, with a shape assertion that fails if a
   recorded fixture disappears — so the pending coverage cannot evaporate quietly before the next batch ports it.

## Not touched

`.claude/settings.json` still registers the shell hooks (18 `.sh` references, file unmodified), so this repository's own
gates keep running the shell implementation until the replay and crash-path proofs are accepted. No `.sh` was modified
or deleted; no skill guard, observer, dispatcher or registry was touched; the plan directory is unchanged. The only
modified tracked file in `.claude/` is `lib/parse-stdin.cjs`, which was extended additively.

## Files created

```
.claude/hooks/gate-enforcement.cjs
.claude/hooks/privacy-block.cjs
.claude/hooks/pre-ship.cjs
.claude/hooks/lib/approval-receipt.cjs
.claude/hooks/lib/check-contract-signed.cjs
.claude/hooks/lib/gate1-path-rules.cjs
.claude/hooks/lib/gate2-change-set.cjs
.claude/hooks/lib/gate2-check.cjs
.claude/hooks/lib/gate2-structural-checks.cjs
.claude/hooks/lib/gate2-verdict-lookup.cjs
.claude/hooks/lib/memory-store-lint.cjs
.claude/hooks/lib/plan-discovery.cjs
.claude/hooks/lib/preship-checks.cjs
.claude/hooks/lib/validate-contract.cjs
.claude/hooks/lib/validate-gate-2.cjs
.claude/skills/cook/scripts/validate-gate-2.cjs
.claude/skills/sprint-contract/scripts/check-contract-signed.cjs
.claude/skills/sprint-contract/scripts/validate-contract.cjs
tests/hooks/golden-replay.test.ts
tests/hooks/crash-paths.test.ts
tests/hooks/env-allowlist.test.ts
tests/hooks/isolation.test.ts
tests/hooks/lib/replay-harness.ts
tests/hooks/lib/corpus-cases.ts
tests/hooks/lib/require-graph.ts
```

Modified: `.claude/hooks/lib/parse-stdin.cjs` (additive), `scripts/lib/hook-corpus-fs.cjs` plus
`hook-corpus-cases-{preship,cli}.cjs` and `scripts/record-hook-golden-corpus.cjs` — one change, `removeLib(ctx, …)`,
so a case's "this library is absent" setup deletes the right file for whichever tree flavor is under it. The recorder
was re-run after that change and the committed corpus is byte-identical (`diff -r` clean), so no fixture moved.

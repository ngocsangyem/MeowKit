# Batch C — dispatcher, observers, CLI modules and guards

Sprint 3, `meowkit-v3-lean-runtime`. Recorded 2026-11-08.
BASE = `b8556870d9f9f65ff82ececec44f9d2a751b2e37`. Amendment 1 (`0a78152f`) applied.

## What landed

### Dispatcher and registry

`.claude/hooks/dispatch.cjs` (115) reworked over `.claude/hooks/handlers.json` (schema 2): a flat array where every
entry carries `event`, `handler` and `toggleKey`, and a `matcher` only where the event is scoped to a tool. Reading and
validating the registry is split into `lib/handler-registry.cjs` (69) so a malformed registry is one reportable error
with a reason instead of a crash inside the dispatch loop.

- **Lazy per-handler `require` inside the try block.** Loading them up front would let one unparseable file take down
  the whole event.
- **Fail-open.** A handler that throws, fails to load, or is missing is reported on stderr; every other handler for the
  event still runs; the chain exits 0.
- **Feedback pass-through.** A handler may return `{ stdout, stderr, exitCode, feedback: true }`. Feedback is emitted
  only after all advisory output, so the write scanner's exit 2 and the completion check's block decision both survive
  the chain without costing the other observers their turn.
- **The dotenv load is gone from the dispatcher.** It used to run for every handler. Only `jira-env-loader` reads it
  now, through `lib/load-dotenv.cjs`.
- **The 9 pre-existing `.cjs` handlers are kept and each has a `toggleKey`.** Toggles are declared only; nothing reads
  `hooks.<key>` yet.
- **No write guard is in the registry** — asserted by a test, because one in there would inherit the fail-open contract.

### Observers (12) — `.claude/hooks/handlers/`

`pre-task-check.cjs` (98) · `post-write.cjs` (100) · `learning-observer.cjs` (58) · `pre-completion-check.cjs` (146) ·
`post-session.cjs` (170) · `tdd-flag-detector.cjs` (54) · `project-context-loader.cjs` (147) ·
`capability-bootstrap.cjs` (24) · `jira-env-loader.cjs` (36) · `precompact-probe.cjs` (49) ·
`posttoolfailure-probe.cjs` (13) · `control-probe.cjs` (14)

`pre-completion-check.cjs` requires the verdict parser in-process (`lib/validate-gate-2.cjs`), so it and the ship guard
cannot disagree about what a blocking verdict is. It spawns nothing.

### CLI modules (2)

`.claude/hooks/pre-implement.cjs` (115) — argv-driven, fail-CLOSED in strict mode, never in the registry.
`.claude/hooks/append-trace.cjs` (16) — argv-driven, always exits 0.

### Ported libraries

`lib/hook-logger.cjs` (53) · `lib/tdd-detect.cjs` (57) · `lib/resolve-model.cjs` (54) · `lib/load-dotenv.cjs` (69) ·
`lib/sidecar-lock.cjs` (103) · `lib/trace-log.cjs` (123) · `lib/session-context-report.cjs` (133) ·
`lib/handler-registry.cjs` (69).

Reused rather than duplicated: `lib/meowkit-paths.cjs` (the taxonomy resolver, used instead of porting its shell twin),
`lib/secret-scrub.cjs` (the scrub used by the trace writer and the cost recorder), `lib/parse-stdin.cjs`.

### Guards

`.claude/skills/careful/bin/check-careful.cjs` (85) with its pattern table in
`.claude/skills/careful/references/destructive-command-patterns.cjs` (86) ·
`.claude/skills/freeze/bin/check-freeze.cjs` (52) · `.claude/skills/investigate/bin/check-report-path.cjs` (66).

The three `SKILL.md` `hooks:` blocks now use exec form with the placeholder the live probe proved resolves:

```yaml
        - type: command
          command: node
          args: ["${CLAUDE_PROJECT_DIR}/.claude/skills/careful/bin/check-careful.cjs"]
          statusMessage: Checking for destructive commands...
```

`.claude/skills/investigate/bin/check-freeze.sh` deleted (it exec'd a path that does not exist and exited 126; nothing
registered it). Removed with a single-file `rm`.

## Test results

```
$ npx vitest run tests/hooks
 ✓ golden-replay.test.ts           (86)
 ✓ isolation.test.ts               (17)
 ✓ crash-paths.test.ts             (16)
 ✓ dispatcher.test.ts              (13)
 ✓ sentinel-pipeline.test.ts       (12)
 ✓ completion-gate.test.ts         (10)
 ✓ env-allowlist.test.ts            (8)
 ✓ post-session-recording.test.ts   (7)
 ✓ session-start-context.test.ts    (6)
 Test Files  9 passed (9)
      Tests  175 passed (175)        # 0 todo — the 36 pending fixtures are now active
```

| Suite | Asserts |
| --- | --- |
| `golden-replay` | **All 82 recorded fixtures** now replay against the node tree (was 40 + 6 + 36 todo). Observers and the two feedback handlers run **through the dispatcher**; guards and argv modules run directly |
| `dispatcher` | 3 failure modes (throws · syntax error · missing file) each paired with "the healthy handler still ran" and "exit 0"; a missing registry and an invalid registry; both feedback cases incl. ordering (advisory output precedes the decision); a crashing feedback handler stays fail-open; registry schema — event/handler/toggleKey on every entry, matcher exactly where the event is tool-scoped, every handler file exists, the 9 pre-existing handlers still registered, no write guard present |
| `sentinel-pipeline` | 12 cases carried over from the deleted-in-the-next-batch shell integration test: first turn, both flags, partial flags, another session's marker, the bypass switch, empty session id, corrupt line, latest-line-wins, re-arm invalidation and restoration, same-timestamp tie by file position, and the producer's two edge cases |
| `completion-gate` | 10 cases carried over from the shell regression test: no obligation, `required:false`, missing slug, block with attempt counting, the 3-attempt cap then the nudge with the counter cleared, evaluator verdict clears it, signed contract accepted, slug from a path-only pointer, security block beats valid evidence without consuming an attempt, and the stop allowed once security passes |
| `post-session-recording` | Pinned-input tests: the exact cost-entry field set, model from the session artifact rather than the environment, the budget snapshot scrubbed, a model change flagged once then recorded, a failed detection not mistaken for a change, an unsafe session id refused, a safe one well-formed |
| `session-start-context` | Pinned-input tests: every orientation block present, the no-context-file message, the size gate truncating before injection, readiness scored 0/5 and 5/5, per-session state cleared while the plan pointer and the attempt counter survive, and no reset when the session has not changed |

```
$ node --test .claude/hooks/__tests__/*.test.cjs
 ℹ tests 36 · pass 36 · fail 0          # unchanged, no edits needed

$ npx vitest run                         # whole repo
 Test Files  246 passed (246)
      Tests  2825 passed (2825)          # 0 todo

$ pnpm lint                 0 errors (3 pre-existing warnings, none in this change)
$ npx eslint --no-ignore <every new .cjs>   exit 0
$ pnpm typecheck            exit 0
$ npx tsc --noEmit  (tests/hooks/**/*.ts, strict)   exit 0
$ node scripts/record-hook-golden-corpus.cjs --out <tmp> && diff -r tests/hooks/golden <tmp>
 IDENTICAL                               # the corpus is untouched by this batch
```

Every file is under 200 lines. `post-session-recording.test.ts` was split out of a single oversized session-handler
suite, with the shared loader and project builder moved to `tests/hooks/lib/handler-fixtures.ts` (53).

### The suites have teeth

Mutation introduced and reverted: `process.exit(1)` added to the dispatcher's handler-error path → 4 of 13 dispatcher
tests failed, naming the fail-open contract. Restored and re-verified green. (Batch B's two mutations are recorded in
`batch-b.md`.)

## How an observer fixture is replayed, and why

An observer stopped being a file the host launches and became a registry entry the dispatcher calls, so replaying it by
running the file would test code that is no longer on the real path. `tests/hooks/lib/dispatch-replay.ts` therefore:

1. reads the **real** registry to find the entry for the handler under test — which means a handler missing from the
   registry fails here;
2. writes a **single-entry** registry into the throwaway project, because a full registry would run every sibling
   observer for that event and their output would land in the comparison;
3. invokes `dispatch.cjs <event> [matcher]` from that entry.

The narrowing happens only in the throwaway tree. Nothing shipped can select a subset of handlers.

One harness bug worth recording: the replay copied the working tree's `.claude/hooks` wholesale, which dragged in this
machine's accumulated `.logs/hook-log.jsonl`. Side-effect assertions were then comparing against local history. The copy
now filters runtime state (`.logs`, `session-state`, `.venv`) — the recorder never had the problem because it reads the
tree out of version control.

## Contract-amendment items (exact list for Amendment 2)

1. **`selfPath` normalizer — now five fixtures.** A second named normalization for output that quotes the
   implementation's own filename. One substitution, `([\w./-]+)\.cjs` → `$1.sh`, applied only to a named list:
   `gate1-contract-edit-invalid`, `preship-gate2-checker-absent`, `validate-contract-usage-error`,
   `preimplement-no-feature-argument`, `preimplement-strict-tdd-helper-missing`. (Batch B asked for the first three; the
   last two are the pre-implement pair this batch activated, exactly as predicted.) The amendment should state the rule
   that it may only ever rewrite a kit module's own path.
2. **The injection scanner's advisory exit becomes 0 through the dispatcher.** `pretaskcheck-injection-blocked` was
   recorded at exit **1**; dispatched it is **0**. Two signed criteria conflict: the dispatcher must exit 0 when no
   feedback handler reported, and observer exit status must match the recording. Exit 1 on this event is documented
   ADVISORY — the call proceeds either way — and the finding text is unchanged and still compared whole, so nothing is
   enforced differently. Resolved in favour of the fail-open rule and asserted via a named one-fixture exception in
   `golden-replay.test.ts`. The amendment should either accept exit 0 for a dispatched advisory observer, or add
   "advisory" as a third pass-through kind so exit 1 propagates. **Recommend accepting exit 0**: a chain that reports
   one observer's advisory failure as its own makes every sibling observer look broken too.
3. **`PostToolUseFailure` carries no matcher.** It is tool-scoped in principle, but it is registered without one, so the
   registry requires a matcher for `PreToolUse` and `PostToolUse` only. Worth stating explicitly so a future reviewer
   does not read the missing matcher as a defect.
4. **The bypass log still names `LEAN` for a `MINIMAL` bypass** (carried over from Batch B, accepted for parity).
   Flagged as a follow-up phase item, not a Batch C change.

## Behaviour changes beyond parity, for the verdict

- **The guards now fire.** Per the signed Amendment 1 (D5). `freeze` guards `Edit` and `Write`, so a session with that
  skill active now has a boundary it did not have before.
- **The report-path guard resolves a non-existent path.** The shell version used a resolver that tolerates missing
  paths; Node's `realpathSync` throws. Resolving only the deepest existing ancestor restores the original semantics —
  without it, every first write to a not-yet-created report directory answered "cannot verify the report path", which is
  a refusal the recording does not contain. Caught by the `investigate-report-path-wrong` fixture.
- **Tool discovery in the session-start report launches instead of scanning the path.** Same reasoning as the ship
  guard's in Batch B: the answer becomes "can this start" rather than "does a file with that name exist", and no extra
  environment variable is consulted.

## Not touched

`.claude/settings.json` is unmodified and still registers the shell hooks (18 `.sh` references), so this repository's own
gates and observers keep running the shell implementation until Batch D switches them over. No `.sh` under
`.claude/hooks/` was modified or deleted; `__tests__/test-pre-completion-check.sh` and `__tests__/test-sentinel.sh`
remain in place with their assertions now also covered in node. The plan directory is unchanged. Nothing committed.

## Files

**Created**

```
.claude/hooks/append-trace.cjs
.claude/hooks/pre-implement.cjs
.claude/hooks/handlers/{pre-task-check,post-write,learning-observer,pre-completion-check,post-session,
                        tdd-flag-detector,project-context-loader,capability-bootstrap,jira-env-loader,
                        precompact-probe,posttoolfailure-probe,control-probe}.cjs
.claude/hooks/lib/{handler-registry,hook-logger,load-dotenv,resolve-model,session-context-report,
                   sidecar-lock,tdd-detect,trace-log}.cjs
.claude/skills/careful/bin/check-careful.cjs
.claude/skills/careful/references/destructive-command-patterns.cjs
.claude/skills/freeze/bin/check-freeze.cjs
.claude/skills/investigate/bin/check-report-path.cjs
tests/hooks/{dispatcher,sentinel-pipeline,completion-gate,post-session-recording,session-start-context}.test.ts
tests/hooks/lib/{dispatch-replay,handler-fixtures}.ts
tasks/reviews/evidence/261107-meowkit-v3-lean-runtime-sprint-3/batch-c.md
```

**Modified:** `.claude/hooks/dispatch.cjs` (reworked), `.claude/hooks/handlers.json` (schema 2),
`.claude/skills/{careful,freeze,investigate}/SKILL.md` (hook blocks only),
`tests/hooks/golden-replay.test.ts` (36 fixtures activated), `tests/hooks/lib/replay-harness.ts` (dispatch routing,
runtime-state copy filter, broadened `selfPath`).

**Deleted:** `.claude/skills/investigate/bin/check-freeze.sh`.

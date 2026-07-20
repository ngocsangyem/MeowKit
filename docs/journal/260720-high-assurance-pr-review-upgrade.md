# High-assurance PR review upgrade — build journal (2026-07-20)

Cooked plan `260719-2152-high-assurance-pr-review-upgrade-for-meowkit` (7 phases,
gate-approved one at a time). Shipped a `ReviewSession` pipeline: `mewkit review
prepare|read|coverage|compose|submit|cleanup` + `worktree review-pr`/`review-pr-cleanup`
+ `mk:review-pr --assured/--reply`.

## What landed

- Phase 1 baseline (green: 216 files/1690 tests, 0 fail) + design corrections.
- Zod `ReviewSession` contract; detached, nonce-owned, SHA-bound review worktree with
  manifest-only cleanup.
- `review prepare`: fork-safe remote match, immutable hash-pinned diff, `untrusted/`
  quarantine, deterministic impact map + scout escalation.
- Session-observed coverage recorder (CLI wrapper + real Bash-hook corroboration),
  fail-closed coverage gate, `attested` fallback.
- Scope-driven review topology (small/medium/large + whole-diff roles + heavy-file
  invariant slices); batch-verify + single-round reverse audit in the step files.
- `compose` mechanical cap table (PASS impossible without complete session-observed
  coverage); `submit` = sole write path (`--reply` + payload-hash confirmation +
  head-SHA recheck + idempotency); gate2 coverage-block extension.
- Phase 7 parity: **20/20 matrix + scenarios 21–23 pass**, all safety-critical pass.

## Lessons / decisions

- **The shared `git()` helper shells a string** (`execSync(\`git ${cmd}\`)`). The first
  review found two CONFIRMED command-injection RCEs from interpolating manifest/PR data
  into it. Root fix: array-argv `execFileSync` everywhere touching untrusted data — used
  for every new git/gh call. This is the single most important recurring lesson.
- **A review worktree hosts untrusted PR code**, so anything it can write is attacker
  controlled: it drove the symlink-exfiltration fix in `read` (realpath confinement), the
  `untrusted/` quarantine (grep hits keep only `path:line`), and the manifest/back-ref
  format validation.
- **Host capability limit (spike-verified):** subagent Bash never reaches the parent
  PostToolUse dispatcher and the payload has no agent id → `session-observed` is
  anti-accidental, not unforgeable, and never proves individual-reviewer provenance.
  Shipped honestly: subagent-driven reviews are `attested`, Approve-capped, disclosed.
- **Qwen `/review` reference source is absent in-tree** → parity is spec-driven with a
  documented residual gap (not a line-traced comparison).
- **Test topology:** `.claude/**/*.test.cjs` are node-native (run via CI node steps, not
  vitest); `npm test` = root vitest default-globs `packages/mewkit/**`. `mewkit` CLI is
  not npm-linked in the cook env — run `node packages/mewkit/dist/index.js` after build;
  regenerate the `plugin/` mirror with `build-plugin`.

## Known issues (not caused by this work)

- Heavy shell/python-spawning integration tests (`hook-shell-runtime`, `gate-enforcement`,
  `validate-verdict`, `context-audit`, `doctor-hard-gates` hook probe, `trace-append`
  concurrency) are FLAKY under sustained machine load — they fail on different untouched
  hooks/subtests each run and pass in isolation. Final full suite: 1826 pass / 4 flaky
  fail. All new review code passed. `trace-append` flake spun off as a separate task.

## Status

Cooked + reviewed, NOT committed/shipped (cook stops before ship). Docs impact: major
(new CLI command group + skill lanes) — `docs/architecture/system-architecture.md`
updated in this change.

---
contract_schema_version: 1.0.0
task: meowkit-v3-lean-runtime
sprint: 3
plan_ref: tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
rubric_preset: cli-tool
status: amended
generator_signed: 671a5f3aa416e5552dedc5d5c339d4b26b0c9793
evaluator_signed: null
rounds: 2
created: 261107-2251
---

# Sprint 3 Contract — Node-only hooks: independent fail-closed safety entrypoints, one observer dispatcher

Testable translation of `phase-02-node-only-hooks.md` (Requirements, Architecture, Success Criteria), with three user
decisions recorded 261107.

## Decisions (user, 261107)

- D1 Gate helper scripts are ported: `.claude/skills/sprint-contract/scripts/validate-contract.sh`,
  `.claude/skills/sprint-contract/scripts/check-contract-signed.sh` and `.claude/skills/cook/scripts/validate-gate-2.sh`
  become node modules under `.claude/hooks/lib/` (`validate-contract.cjs`, `check-contract-signed.cjs`,
  `validate-gate-2.cjs`) that the safety entrypoints and `pre-completion-check` `require` directly. Each skill keeps a
  thin `.cjs` CLI in its `scripts/` dir for manual use. Nothing in this set spawns `bash` or `sh`.
- D2 Unparseable stdin is a hard block. When stdin to `gate-enforcement`, `privacy-block` or `pre-ship` is empty or not
  JSON, the node entrypoint exits 2 with its marker. At BASE those six cases exit 0 and print nothing; this is a
  deliberate behavior change. Valid JSON that names no file path or command still allows, as at BASE.
- D3 `pre-completion-check`'s Stop block survives through the dispatcher. The dispatcher passes a feedback handler's
  output through: `post-write`'s exit 2 with its finding on stderr, and `pre-completion-check`'s
  `{"decision":"block",...}` on stdout. A feedback handler that crashes or fails to load is logged and fails open, like
  every other observer.

## Pinned baseline

- BASE = `b8556870d9f9f65ff82ececec44f9d2a751b2e37` (Phase 01 commit, last commit before this sprint).
  "Bash behavior" means the scripts as they exist at BASE. The golden corpus is recorded by running the BASE scripts;
  the recording script is committed so the corpus can be re-recorded from BASE.

## Definitions

- **Safety entrypoint:** exactly `.claude/hooks/gate-enforcement.cjs`, `.claude/hooks/privacy-block.cjs`,
  `.claude/hooks/pre-ship.cjs`. Registered directly in `settings.json`, fail-closed, never in the registry.
- **Registry:** `.claude/hooks/handlers.json` (kept; extended schema). Each entry has `event`, `handler` (path),
  `toggleKey`, and `matcher` when the event is tool-scoped (`PreToolUse`, `PostToolUse`, `PostToolUseFailure`).
- **Observer:** any registry entry. **Feedback handler:** the two observers whose output the dispatcher must pass through
  (D3): `post-write` and `pre-completion-check`.
- **CLI module:** a node script invoked by an agent or another module with argv, not by a hook event:
  `pre-implement.cjs` (`.claude/agents/developer.md:29`) and `append-trace.cjs` (called by `post-session`,
  `learning-observer`).

## Scope (In)

- The three safety entrypoints, each with top-level `uncaughtException`/`unhandledRejection` handlers that print its
  marker and exit 2, requiring only modules under `.claude/hooks/lib/`
- Ported libs: stdin parsing, paths, secret scrub, approval receipt, Gate 2 check, and the three D1 modules
- One dispatcher (`dispatch.cjs`) over the registry, with lazy per-handler `require` in try/catch; the 9 BASE `.cjs`
  handlers (`auto-checkpoint`, `budget-tracker`, `build-verify`, `checkpoint-writer`, `loop-detection`,
  `model-detector`, `orientation-ritual`, `review-evidence-tag`, `safety-sentinel-inject`) stay and get `toggleKey`s
- 12 observer ports of the registered BASE bash hooks: `pre-task-check`, `post-write`, `learning-observer`,
  `pre-completion-check`, `post-session`, `tdd-flag-detector`, `project-context-loader`, `capability-bootstrap`,
  `jira-env-loader`, `precompact-probe`, `posttoolfailure-probe`, `control-probe`
- 2 CLI module ports: `pre-implement.cjs` (stays fail-closed in strict TDD mode, never dispatched) and `append-trace.cjs`
- Skill guards ported: `careful/bin/check-careful.cjs`, `freeze/bin/check-freeze.cjs`,
  `investigate/bin/check-report-path.cjs`, with their SKILL.md `hooks:` blocks. `investigate/bin/check-freeze.sh` is
  deleted as dead code: it execs a nonexistent `../../mk:freeze/bin/check-freeze.sh`, exits 126 at BASE, and nothing
  registers it
- `settings.json` collapsed to the safety entrypoints, `ensure-skills-venv.sh`, and one `dispatch.cjs` registration per
  event and matcher
- Consumers rewritten: `check-packs.ts` `SAFETY_PATHS` (target list in AC-10), `doctor-hard-gates.ts` (probe set in
  AC-10, Windows skip removed), `hook-runner.ts`, `build-hooks-inventory.ts`, `scripts/check-hook-registration.sh`,
  `tests/check-hook-registration.test.sh`, `.github/workflows/ci.yml`, `HOOKS_INDEX.md`, the codex/cursor hook
  translators and their regenerated projections
- `scripts/check-hook-shell-consistency.sh` and its CI step are deleted: its only subject is `sh`/`bash`-registered hooks,
  and the one survivor (`ensure-skills-venv.sh`) is registered with `bash`, which the script itself exempts
- The four node-native hook tests `.claude/hooks/__tests__/{advisory-boundary,gate2-ship-boundary,post-write-security,pre-ship-memory-lint}.test.cjs`
  updated to the node tree; the two shell tests `.claude/hooks/__tests__/{test-pre-completion-check,test-sentinel}.sh`
  have their assertions moved into node tests and are deleted
- `packages/mewkit/src/core/provider-lifecycle.ts:79` (hard-codes `test-pre-completion-check.sh` as proof) repointed to
  its node replacement
- `.meowkit/.env` loading narrowed to the jira env loader (D1-independent; phase-02 Req 5)
- A new CI job `hooks-windows` on `windows-latest`
- Delete every `.sh` under `.claude/hooks/` and every skill `bin/*.sh`, except `ensure-skills-venv.sh`

## Scope (Out)

- `ensure-skills-venv.sh` and the lazy Python resolver (phase 05)
- Reading `hooks.<toggleKey>` from `.meowkit/config.yaml` (phase 03); this sprint only declares the keys
- Memory hooks owned by phase 08; they must not be reintroduced
- Any change to what Gate 1, Gate 2, privacy-block, pre-ship, post-write or pre-completion-check decide, except D2 and
  the AC-04 crash-path hardening (at BASE a missing lib falls through to allow; the node port blocks)
- Non-hook `.sh` scripts in `scripts/` and in skills other than the D1 three and the guards
- The existing `codex-windows` CI job (`ci.yml:310`): left as is
- A green Windows CI run before the branch is pushed: the job is defined and its suites are proven bash-free locally;
  the first CI result is recorded once CI runs (AC-13)

## Acceptance Criteria

### [AC-01] Exec form for registrations is decided by evidence

**Given** the hook command forms Claude Code supports
**When** the generator checks whether `$CLAUDE_PROJECT_DIR` (settings.json) and `${CLAUDE_SKILL_DIR}` (SKILL.md `hooks:`) each resolve in the `{command:"node", args:[...]}` form
**Then** both results and their evidence (a cited Claude Code doc section, or a captured live probe) are recorded in the verdict evidence; every node registration in `settings.json` uses the form recorded for `$CLAUDE_PROJECT_DIR`, and every SKILL.md guard registration uses the form recorded for `${CLAUDE_SKILL_DIR}`, with quoted paths wherever the string form is used

- **Verification:** read the recorded evidence; parse `settings.json` and the three SKILL.md `hooks:` blocks
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-02] Golden corpus recorded from BASE bash

**Given** the BASE scripts
**When** the committed recording script runs each case against them
**Then** `tests/hooks/golden/` holds one fixture per case with stdin or argv, environment, file-tree setup, exact stdout, exact stderr, exit code and marker, covering at least:
- Gate 1: source edit with no plan → block; plan without receipt → block; stale `plan_hash` → block; approved plan → allow; `tasks/plans/*` write → allow; unsigned contract → block; invalid contract file edit → block; `MEOWKIT_GATE1_PRESENCE_ONLY=1` downgrade with its announcement
- Gate 2 / pre-ship: commit with no verdict → block; FAIL verdict → block; docs-only → N/A allow; two matching verdicts → block; verdict not naming HEAD → block; passing verdict → allow; security-verdict BLOCK → block (`lib/gate2-check.sh:206` path); Gate 2 checker absent → block (`pre-ship.sh:54`); team-memory lint failure → block (`pre-ship.sh:99`); a failing build/lint/test step → block (`pre-ship.sh:220`)
- privacy: `.env` read → block; web-fetch manifest read → block; ordinary file → allow; a Bash command reading `.env` → block
- stdin: empty and non-JSON stdin for each safety entrypoint, recorded as BASE exit 0 (these six are the D2 cases)
- post-write: a blocked pattern → exit 2 with the finding on stderr; clean file → exit 0
- pre-completion-check: security verdict BLOCK on the active plan → `{"decision":"block",...}`; clean → no block
- careful: destructive command → block; safe command → allow. freeze: edit outside the boundary → block; inside → allow. investigate report path: wrong path → block; right path → allow
- validate-contract, check-contract-signed and validate-gate-2 CLI cases: one valid and one invalid input each

- **Verification:** list fixtures; re-run the recording script at BASE into a temp dir and diff against the committed corpus (identical)
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-03] Node safety entrypoints reproduce the golden corpus

**Given** the AC-02 corpus minus the six D2 stdin fixtures
**When** `npx vitest run tests/hooks/golden` runs every safety, D1 and feedback fixture against the node code
**Then** every fixture's exit code, marker and stdout match exactly; stderr matches exactly after one documented normalization that replaces the absolute temp-dir path with a placeholder, and no other normalization is applied; the six D2 fixtures are asserted separately by AC-04

- **Verification:** run the suite; read the normalization function (one substitution only)
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-04] Safety entrypoints fail closed on every crash path, with a pinned env allowlist

**Given** a scratch copy of the hook tree
**When** each safety entrypoint runs with (a) a syntax error injected into one lib it requires, (b) a required lib deleted, (c) empty stdin, (d) stdin that is not JSON, (e) a lib function patched in the copy to throw
**Then** all 15 runs exit 2 and print that entrypoint's marker; and the environment variables each entrypoint and its libs read at HEAD are exactly this list, with no other effect:
- all three: `CLAUDE_PROJECT_DIR` (project root)
- `gate-enforcement`: `MEOWKIT_GATE1_PRESENCE_ONLY` (downgrade to presence check, announced on stderr), `MEOWKIT_AUTOBUILD_MODE` (`LEAN`/`MINIMAL` skip the contract gate and append to the bypass log)
- `pre-ship`: `MEOWKIT_HOOK_PROFILE` / `MEOW_HOOK_PROFILE` (select the build/lint/test block only, never the Gate 2 check), `MEOWKIT_CLI` (path of the memory-lint CLI)
- `privacy-block`: none beyond the above. No entrypoint reads `.meowkit/.env`
- deliberately dropped: the `MEOWKIT_HOOK_PROFILE` / `MEOW_HOOK_PROFILE` reads at `gate-enforcement.sh:22` and `privacy-block.sh:25`, which are dead assignments at BASE (`MEOW_PROFILE` is never read again)

- **Verification:** run the crash-path suite; a test greps every `process.env.` read reachable from each entrypoint and compares it to this list
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-05] Safety entrypoints are isolated

**Given** the three safety entrypoints
**When** their full `require` graph is walked
**Then** it contains no `dispatch.cjs`, no `handlers.json`, no `handlers/` module, and no `http`, `https`, `net`, `dgram` or `tls` module; every `child_process` call site runs one of: `git`; the resolved mewkit CLI (memory lint, `MEOWKIT_CLI`); `node` on the two in-repo Gate 2 validators (evidence and review coverage); the project's configured build/lint/test commands and the `pytest`/`ruff`/`flake8` checks pre-ship runs at BASE; no call site targets `bash`, `sh` or a `.sh` file; and no source under `.claude/hooks/` or a skill `bin/` contains `.credentials`, `keychain` or `security find-generic-password`

- **Verification:** a test that walks the require graph and checks every `child_process` call site against the allowlist above; the credential grep runs in CI
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-06] Dispatcher runs observers fail-open and passes feedback through

**Given** the dispatcher and the registry
**When** an observer throws, an observer file has a syntax error, or an observer file is missing
**Then** the failure is logged to stderr, every other observer for that event still runs, and the dispatcher exits 0 (when no feedback handler reported); when `post-write` reports a blocked pattern the dispatcher exits 2 with the finding on stderr, and when `pre-completion-check` returns a block decision the dispatcher prints that JSON on stdout, in both cases after the other observers run; every registry entry has `event`, `handler` and `toggleKey`, tool-scoped entries also have `matcher`, the 9 BASE `.cjs` handlers are present, and no safety entrypoint appears in the registry

- **Verification:** dispatcher unit tests for the three failure cases and both feedback cases; parse the registry
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-07] Observer and CLI-module behavior preserved

**Given** golden fixtures recorded from BASE for the 12 observer ports and the 2 CLI modules
**When** the observers run through the dispatcher and the CLI modules run with their argv fixtures
**Then** each one's stdout, stderr, side-effect files and exit status match for the fixture's stdin or argv, environment and file-tree setup, with timestamps, durations and temp paths normalized by named normalizers listed in the test file; `pre-implement.cjs` exits non-zero in strict TDD mode exactly where BASE does; `.meowkit/.env` is read only by the jira env loader

- **Verification:** run the observer and CLI-module golden suites; confirm every assertion from the deleted `test-pre-completion-check.sh` and `test-sentinel.sh` (incl. `handlers/safety-sentinel-inject.cjs`) exists in a node suite and passes; grep observer sources for `.meowkit/.env` reads
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-08] Skill guards ported

**Given** the three live skill guards at BASE
**When** their node ports run against the AC-02 careful, freeze and investigate fixtures
**Then** every fixture matches; the `careful`, `freeze` and `investigate` SKILL.md `hooks:` blocks invoke the node ports in the AC-01 form; `investigate/bin/check-freeze.sh` no longer exists and nothing references it

- **Verification:** run the guard fixtures; read the three SKILL.md frontmatter blocks; grep for `investigate/bin/check-freeze`
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-09] Registrations collapsed; fewer processes per write

**Given** the new `settings.json` (skill-scoped guards excluded from the count)
**When** its hook registrations are parsed
**Then** the three safety entrypoints are registered directly with the BASE matchers (gate on `Edit|Write`; privacy on `Edit|Write`, `Read` and `Bash`; pre-ship on `Bash`); `ensure-skills-venv.sh` keeps its BASE registration; every other registration is `dispatch.cjs` with exactly one entry per event and matcher; at most 3 command registrations fire for one `Edit` call across PreToolUse and PostToolUse (BASE: 5); the mean hook wall time per `Edit` before and after, over at least 20 runs each, is recorded in the verdict evidence

- **Verification:** parse `settings.json`; count registrations matching `Edit`; run the timing script
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-10] Consumers follow the node tree without loosening

**Given** the consumers in Scope (In)
**When** `mewkit validate --packs`, `mewkit doctor`, `scripts/check-hook-registration.sh`, `tests/check-hook-registration.test.sh`, the full vitest suite and `node --test .claude/hooks/__tests__/*.test.cjs` run
**Then** all pass, and:
- `SAFETY_PATHS` is exactly: `statusline.cjs`, `settings.json`, `hooks/gate-enforcement.cjs`, `hooks/privacy-block.cjs`, `hooks/pre-ship.cjs` (new), `hooks/handlers/pre-completion-check.cjs`, `hooks/dispatch.cjs`, `hooks/lib/parse-stdin.cjs`, `hooks/lib/shared-state.cjs`, `hooks/handlers.json`, `hooks/lib/gate2-check.cjs` (new), `hooks/lib/approval-receipt.cjs` (new), `hooks/lib/validate-contract.cjs` (new), `hooks/lib/check-contract-signed.cjs` (new), `hooks/lib/validate-gate-2.cjs` (new), the always-on rule paths, and the three BASE `commands/mk/*.md`. Removed with reason: `hooks/lib/read-hook-input.sh` (replaced by `parse-stdin.cjs`, already listed) and `hooks/lib/load-dotenv.sh` (no longer loaded by any safety code)
- doctor probes `gate-enforcement.cjs` (the BASE Gate 1 probes), `privacy-block.cjs` (the BASE privacy probes), `pre-ship.cjs` (new: no-verdict commit → exit 2), and runs the two BASE `pre-task-check` injection probes through `dispatch.cjs PreToolUse Bash`; the Windows skip at `doctor-hard-gates.ts:49` is gone
- `git diff BASE -- packages/mewkit/src/core/check-packs.ts packages/mewkit/src/commands/doctor-hard-gates.ts` is listed in the verdict for explicit reviewer sign-off

- **Verification:** run each command; compare `SAFETY_PATHS` at HEAD to the list above entry by entry; read doctor's probe list
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-11] No bash or python left in hook paths

**Given** the finished change
**When** `find .claude \( -path '*hooks*' -o -path '*/bin/*' \) \( -name '*.sh' -o -name '*.py' \) -not -path '.claude/skills/.venv/*' -not -path '.claude/worktrees/*'` runs, and the D1 script names are grepped
**Then** the find returns only `.claude/hooks/ensure-skills-venv.sh`; the three D1 `.sh` files and `scripts/check-hook-shell-consistency.sh` no longer exist, and every reference to them in `.claude/`, `.github/`, `scripts/`, `docs/`, `packages/docs/content/`, `packages/mewkit/src/` and the bundles points at the node module or is removed; `mewkit doctor` reports a leftover `.sh` hook as a finding

- **Verification:** run the find; grep for the D1 basenames with `.sh`; plant a dummy `.sh` in a scratch install and run doctor
- **Rubric tie-in:** product-depth (weight 0.25)

### [AC-12] Codex and Cursor projections follow

**Given** the codex and cursor hook translators
**When** the migrate suite runs and fresh scratch projects are generated for both targets from the local kit
**Then** the migrate suite passes; the generated hook configs reference node entrypoints only; `validate --target codex|cursor` on the generated layouts reports no failure

- **Verification:** `vitest run packages/mewkit/src/migrate`; generate both layouts in scratch dirs; run both validators
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-13] The hook suites need no bash, and a Windows job runs them

**Given** the golden, crash-path, dispatcher and `.claude/hooks/__tests__/*.test.cjs` suites and the doctor hard-gate probes
**When** their sources and the files they execute are scanned, and `.github/workflows/ci.yml` is read
**Then** no test or executed hook spawns `bash`, `sh` or a `.sh` file (the AC-02 recording script, which runs BASE bash, is excluded and is not part of any CI suite); a new `hooks-windows` job on `windows-latest` runs those suites and `mewkit doctor`, with the hard-gate probes executing rather than skipping; the job's first CI result is recorded in the verdict when the branch is pushed

- **Verification:** grep the suites and hook sources for `bash`, `'sh'`, `.sh`; read the CI job
- **Rubric tie-in:** functionality (weight 0.40)

### [AC-14] Docs and agents describe the node runtime

**Given** `HOOKS_INDEX.md`, `.claude/agents/`, the hook and gate docs in `docs/` and `packages/docs/content/`, and the careful, freeze, investigate, sprint-contract and cook skill bodies
**When** they are grepped for `.sh` hook paths and the D1 script names
**Then** no page or agent names a deleted `.sh` hook or D1 script as current, and every invocation (including `developer.md` and `reviewer.md` for `pre-implement`) runs the node module; `HOOKS_INDEX.md` lists every safety entrypoint, observer and CLI module with its event, matcher and `toggleKey` where applicable; changelog history is not rewritten

- **Verification:** grep the named surfaces; read `HOOKS_INDEX.md`
- **Rubric tie-in:** ux-usability (weight 0.20)

### [AC-15] Code quality over the sprint diff

**Given** `git diff BASE` at the end of the sprint
**When** every new or changed `.cjs`, `.js`, `.mjs`, `.ts`, `.py` and `.sh` file is measured (`.github/workflows/*.yml` exempt from the line rule)
**Then** no new file exceeds 200 lines, no changed file grows past 200 lines because of this sprint, no changed TypeScript adds `any`, no new TODO/FIXME, no commented-out code blocks, no unused imports, no hardcoded secrets; `pnpm lint` and `pnpm typecheck` report 0 errors

- **Verification:** `git diff --stat BASE`; `wc -l` new files; grep added lines; lint and typecheck output
- **Rubric tie-in:** code-quality (weight 0.15)

## Out-of-Scope Clarifications

- Do not change any gate, privacy, pre-ship, post-write or pre-completion-check decision beyond D2; if bash and node outputs cannot be made identical, stop and ask rather than relax a fixture
- Do not add a toggle, environment variable or config key that disables a safety entrypoint; the AC-04 allowlist is closed
- Do not touch `ensure-skills-venv.sh` beyond keeping its registration working
- While the port is in progress, the live `settings.json` keeps the BASE bash registrations until AC-03 and AC-04 pass, so this repository's own gates never run unported code
- Do not edit the plan directory beyond phase-02 checkboxes, status and a decisions note

## Rubric Bindings

- functionality: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-10, AC-12, AC-13
- product-depth: AC-09, AC-11
- code-quality: AC-15
- ux-usability: AC-14

## Negotiation Log

- Round 1 (proposer/generator): initial draft from phase-02 spec + cli-tool preset + user decision D1; post-write's exit-2 feedback kept through the dispatcher (AC-06) because BASE `post-write.sh:158-159` exits 2 and BASE `dispatch.cjs` always exits 0
- Round 1 (reviewer/evaluator): AC-04 (c) and (d) contradict AC-03 and Scope (Out). I ran all three BASE entrypoints with empty stdin and with `not json at all` on stdin: `gate-enforcement.sh`, `privacy-block.sh` and `pre-ship.sh` each exit **0** and print nothing in all six runs. AC-04 demands exit 2 for those 6 of its 15 runs, while AC-03 demands exact parity with the BASE corpus and Scope (Out) says the port "adds no new rule and drops none". Phase-02 step 3 intends the hardening, so say so: carve malformed/empty stdin out of Scope (Out) as a deliberate behavior change, state that the BASE corpus records exit 0 for those cases, and exclude them from AC-03's parity set. As drafted the generator can satisfy either AC only by failing the other
- Round 1 (reviewer/evaluator): AC-04 second clause is not binary. (e) "a lib function patched in the copy to throw" IS testable without a shipped backdoor — the patch lives in the AC's own scratch copy, same technique as (a) — so that part stands. But "no test-only environment variable, flag or file in the shipped hooks can disable or bypass an entrypoint", verified by "grep the three entrypoints and their libs for `process.env.` reads and confirm none skips the check", is an impression. BASE already gates real behavior on env: `pre-ship.sh` profile-gates its build/lint/test block, `pre-completion-check.sh:23` honours `MEOWKIT_PRECOMPLETION=off`, `pre-implement.sh` reads `MEOWKIT_TDD`. Pin the allowlist: name every env var each node safety entrypoint may read at HEAD and what each may change, so the verdict is a diff against a list rather than my judgement of "skips the check"
- Round 1 (reviewer/evaluator): `pre-implement` and `append-trace` are in the 14-observer list but are not observers and cannot be dispatcher entries. Neither is registered in BASE `settings.json` (I enumerated all 12 registered observers). `pre-implement.sh` is argument-driven, invoked manually by the developer agent (`.claude/agents/developer.md:29` — `sh .claude/hooks/pre-implement.sh "<feature-name>"`) and its header documents it as fail-**CLOSED** in strict TDD mode; `append-trace.sh` takes `<event-type> '<json>'` and is called by `post-session.sh:182,198` and `learning-observer.sh`. AC-06 requires every registry entry to carry an event and a matcher — neither can supply one — and AC-07 requires their fixtures to run "through the dispatcher", which is unsatisfiable. Split both out of the 14 into their own AC as CLI-invoked modules with argv fixtures, and pin that `pre-implement.cjs` stays fail-closed in strict mode so the dispatcher's fail-open contract never reaches it. Also add `.claude/agents/` to AC-14's grep surface: it is the only live caller of `pre-implement.sh` (`developer.md:23,29`, `reviewer.md:24`) and AC-14 currently scans only `HOOKS_INDEX.md`, `docs/`, `packages/docs/content/` and five skill bodies, so the invocation breaks silently after the delete
- Round 1 (reviewer/evaluator): `pre-completion-check` is a blocking hook routed through a fail-open dispatcher, and no AC covers it. It blocks via a JSON decision, not exit 2 — `pre-completion-check.sh:136` emits `{"decision":"block","reason":"Security verdict ... blocks active plan ..."}` on stdout at Stop and then exits 0. The contract files it among the 14 observers; AC-06 makes the dispatcher exit 0 and swallow any handler that throws or fails to load, preserving only post-write's exit 2. So a security-verdict BLOCK silently degrades to advisory on any handler fault. It is also entry 5 of BASE `SAFETY_PATHS` (`packages/mewkit/src/core/check-packs.ts:31`) while not being one of "the three safety entrypoints". Decide explicitly: add its block decision to AC-06's preserved-feedback set alongside post-write, or record in Scope (Out) that Stop-blocking becomes fail-open. Leaving it implicit means the port drops an enforcement surface that Scope (Out) promises it will not
- Round 1 (reviewer/evaluator): AC-10's SAFETY_PATHS oracle is self-contradictory against the real list. BASE `check-packs.ts:26-43` is `statusline.cjs`, `settings.json`, `hooks/gate-enforcement.sh`, `hooks/privacy-block.sh`, `hooks/pre-completion-check.sh`, `hooks/lib/read-hook-input.sh`, `hooks/lib/load-dotenv.sh`, `hooks/dispatch.cjs`, `hooks/lib/parse-stdin.cjs`, `hooks/lib/shared-state.cjs`, `hooks/handlers.json`, `...ALWAYS_ON_RULE_PATHS`, 3 `commands/mk/*.md`. "Same number of entries, each `.sh` renamed to its `.cjs` port, nothing removed" breaks three ways: `lib/read-hook-input.sh` ports to `lib/parse-stdin.cjs`, which is **already entry 9** (a 1:1 rename produces a duplicate, and a dedup breaks the count rule); `lib/load-dotenv.sh` is narrowed by Scope (In) to the jira observer, so its port is an integration lib, not a safety path; `pre-completion-check.sh` becomes a dispatcher handler, not a top-level entrypoint. And `hooks/pre-ship.sh` is **not in BASE SAFETY_PATHS at all**, so "the three safety entrypoints" does not map onto this list. Replace the count rule with the target list written out entry by entry
- Round 1 (reviewer/evaluator): AC-10's doctor clause misstates what doctor probes at BASE. `packages/mewkit/src/commands/doctor-hard-gates.ts` probes `gate-enforcement.sh` (:74,:77), `privacy-block.sh` (:135,:137) and `pre-task-check.sh` (:149,:151,:172,:174) — **not** `pre-ship.sh`. "Doctor probes each of the three safety entrypoints individually" therefore adds a pre-ship probe (fine, but say it is an addition) and leaves the two `pre-task-check` injection probes with no target, since the contract demotes `pre-task-check` to a dispatcher handler that has no individual command path. State the target probe set and the fate of the injection probes
- Round 1 (reviewer/evaluator): MISSING-AC — nothing lifts doctor's Windows skip, which is the single thing this port exists for. `doctor-hard-gates.ts:49` returns `{name:"Hard gates", status:"warn", detail:"Skipped on Windows — POSIX shell hooks cannot be probed here."}`. AC-10 only requires the probes to "pass", and a warn-skip is not a failure, so AC-10 passes on Windows while probing nothing; AC-13's windows job runs only the golden, crash-path and dispatcher suites. Note also that a `windows-latest` job already exists (`.github/workflows/ci.yml:310` `codex-windows`), so AC-13's "CI defines a windows-latest job" needs to say whether it extends that job or adds one. Assert that the hard-gate probes actually execute on `windows-latest` and that the skip branch is gone, or "runs on Windows without Git Bash" is never verified end to end
- Round 1 (reviewer/evaluator): AC-11's find is unsatisfiable as written. I ran the exact command at BASE: it returns 39 paths, and beyond the 18 top-level hooks, 9 `lib/*.sh` and 4 guards it also returns `.claude/hooks/__tests__/test-pre-completion-check.sh`, `.claude/hooks/__tests__/test-sentinel.sh`, and six vendored Python files matched by `-path '*hooks*'`: `.claude/skills/.venv/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/{_impl,__init__,_compat}.py`, `.../pyproject_hooks/_in_process/{_in_process,__init__}.py` and `.../requests/hooks.py`. So "the find returns only `.claude/hooks/ensure-skills-venv.sh`" can be reached only by deleting venv contents that Scope (Out) assigns to phase 05. The phase-02 success criterion carries the same bug; fix it here by adding `-not -path '.claude/skills/.venv/*'`. Separately, rule on the two `__tests__/*.sh` scripts: Scope (In) "delete every `.sh` under `.claude/hooks/`" sweeps them, no CI step references them, and no AC mentions them
- Round 1 (reviewer/evaluator): `scripts/check-hook-shell-consistency.sh` is an oracle that passes by losing its subject — the same defect I flagged on sprint-2 AC-03. Its header (:1-20) states its whole purpose: "fails if a hook is registered in `.claude/settings.json` with a shell interpreter that cannot run the constructs the script (or a library it sources) relies on … Hooks invoked with `bash` are exempt." After this sprint the only `sh`/`bash`-invoked hook left is `ensure-skills-venv.sh`, so AC-10's "it passes" is satisfied by a check with nothing to scan, and its CI step becomes a green no-op. Decide in the AC: delete the script together with its CI step, or repoint it at the one surviving bash hook — and say which
- Round 1 (reviewer/evaluator): the four existing hook behavior tests sit outside every AC's test net. `.claude/hooks/__tests__/{advisory-boundary,gate2-ship-boundary,post-write-security,pre-ship-memory-lint}.test.cjs` are **excluded from vitest by design** — `vitest.config.ts` says "`*.test.cjs` under `.claude/` are node-native `assert` tests (run via `node`/`node --test` in CI), NOT vitest suites" — and run in CI as `node --test .claude/hooks/__tests__/*.test.cjs` (`ci.yml:244`). They are the only existing behavioral tests of post-write, the pre-ship memory lint, the Gate 2 ship boundary and the advisory/exit-1 boundary, all of which this sprint rewrites, and `gate2-ship-boundary.test.cjs:48` `copyIn`s `validate-gate-2.sh`, which D1 deletes. AC-10 says "the full vitest suite" and AC-13 reads `ci.yml` only for the windows job, so none of the four is required to be updated or green. Name all four and their runner explicitly — sprint-2's wrong-test-path defect inverted: right files, wrong runner
- Round 1 (reviewer/evaluator): AC-02's corpus omits three of `pre-ship`'s four block paths, including the highest-risk one in D1's scope. `pre-ship.sh` exits 2 at :38 (gate2-check returns non-zero), :54 (**gate2-check script absent → `@@GATE_BLOCK@@`**, "A ship with no enforceable Gate 2 is blocked, not waved through"), :99 (team-memory store lint) and :220 (`FAIL_COUNT > 0`). AC-02's "covering at least" list has only the Gate 2 decision cases. The :54 path is exactly what D1 perturbs — once `gate2-check` and `validate-gate-2` are required node modules, "checker missing" becomes a `require` failure, and it must land on exit 2 rather than a caught-and-continued branch. Add fixtures for all four, plus the second caller `lib/gate2-check.sh:206` (security-verdict path) and the observer caller `pre-completion-check.sh:134`, and state whether the observer requires the D1 node module or keeps spawning a shell (D1's "no safety entrypoint spawns bash" does not reach it)
- Round 1 (reviewer/evaluator): AC-01 probes the wrong variable for the SKILL.md half, and AC-08's fourth guard is broken at BASE. The three guard registrations use `${CLAUDE_SKILL_DIR}`, not `$CLAUDE_PROJECT_DIR` (`careful/SKILL.md:19`, `freeze/SKILL.md:19,24`, `investigate/SKILL.md:27`); AC-01 establishes only whether `$CLAUDE_PROJECT_DIR` resolves in the `args` form and then applies "that one form" to the SKILL.md files too — a guard registered in a form that never resolves fails open. Probe `${CLAUDE_SKILL_DIR}` in the args form as well and record both results. And `.claude/skills/investigate/bin/check-freeze.sh` is a 6-line passthrough that `exec`s `../../mk:freeze/bin/check-freeze.sh`; that directory does not exist (`ls .claude/skills/mk:freeze` → No such file), I ran it and it exits **126** with "cannot execute: No such file or directory", and nothing registers it (`investigate/SKILL.md:22-28` registers only `check-report-path.sh`). AC-08 counts four guards and asserts "every fixture matches" while AC-02's corpus has only three guard families, so the fourth is never tested and a faithful port would reproduce a 126. Decide: delete it as dead code and record that in Scope, or fix the path and add a fixture
- Round 1 (reviewer/evaluator): AC-01 is misbound and AC-09's process count is not binary. AC-01 decides whether a hook process launches at all, which is the functionality rubric's own subject per the cli-tool preset ("exit codes, argument parsing, output format must work"; "functionality FAIL is most common (binary doesn't run …)") — not product-depth; same misbinding class as sprint-1 AC-07 and sprint-2 AC-09/AC-14. Move it to functionality; product-depth then rests on AC-09 and AC-11, where migration completeness and the per-call process budget actually belong. On AC-09, "at most 3 command registrations fire for one `Edit` call … (BASE: 5)" is correct for `settings.json` alone — I verified PreToolUse `Edit|Write` = gate-enforcement + privacy-block and PostToolUse `Edit|Write` = post-write + learning-observer + dispatch — but `freeze/SKILL.md:16-25` registers `check-freeze.sh` on both `Edit` and `Write`, so with `mk:freeze` active the real BASE count is 6 and the target 4. Say the count is over `settings.json` only, with skill-scoped guards excluded
- Round 1 (reviewer/evaluator): AC-06 names a registry artifact that does not exist yet, and its "every entry" rule is already false at BASE. No AC says what the registry file is; BASE uses `.claude/hooks/handlers.json`, which is also entry 11 of `SAFETY_PATHS`, so AC-10's "nothing removed" keeps it even if the registry moves to `.cjs`. Its `Stop`, `SessionStart` and `UserPromptSubmit` entries carry **no matcher**, so "every registry entry has an event, a matcher, a `toggleKey` and a handler path" cannot hold for non-tool events. The 9 existing `.cjs` handlers (`auto-checkpoint`, `budget-tracker`, `build-verify`, `checkpoint-writer`, `loop-detection`, `model-detector`, `orientation-ritual`, `review-evidence-tag`, `safety-sentinel-inject`) are observers too and appear nowhere in the contract. Name the registry file, say whether those 9 join it and receive `toggleKey`s, make the matcher requirement conditional on tool-scoped events, and define "safety handler" (the three entrypoints only?) so "no safety handler appears in the registry" is checkable while `post-write` and `pre-completion-check` both sit in it
- Round 1 (reviewer/evaluator): AC-15 drops `.sh` from the measured set though Scope (In) changes `scripts/check-hook-registration.sh`, `scripts/check-hook-shell-consistency.sh` and `tests/check-hook-registration.test.sh`; sprint-2's AC-15 measured `.ts/.cjs/.mjs/.py/.sh`. Restore `.sh` and state whether `.github/workflows/ci.yml` is exempt from the 200-line rule
- Round 1 (reviewer/evaluator): verified-clean items, recorded so Round 2 does not relitigate them — BASE `b8556870d9f9f65ff82ececec44f9d2a751b2e37` resolves and is HEAD of `feat/v3-lean-runtime`; the 14-name observer list equals the 18 top-level `.sh` hooks minus the 3 safety entrypoints and `ensure-skills-venv.sh`, matching phase-02's "Create" list exactly; AC-09's BASE matchers are right (gate on `Edit|Write`; privacy on `Edit|Write`, `Read`, `Bash`; pre-ship on `Bash`); post-write's exit 2 is characterized correctly (`post-write.sh:158-160` — findings to stderr, exit 2 only when `HAS_BLOCK=1`, with the PostToolUse rationale in the comment at :150-155); every consumer path named in Scope (In) and AC-10 exists, including `packages/mewkit/src/core/check-packs.ts`, `packages/mewkit/src/commands/doctor-hard-gates.ts`, `packages/mewkit/src/core/{hook-runner,build-hooks-inventory}.ts` and the three D1 scripts; the blocking set at BASE is `gate-enforcement`, `privacy-block`, `pre-ship`, `lib/gate2-check` (exit 2) plus `post-write` (exit 2) and `pre-completion-check` (JSON block) — `pre-task-check.sh` tops out at exit 1, which its own ADVISORY contract makes non-blocking, so excluding it from the safety set is correct; all four cli-tool rubrics are bound
- Round 1 (reviewer/evaluator): two items need a user decision, not a generator revision, because both change what a gate decides — (1) whether empty/malformed stdin becomes a hard block (AC-04 c/d vs AC-03 and Scope (Out)); (2) whether `pre-completion-check`'s Stop-block survives as preserved dispatcher feedback or goes fail-open. Everything else above is a generator `amend`
- Round 2 (proposer/generator): all Round 1 items resolved. User decisions recorded as D2 (empty/non-JSON stdin becomes exit 2; the six BASE exit-0 cases are excluded from AC-03 parity and asserted by AC-04; valid JSON without a target still allows) and D3 (dispatcher passes post-write exit 2/stderr and pre-completion-check block JSON through; handler crash stays fail-open). AC-04 now pins a closed env allowlist per entrypoint and drops `.meowkit/.env` from safety code. `pre-implement`/`append-trace` split out as CLI modules (AC-07), `pre-implement` fail-closed in strict TDD; `.claude/agents/` added to AC-14. Definitions section names the registry (`handlers.json`), safety entrypoint, observer, feedback handler and CLI module; the 9 BASE `.cjs` handlers join with `toggleKey`s, matcher only for tool-scoped events (AC-06). AC-10 writes SAFETY_PATHS entry by entry (adds pre-ship and the gate libs, removes read-hook-input/load-dotenv with reasons), states the doctor probe set (pre-ship probe is new, pre-task-check probes run via `dispatch.cjs PreToolUse Bash`) and removes the Windows skip. AC-13 adds a new `hooks-windows` job that runs doctor; `codex-windows` untouched. AC-11 find excludes `.venv` and worktrees; the two `__tests__/*.sh` are ported to node and deleted; `check-hook-shell-consistency.sh` and its CI step are deleted. The four `*.test.cjs` and their `node --test` runner are named in Scope and AC-10. AC-02 adds pre-ship :38/:54/:99/:220, gate2-check :206 and pre-completion-check block fixtures; pre-completion-check requires the D1 node module (D1). AC-01 probes `${CLAUDE_SKILL_DIR}` too and moves to functionality. `investigate/bin/check-freeze.sh` deleted as dead code (AC-08). AC-09 count is over settings.json only. AC-15 measures `.sh`; ci.yml exempt from the line rule

- Round 2 (reviewer/evaluator): NOT accepted on one count — AC-05's `child_process` clause is now unsatisfiable against AC-02/AC-03/AC-04. "`child_process` is used only to run `git`" holds for `gate-enforcement` and `privacy-block` but not for `pre-ship.cjs`, and the Round 2 amendment is what broke it: AC-02 now requires parity fixtures for `pre-ship.sh:99` and `:220`, and both paths spawn non-git children. The memory lint runs the resolved mewkit CLI (`pre-ship.sh:80-89`, `"$MEMORY_CLI" validate --memory` — the same binary whose path AC-04 pins as `MEOWKIT_CLI`, an env var that exists only to spawn a non-git process), the `:220` block runs `run_check` over the project's test/lint commands plus `pytest`, `ruff`, `flake8` (`:195-205`) and `command -v` probes, and the required lib `lib/gate2-check.sh` spawns `node` for the evidence validator (`:258`) and the review-coverage validator (`:273`). As written the generator passes AC-05 only by dropping the `:99`/`:220` fixtures, or passes AC-02/AC-03 only by failing AC-05. The resolution is forced rather than a choice — Scope (Out) forbids changing what pre-ship decides, so the spawns must stay — so replace the clause with an enumerated allowlist (`git`; the resolved mewkit CLI; `node` for the two in-repo validators; the project's configured build/lint/test commands) and keep the real intent as "no `child_process` call site targets `bash`, `sh` or a `.sh` file" (AC-13's subject) plus the unchanged network-module ban. Substantive: it changes what AC-05 asserts, so it must be amended at sign time, but it needs no user decision because no alternative resolution is open
- Round 2 (reviewer/evaluator): five trivial items the generator can apply at sign time without changing what any AC tests — (1) Scope (Out) still excepts only D2, but AC-04 (a)/(b)/(e) also change a decision: at BASE `gate-enforcement.sh:28-33` sources `read-hook-input.sh` only `if [ -f ... ]`, so a deleted lib falls through to `${HOOK_FILE_PATH:-$1}` and exits 0 (allow) where the node port exits 2; add "and the AC-04 crash-path hardening" to the exception, which conflicts with no fixture since the corpus records no crash case; (2) AC-04's list silently drops two live BASE reads — `MEOWKIT_HOOK_PROFILE`/`MEOW_HOOK_PROFILE` at `gate-enforcement.sh:22` and `privacy-block.sh:25`; both are dead assignments (`MEOW_PROFILE` is never read again in either file), so dropping them preserves behavior, but a faithful port reproduces them and then fails AC-04's own grep — say "deliberately dropped: dead assignments at BASE"; (3) AC-07 compares only "stdout, side-effect files and exit status" and defines no fixture schema, yet requires `pre-implement.cjs` to behave "in strict TDD mode", which is `MEOWKIT_TDD`-driven via `lib/tdd-detect.sh` (`pre-implement.sh:29,39`) — add stderr and environment, as AC-02 already has for the safety corpus; (4) Scope (In) deletes `__tests__/{test-pre-completion-check,test-sentinel}.sh` with their assertions "moved into node tests" but no AC asserts the move landed, and `test-sentinel.sh`'s subject (`handlers/safety-sentinel-inject.cjs`, one of the 9 kept `.cjs` handlers) has no fixture requirement anywhere, so that coverage can vanish with nothing failing — require both sets of assertions present and green in the node suites; (5) AC-11's reference-sweep surfaces omit `packages/mewkit/src/`, which hard-codes a path this sprint deletes at `packages/mewkit/src/core/provider-lifecycle.ts:79` (`proof: ".claude/hooks/__tests__/test-pre-completion-check.sh"`, `readFileSync`'d by `core/__tests__/provider-lifecycle.test.ts:124-139`, which throws if absent) — AC-10's "full vitest suite passes" already forces the fix, so coverage is intact, but the file belongs in Scope (In) and the directory in AC-11's grep list
- Round 2 (reviewer/evaluator): one trivial rebinding — AC-13 is bound to ux-usability, whose hard-fail threshold in the cli-tool preset is WARN, so "no suite spawns bash" and "the `hooks-windows` job runs them with the hard-gate probes executing" can never produce a FAIL. The load-bearing half of the Round 1 Windows-skip item did land under a FAIL threshold (AC-10, functionality, "the Windows skip at `doctor-hard-gates.ts:49` is gone"), so the hole is narrow, but whether the suites run at all on `windows-latest` is functionality's own subject — the same misbinding class as AC-01. Move AC-13 to functionality and leave AC-14 holding ux-usability. This changes grading severity, not what AC-13 tests
- Round 2 (reviewer/evaluator): verified clean, recorded so none of it is relitigated — D2's six cases confirmed again at BASE (all three entrypoints exit 0, print nothing) and now consistently carved: AC-02 records exit 0, AC-03 excludes them, AC-04 (c)/(d) asserts exit 2. AC-04's allowlist is otherwise exactly right and complete: `MEOWKIT_AUTOBUILD_MODE` is not read by `gate-enforcement.sh` (only the comment at `:11`) but by its D1 lib `check-contract-signed.sh:20-25` (LEAN/MINIMAL → exit 0 plus `.meowkit/telemetry/lean-bypass.log`), which AC-04's "and its libs" wording covers; `MEOWKIT_GATE1_PRESENCE_ONLY` announces on stderr (`:147`); pre-ship's profile gate sits at `:105`, after the Gate 2 check (`:38`) and the memory lint (`:77-101`), so "build/lint/test block only, never the Gate 2 check" is accurate; `MEOWKIT_CLI` at `:80`; `validate-contract.sh` and `validate-gate-2.sh` read no environment at all and `gate2-check.sh` reads only `CLAUDE_PROJECT_DIR` plus the stdin-derived command. `MEOWKIT_TDD` is read only by `project-context-loader`, `tdd-flag-detector`, `pre-implement` and `lib/tdd-detect.sh`, never on the safety path, so its absence is correct. `HOOK_FILE_PATH`/`HOOK_COMMAND`/`HOOK_TOOL_NAME` are correctly omitted: `read-hook-input.sh:56-60` unconditionally exports them to "" before `${HOOK_FILE_PATH:-$1}` reads them, so an ambient value cannot reach a gate while the lib is present, and the live fallback is argv, which AC-02's "stdin or argv" schema already covers. AC-11's find now returns 33 in-scope paths at BASE (18 top-level hooks, 9 `lib/*.sh`, 4 guards, 2 `__tests__/*.sh`), every one in the delete sweep except `ensure-skills-venv.sh`, with no `.py` left in scope — the 39-path defect is fixed. AC-10's SAFETY_PATHS target list matches BASE `check-packs.ts:26-43` entry by entry with two justified removals and five additions; `doctor-hard-gates.ts:49` and `ci.yml:310` are exactly as cited. All 15 ACs are bound exactly once, the Rubric Bindings block matches every per-AC tie-in line, and the four weights (0.40/0.25/0.15/0.20) match `load-rubric.sh --preset cli-tool`
- Round 2 (reviewer/evaluator): disposition at the hard cap — no third round. One substantive amendment required before signing (AC-05's `child_process` clause) and six trivial fixes listed above; none needs a user decision, since every remaining item has exactly one resolution consistent with Scope (Out). If the generator applies all seven at sign time, this contract is accepted; if it declines the AC-05 amendment, that is a user escalation, because keeping "only `git`" means deleting AC-02's `pre-ship.sh:99` and `:220` fixtures and giving up parity on two of pre-ship's four block paths
- Round 2 (proposer/generator, sign-time fixes): applied all seven Round 2 reviewer items — AC-05 child_process clause replaced by the enumerated allowlist (git, resolved mewkit CLI, node on the two in-repo Gate 2 validators, project build/lint/test + pytest/ruff/flake8) with no bash/sh/.sh target and the network-module ban unchanged; Scope (Out) excepts the AC-04 crash-path hardening; AC-04 records the dead profile reads as deliberately dropped; AC-07 compares stderr and fixes stdin/argv, env and file-tree per fixture, and its verification requires the ported `test-pre-completion-check`/`test-sentinel` assertions present and green; `provider-lifecycle.ts:79` added to Scope (In) and `packages/mewkit/src/` to AC-11's sweep; AC-13 rebound to functionality
- Round 2 (reviewer/evaluator): accepted — sign-time fixes verified

## Amendments (if any)

### Amendment 1 — 261108-0010

Trigger: Batch A recorded the AC-02 corpus from BASE (82 fixtures, byte-reproducible; evidence in
`tasks/reviews/evidence/261107-meowkit-v3-lean-runtime-sprint-3/`) and found two places where the contract misdescribed
BASE. Both were put to the user, who decided (261108):

- **D4 — Bash reading `.env` stays allowed (BASE parity).** At BASE `privacy-block.sh:35` checks the sensitive-path
  pattern only against `tool_input.file_path`, which a `Bash` payload lacks, so `cat .env` exits 0. Override for AC-02:
  the privacy bullet "a Bash command reading `.env` → block" reads "a Bash command reading `.env` → allow (BASE)", and
  that fixture (`privacy-bash-reads-dotenv`) is part of AC-03's parity set. Hardening Bash `.env` reads is out of scope.
- **D5 — the skill guards are enabled.** At BASE the `careful`, `freeze` and `investigate` SKILL.md `hooks:` blocks run
  `bash ${CLAUDE_SKILL_DIR}/bin/...` in shell form; `${CLAUDE_SKILL_DIR}` is not substituted in `hooks:` (cited docs plus
  a live probe, `ac-01-exec-form.md`), so the path is empty and the guards never fire. Override for AC-01 and AC-08: the
  guard registrations use exec form with `${CLAUDE_PROJECT_DIR}/.claude/skills/<skill>/bin/<guard>.cjs`, and the guards
  now fire. This is a deliberate behavior change added to the Scope (Out) exceptions (with D2 and the AC-04 crash-path
  hardening); the Out-of-Scope Clarifications "beyond D2" bullet is read with the same exceptions. AC-08's fixtures
  test the guard scripts directly, so they are unchanged. AC-09's count stays over `settings.json` only (5 → ≤3).
- **AC-07 method for two observers.** `post-session` (derives fields from a live transcript) and
  `project-context-loader` (emits files this sprint changes) have no deterministic BASE recording (`index.json`
  `notRecorded`). Override for AC-07: each is verified by a unit test over a pinned input (a fixture transcript; a
  fixture rule/docs tree) that asserts the same output fields BASE produces, and the test file says so.
- **AC-13 replay on Windows.** The `preship-memory-lint-failure` fixture's `MEOWKIT_CLI` stub is a shebang script; the
  replay harness builds a platform-appropriate stub from the fixture's `setup` id instead of reusing the recorded path.

Evaluator: accepted — append-only (no AC text touched; only frontmatter status/signature), and both BASE claims hold on
inspection: `privacy-block.sh:35`'s sensitive-path grep sits inside `if [ -n "$FILE_PATH" ]` while Check 2 matches only
`fetch_as_markdown.py`/`web-to-markdown` commands, so a `Bash` payload carrying `cat .env` reaches no check and exits 0,
and all three guards register `command: bash ${CLAUDE_SKILL_DIR}/bin/...` in shell form (`careful/SKILL.md:19`,
`freeze/SKILL.md:19,24`, `investigate/SKILL.md:27`). Every override is testable: D4 is already pinned by the recorded
`privacy-bash-reads-dotenv` fixture (`expect.exit 0`, empty stdout/stderr, with the finding in its `setupDescription`);
D5 is satisfiable because `ac-01-exec-form.md` probe 1 shows `${CLAUDE_PROJECT_DIR}` **does** substitute into an `args`
element of a `SKILL.md` `hooks:` block while `${CLAUDE_SKILL_DIR}` survives as a literal and is absent from the hook
environment — backed by docs and a live Claude Code v2.1.316 probe, so "the guards now fire" is checkable rather than
hopeful; the AC-07 method override matches `index.json`'s `notRecorded` reasons for exactly `post-session` and
`project-context-loader`; and the AC-13 stub fix is consistent with AC-13's own no-`bash`/`sh`/`.sh` rule. Corpus
cross-checks: `index.json` records `base` = BASE, `fixtureCount` 82 and 22 groups spanning every AC-02 family. Two
consequences are accepted as user decisions, not defects, and belong in the Gate 2 verdict: D5 turns three inert
registrations live (notably `freeze` on `Edit`/`Write`), and D4 leaves a `Bash`-mediated `.env` read allowed, so the
privacy gate's file-path-only coverage is now a documented BASE limitation rather than an implied guarantee — a
follow-up phase item, out of scope here.

### Amendment 2 — 261108-0500

Trigger: Batches B–D ported the tree and replayed all 82 fixtures. Five places where two signed criteria could not both
hold, or where the cutover changed fixture setup, are recorded here. None changes what a gate decides.

- **`selfPath` normalizer (AC-03).** Five recorded lines quote the implementation file they belong to; the port
  renames that file, and AC-11 forbids printing a deleted `.sh` path. AC-03 allows one further named normalizer,
  `selfPath` (`/([\w./-]+)\.cjs\b/g` → `$1.sh`), applied only to: `gate1-contract-edit-invalid`,
  `preship-gate2-checker-absent`, `validate-contract-usage-error`, `preimplement-no-feature-argument`,
  `preimplement-strict-tdd-helper-missing`. The pattern is unanchored because two of those fixtures quote a bare
  basename (`pre-implement.cjs`, `tdd-detect.cjs`) rather than a `.claude/`-prefixed path; within these five fixtures
  every token it rewrites is a kit module's own path. Every other fixture is compared with `tmpdir` alone.
- **Advisory exit through the dispatcher (AC-06 vs AC-07).** `pre-task-check`'s injection finding exited 1 at BASE, a
  documented advisory exit that never blocked. Through the dispatcher it exits 0 (AC-06 fail-open wins); the finding text
  is still compared whole. Applies to `pretaskcheck-injection-blocked`, `injection-block.integration.test.ts` and the
  doctor injection probes, which assert the finding text instead of the exit code.
- **`PostToolUseFailure` has no matcher (AC-06).** It is registered without one at BASE; the registry requires `matcher`
  for `PreToolUse` and `PostToolUse` only.
- **Contract step inside the probe sandbox (AC-10).** The contract validator now lives in the hook library the doctor and
  fixture sandboxes copy, so those sandboxes supply a signed contract to reach "allow". BASE reported this step as not
  verified; the node tree verifies it.
- **AC-15 exception.** `.claude/hooks/__tests__/gate2-ship-boundary.test.cjs` was 420 lines at BASE and is 429 after
  retargeting; its split is a recorded follow-up rather than a change to a safety test inside this sprint.
- **AC-12 method.** The codex and cursor layouts are generated in a scratch dir by calling the bundle reconcile functions
  from the built package (no `init` against this repository), then validated with `validate --target`.
- Known parity carry-over, not a defect: the LEAN bypass log names `LEAN` for a `MINIMAL` bypass, as at BASE.

Evaluator: accepted — append-only (only frontmatter and, in the correction commit, the `selfPath` bullet), and every item
now matches the working tree. `selfPath` reads `/([\w./-]+)\.cjs\b/g` → `$1.sh`, identical to
`tests/hooks/lib/replay-harness.ts:129`, and the unanchored form is necessary rather than convenient: two of the five
fixtures quote a bare basename, `pre-implement.cjs` (`pre-implement.cjs:89`) and `tdd-detect.cjs` (`:32`), which a
`.claude/`-anchored pattern cannot reach — the first draft's pattern would have failed those two. Scoping is exact
(`golden-replay.test.ts:64-70` names those five and `assertParity:85-87` applies the normalizer only to them; every `.sh`
token in their recorded output — 10 across the five — is a kit module's own path, so nothing broader is laundered);
`-t 'preimplement'` replays 5 passed. The other items verify too: `pretaskcheck-injection-blocked` is the only entry in
`ADVISORY_EXIT_FIXTURES` and BASE's exit 1 was already non-blocking by `pre-task-check`'s own advisory contract, so
fail-open changes no block decision, with `doctor-hard-gates.ts:153-167` asserting the finding text and probe 7 still
asserting exit 0; BASE `settings.json` registers `PostToolUseFailure` with no `matcher` key, matching
`handler-registry.cjs:35-38`, which requires one for `PreToolUse`/`PostToolUse` only; Probe 3 (`doctor-hard-gates.ts:107-130`)
supplies receipt **and** signed contract, which makes doctor stricter rather than moving a decision; the test file is 420
lines at BASE and 429 now, exactly the +9 claimed; and AC-12's method is `reconcileApplyCursorBundle` called directly over
the authored bundle into a scratch target (`cursor-full-surface-cli-dry-run.test.ts:5-28`), no `init` against this
repository. The LEAN-for-MINIMAL log line reproduces at BASE (`check-contract-signed.sh:20-25` fires on either mode but
logs the `LEAN` literal), so recording it as parity carry-over is right. No item changes what a gate decides. Carried to
the Gate 2 verdict as follow-ups, not blockers: the 429-line safety test's split, and the `selfPath` normalizer as a
standing audit item whenever a fixture is added.

### Amendment 3 — 261108-0700

Trigger: the Gate 2 review asked whether the enabled skill guards actually enforce. The Claude Code hooks reference
states that a PreToolUse decision is read from a `hookSpecificOutput` object (`permissionDecision`,
`permissionDecisionReason`) and that top-level decision fields are deprecated for this event. At BASE the guards printed
a top-level `permissionDecision` with a `message` field, which the host does not read, so even once registered they
would report no decision. Enabling them (Amendment 1, D5) requires the documented envelope.

- **Guard envelope (AC-03, AC-08).** `careful`, `freeze` and `investigate` emit
  `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask|deny","permissionDecisionReason":"..."}}`.
  Each guard's decision (`ask`/`deny`/allow), its reason text and its exit code are unchanged from BASE (`investigate`
  keeps exit 2 and also writes the reason to stderr). The fixtures in groups `guard-careful`, `guard-freeze` and
  `guard-investigate` are compared by exit code, decision and reason rather than by literal stdout; every other fixture
  keeps its existing comparison.
- **Provider bundles.** The codex and cursor bundles ship self-contained node guards in place of their shell guards, each
  emitting its own host's decision shape (codex `hookSpecificOutput`, cursor `permission`/`user_message`).

# Batch D — cutover: settings collapsed, shell tree deleted, consumers rewritten

Sprint 3, `meowkit-v3-lean-runtime`. Recorded 2026-11-08.
BASE = `b8556870d9f9f65ff82ececec44f9d2a751b2e37`. Amendments 1 and the four Batch-C items applied.

## Cutover order, and why

The live hooks in this session run this repository's own `.claude/settings.json`, so switching it over put my own
code in front of every subsequent edit. The order was chosen to make a bad switch visible before it could block the
work:

1. **Dry-run first.** Each node guard was run by hand against this repo with the payloads this batch would generate —
   every path it edits, every Bash command it runs. All three allowed what the shell ones allowed.
2. **Switch `settings.json`.** The next Bash call went through `pre-ship.cjs`, `privacy-block.cjs` and the Bash
   observer chain; a throwaway `Write` then exercised `gate-enforcement.cjs`, `privacy-block.cjs` and the
   `PostToolUse` chain, which reported the same findings the shell scanner did.
3. **Only then delete the shell tree**, so nothing was removed while still registered.

No gate misbehaved, so no revert was needed. Two live confirmations are worth recording: when I wrote a test fixture
containing a token-shaped literal, the ported write scanner blocked it through the new dispatcher with the same text
the shell one produced; and `@@GATE_BLOCK@@`/`@@PRIVACY_BLOCK@@` never fired on a legitimate edit.

## 1. `settings.json` collapsed

Every registration is exec form — the executable in `command`, the script path as one `args` element, so nothing needs
a shell to start. Matchers are unchanged from BASE.

| Event | Matcher | Registrations |
| --- | --- | --- |
| SessionStart | — | `ensure-skills-venv.sh` (unchanged), `dispatch.cjs SessionStart` |
| PreToolUse | `Edit\|Write` | `gate-enforcement.cjs`, `privacy-block.cjs` |
| PreToolUse | `Read` | `privacy-block.cjs` |
| PreToolUse | `Bash` | `pre-ship.cjs`, `privacy-block.cjs`, `dispatch.cjs PreToolUse Bash` |
| PostToolUse | `Edit\|Write` · `Bash` | `dispatch.cjs` (one per matcher) |
| Stop · UserPromptSubmit · PreCompact · PostToolUseFailure | — | `dispatch.cjs` (one per event) |

**Registrations firing for one `Edit`: 3** (gate, privacy, dispatcher) — BASE was 5. The now-obsolete
`Bash(sh .claude/hooks/*)` permission grant was dropped with the shell hooks.

## 2. Hook wall time per `Edit`

Both sides run the registrations their own `settings.json` declares, against an identically prepared project (plan
present, contract signed, target file present), so the number compares runtimes rather than workloads. 20 runs per side.

| | processes | mean | median | min | max |
| --- | --- | --- | --- | --- | --- |
| BASE (shell) | 5 | 879.3 ms | 882.1 ms | 840.7 | 905.4 |
| HEAD (node) | 3 | 812.0 ms | 813.1 ms | 778.7 | 850.1 |

**-67.3 ms mean (-8%), 5 → 3 processes.** Script: `<scratch>/measure-edit-hooks.cjs` (not committed — it reads the
pinned tree out of git and is a measurement, not a check). Honest reading: two fewer processes bought 8%, not 40%,
because node's startup is slower per process than a shell's — the win is portability and fail-closed behaviour, and the
process count is the part the contract asks for.

## 3. Shell tree deleted

35 files removed, one `rm` per file: 19 top-level hooks, 9 `lib/*.sh`, 2 `__tests__/*.sh`, 3 skill guards, the 3 gate
helper scripts, and `scripts/check-hook-shell-consistency.sh`. `ensure-skills-venv.sh` kept.

```
$ find .claude \( -path '*hooks*' -o -path '*/bin/*' \) \( -name '*.sh' -o -name '*.py' \) \
    -not -path '.claude/skills/.venv/*' -not -path '.claude/worktrees/*'
.claude/hooks/ensure-skills-venv.sh
```

`.claude/worktrees/` is a sibling session checkout at another revision, excluded by the find and not this change's to
touch.

## 4. Consumers

| Consumer | Change |
| --- | --- |
| `core/check-packs.ts` | `SAFETY_PATHS` written out entry by entry: 5 additions (`pre-ship.cjs` and the four gate libraries), 2 removals each with its reason in the comment — `read-hook-input.sh` was replaced by `parse-stdin.cjs`, already listed, and `load-dotenv.sh` is no longer on any guard's path |
| `commands/doctor-hard-gates.ts` | Windows skip removed. Probes: Gate 1 (no plan → block, unapproved plan → block, approved **and** contract-signed → allow), privacy `.env` read → block, injection reported / clean command allowed **through `dispatch.cjs PreToolUse Bash`**, and a **new** Gate 2 probe (ship command with no verdict → exit 2). Runtime sweep and the leftover-shell-hook finding split into `commands/doctor-hook-runtime.ts` to keep both files under the line cap |
| `core/hook-runner.ts` | Reconstructs **both** registration shapes. The old `shellOnly` default would have skipped every node registration, i.e. probed nothing; it is gone, and `extraArgs` is carried so a dispatcher registration runs with its event |
| `core/build-hooks-inventory.ts` | Reads the script from `args` or `command`; a dispatcher registration is read **through to its handlers**, because the dispatcher only forwards and asking whether its own source blocks would report every observer chain as advisory |
| `core/harness-scaffold.ts` | The receipt helper is a library now, so it is loaded in a child node process instead of executed; added `stageShipCommit()` (git history + a staged source file, so a ship command has a real change set) and `addSignedContract()` |
| `core/provider-lifecycle.ts` | `proof` repointed from the deleted shell test to `tests/hooks/completion-gate.test.ts` |
| `scripts/check-hook-registration.sh` + `tests/check-hook-registration.test.sh` | Both extractors and the guard read `args` as well as `command`; the allowlist is now the two argv-driven modules; fixtures use exec form |
| `.github/workflows/ci.yml` | Shell-consistency step dropped with its script. New `hooks-windows` job on `windows-latest`: the hook vitest suites, `node --test`, and `mewkit doctor --hard-gates` with the probes **executing**. `codex-windows` untouched |
| codex / cursor translators | **No change needed, deliberately.** Their hooks are independent native ports against each provider's own hook contract, not wrappers around these shell scripts — the codex hook config already pointed at `.cjs`. `buildShWrapperScript` and `hooks-discovery` are kept because they migrate a **user's** shell hooks, which this kit no longer ships but still has to handle. The migrate suite passes unchanged (74 files, 953 tests) |

### Reference sweep

105 files rewritten across `.claude/`, `.github/`, `scripts/`, `docs/`, `packages/docs/content/`,
`packages/mewkit/src/` and `tests/`: a full path becomes the module's new full path, a `sh`/`bash` invocation becomes
`node`, a bare mention keeps its shape with the new filename. `.claude/agents/developer.md:29` now reads
`node .claude/hooks/pre-implement.cjs "<feature-name>"`; `reviewer.md` names `pre-implement.cjs`.

`HOOKS_INDEX.md` is **generated from the live `settings.json` and `handlers.json`**, so it cannot drift: it lists every
registered entrypoint, all 22 observer entries with event, matcher and `toggleKey`, and the two CLI modules, plus the
two opposite contracts and where observer output lands.

Deliberately **not** rewritten, because they name the shell scripts by design:
`packages/docs/content/docs/changelog/archive.mdx` and `project-changelog.md` (history), and `tests/hooks/golden/*.json`
(recordings of the shell behaviour).

## 5. Verification

```
npx vitest run                     246 files · 2825 passed · 0 failed · 0 todo
node --test .claude/hooks/__tests__/*.test.cjs    36 pass · 0 fail
npx vitest run tests/hooks         9 files · 175 passed
pnpm lint                          0 errors (3 pre-existing warnings, none in this change)
pnpm typecheck                     exit 0
pnpm build                         exit 0
node packages/mewkit/dist/index.js validate --packs   1 passed (Pack coherence)
node packages/mewkit/dist/index.js doctor --hard-gates   22 passed, 4 warnings, 0 failed
bash scripts/check-hook-registration.sh            OK: 7 hooks registered/allowlisted
bash tests/check-hook-registration.test.sh         5 passed, 0 failed
bash scripts/check-skill-cross-refs.sh             OK: all refs resolve
bash scripts/validate-rule-availability.sh         OK: 7 rule references resolve
node scripts/check-dangling-rule-refs.cjs          OK: no dangling references (4376 files scanned)
corpus re-record + diff -r tests/hooks/golden      IDENTICAL
AC-11 find                                         only ensure-skills-venv.sh
```

13 test files broke on the delete and were retargeted, each for a stated reason rather than a relaxed assertion:

- `src/__tests__/hooks/{approval-receipt,gate-enforcement,privacy-block,injection-block,hook-shell-runtime}` — guards
  addressed by node name; the receipt helper driven as a library; the shell-metacharacter probe retargeted to the node
  reader (its original subject, a shell parser mangling `%` and backslashes, cannot exist in a node module)
- `src/__tests__/memory/{cost-log-atomicity,no-injection,producer-consumer-characterization}` — producers now `require`
  the trace writer instead of spawning its script, and the exec-form registration is matched as separate arguments
- `state/resolve-state-dir` — the three-way TypeScript/shell/cjs agreement is two-way; the shell resolver is gone
- `core/trace-append` — the second writer on the shared sidecar lock is the node one
- `commands/doctor-hard-gates`, `commands/pack`, `migrate/hooks/hooks-discovery-classification` — probe names, and two
  cases where the sweep had wrongly renamed synthetic fixtures whose subject is pack arithmetic or shell-hook migration

Two sweep over-reaches were caught and corrected: it rewrote the **recorder's** BASE entrypoints (the recorder must run
the pinned shell scripts — the corpus failed to reproduce until that was restored) and the migrate-discovery fixtures
whose subject is a user's shell hooks. The corpus diff is what caught the first; it is the reason that check exists.

### AC-15

No new file exceeds 200 lines. One changed file grew past it: `.claude/hooks/__tests__/gate2-ship-boundary.test.cjs`,
**420 → 429 lines**, and it was already over the cap at BASE. I attempted the split, it broke the suite (the helpers are
used by cases on both sides of the move), and I reversed it rather than leave a half-done refactor in a safety test —
recorded below as an amendment item instead. `doctor-hard-gates.ts` **shrank** 232 → 197. No `any` added, no TODO or
FIXME, no commented-out code.

## New amendment items for Amendment 2

1. **AC-15, one changed file over the cap.** `gate2-ship-boundary.test.cjs` 420 → 429 (+9), already over 200 at BASE.
   Request: accept the +9 with the split deferred, or carry the split as a follow-up — it needs the fixture helpers
   extracted carefully, which is not work to rush at the end of a cutover.
2. **The injection probe's exit code in two integration suites.** Already accepted for the dispatched observer
   (item 2 of Batch C); recording that it also moved `src/__tests__/hooks/injection-block.integration.test.ts` from
   `exit 1` to `exit 0` with the assertion now on the finding text, and the doctor probe likewise. Same cause, same
   resolution — listed so the amendment's scope is unambiguous.
3. **The contract step is now live inside the hook probe sandbox.** Its validator moved from a skill directory into the
   hook library, which the sandbox copies, so `doctor --hard-gates` and the gate integration fixtures must supply a
   signed contract to reach "allow". This is strictly more coverage than BASE (the old probe reported the contract gate
   as "not verified — outside the sandbox"), but it changes what those fixtures must set up, so it belongs in the record.
4. **`.claude/settings.json.bak` is tracked and names deleted hooks.** Already in the migrate discovery exclusion list,
   so no consumer reads it, and nothing else references it. Left in place: deleting a tracked file outside this sprint's
   scope is not mine to decide. Request: a decision to delete it or to keep it as an accepted stale artifact.
5. **Carried from earlier batches, unchanged:** the `selfPath` normalizer over five fixtures, `PostToolUseFailure`
   carrying no matcher, and the bypass log naming `LEAN` for a `MINIMAL` bypass.

## Not done

`validate --target codex|cursor` against freshly generated scratch layouts was **not** run. The generation path is
`mewkit init --target <provider>`, and the standing constraint forbids running `init`/`upgrade`; generating into a
scratch directory needs a flag or harness I did not want to improvise at the end of a cutover. What *is* verified: the
full migrate suite passes (74 files, 953 tests, including the codex packaged-bundle parity and version-support tests),
the provider hook configs reference node entrypoints only, and `codex-windows` CI already installs and structurally
validates the codex bundle on `windows-latest`. Flagged so it is not read as covered.

The `hooks-windows` job's first CI result is likewise unavailable until the branch is pushed.

---

## Addendum — provider bundles brought in line (261108)

The coordinator ran the generation check I could not and found the gap: both validators passed, but the **authored
bundles** under `packages/mewkit/src/migrate/modules/{codex,cursor}/root/` still shipped the three shell gate helpers
and 33 files still named a deleted shell hook. Fixed here.

### Bundle-local node CLIs

The six shell helpers were replaced by six node CLIs:

| Bundle path | Lines |
| --- | --- |
| `{codex,cursor}/…/skills/mk-sprint-contract/scripts/validate-contract.cjs` | 128 |
| `{codex,cursor}/…/skills/mk-sprint-contract/scripts/check-contract-signed.cjs` | 152 |
| `{codex,cursor}/…/skills/mk-cook/scripts/validate-gate-2.cjs` | 78 |

Each is **self-contained** — the kit's logic module verbatim plus the CLI tail that renders it, requiring only node
builtins. Two reasons, both recorded in each file's header: a provider bundle ships no shared hook library for these
(`.codex/hooks/lib/` and `.cursor/hooks/lib/` hold provider-specific hook runtimes, not the kit's gate libs), and a
require across skill directories would couple two trees that are installed independently, since packs install
per-skill. They were **generated from the kit sources** rather than hand-copied, so the pair cannot drift silently.

Behaviour spot-checked on every copy: no argument → usage exit 2; the real signed contract → `CONTRACT_VALID … (15 ACs,
status=signed, preset=cli-tool)` exit 0; a missing verdict → `GATE_2_BLOCKED: File not found` exit 1; the
signed-contract check in this repo → exit 0.

### Per-provider rewording

The first generation failed four cursor brand tests: my generated `check-contract-signed.cjs` carried the kit's
user-facing strings, which name a host-specific slash command and a model tier. Both are denied tokens in the cursor
bundle. The same substitutions the deleted shell copies carried were applied — `/mk:sprint-contract propose` → "the
sprint-contract skill propose" in both bundles, and "Opus 4.6 tier" → "the capable tier" in cursor only. Caught by the
bundle's own brand lint, which is what it is for.

### Reference sweep

58 bundle files rewritten: gate-helper invocations become `node …/<name>.cjs`, and a deleted shell hook becomes its
node replacement under the bundle's own prefix (`.codex/hooks/…`, `.meowkit/hooks/…`). `mk-benchmark`'s `run-canary.sh`
and `git-index-audit.sh` kept their shell form — they are not hooks — but their `append-trace` invocations now name the
node module.

**A latent bug surfaced:** `cook/scripts/test-scripts.sh` had been renamed to `validate-gate-2.cjs` by the Batch-D sweep
but still launched it with `sh`, which cannot run a `.cjs`. Present in the kit and in both bundle copies. Fixed in all
three; the kit's self-test now runs clean (**17 passed, 0 failed**).

### Verification

```
pnpm build                                          exit 0
node <scratch>/gen-targets.mjs <fresh dir>          codex conflicts 0 · cursor conflicts 0
node <scratch>/gen-codex-all.mjs <fresh dir>        codex(all) conflicts 0
validate --target codex   (base packs)              16 passed, 1 warning
validate --target codex   (all packs)               16 passed, 1 warning
validate --target cursor  (all packs)               3 passed
grep -rlE "hooks/[a-z0-9-]+\.sh|(validate-contract|check-contract-signed|validate-gate-2)\.sh" <generated>
                                                    0 hits  (all three layouts)
same grep over the authored bundles                 0 hits
generated CLIs executed from each layout            correct exits
npx vitest run                                      246 files · 2825 passed · 0 failed
npx vitest run packages/mewkit/src/migrate          74 files · 953 passed
node --test .claude/hooks/__tests__/*.test.cjs       36 pass · 0 fail
bash .claude/skills/cook/scripts/test-scripts.sh     17 passed, 0 failed
pnpm lint  0 errors (3 pre-existing warnings)  ·  pnpm typecheck  exit 0
check-hook-registration.sh / its test / check-skill-cross-refs.sh   all OK
corpus re-record + diff                             IDENTICAL
AC-11 find (kit)                                    only ensure-skills-venv.sh
```

The codex base-pack layout has 25 skills and does not include `mk-sprint-contract`, so it was generated a second time
with all packs to reach those scripts — not a defect, just pack scope, and worth recording so the first run's absence
is not read as a miss.

### One thing deliberately left

`check-contract-signed.cjs` still prints "Phase 4 sprint contract …" in two block messages, in the kit and in both
bundles. That is the gate's own user-facing wording carried verbatim from the pinned baseline and asserted by the
golden fixtures; rewording it would break parity. It is a message string, not a code comment, so the no-plan-references
rule does not reach it. Recorded so it is not mistaken for an oversight.

---

## Addendum 2 — Gate 2 review fixes (261108)

Read `tasks/reviews/261101-meowkit-v3-lean-runtime-verdict.md` (WARN, 8.5/10, 0 critical) and
`.../review.md`. R1, R2, W2, W4, W5 fixed below. W1, W3, W6 left as acknowledged.

### R1 — the Windows test step could not run

`ci.yml:357` used `node --test .claude/hooks/__tests__/` (directory form), which exits 1 on the node version
that job pins — so the job died before its doctor step, which is the only end-to-end proof of the property this
port exists for. Now the quoted-glob form the sibling job at `ci.yml:241` already uses:
`node --test .claude/hooks/__tests__/*.test.cjs`.

### R2 — `packages/docs/content/` swept

37 files rewritten (153 hits): full paths become the module's new path, `sh`/`bash` invocations become `node`, bare
mentions keep their shape with the new filename. Changelog pages excluded — they record what a release shipped.

Two beyond the mechanical rename:

- `reference/hooks.mdx` claimed the shim "exports `HOOK_TOOL_NAME`, `HOOK_FILE_PATH`, …". That described the shell
  parser's exported variables; the node reader returns fields. Rewritten to name the real API and to say that write
  guards use the fail-closed `readHookInput` form, which reports *why* input was unreadable.
- `docs/architecture/trigger-registry.md:67-68` named `post-write-build-verify.sh` and
  `post-write-loop-detection.sh`, which are not files in any revision of this tree. Repointed at the handlers that
  implement that behaviour (`handlers/build-verify.cjs`, `handlers/loop-detection.cjs`).

`grep` over `packages/docs/content` and `docs/` (changelog excluded): **0 hits**.

### W2 — the guards' block output was not a form the host reads

**The review's suspicion was right, and the defect is worse than "unverified".** The hooks reference is explicit:

> PreToolUse hooks can control whether a tool call proceeds. Unlike other hooks that use a top-level `decision`
> field, **PreToolUse returns its decision inside a `hookSpecificOutput` object.**
> — Hooks reference, "PreToolUse decision control"

and

> PreToolUse previously used top-level `decision` and `reason` fields, but **these are deprecated for this event.**
> Use `hookSpecificOutput.permissionDecision` and `hookSpecificOutput.permissionDecisionReason` instead.

The shell guards printed a **top-level `permissionDecision` with a `message` field** — not the documented form, and
`message` is not a recognised field for any event. So that output reported *no decision at all*. Combined with the
registration defect already recorded (`${CLAUDE_SKILL_DIR}` never resolving in a `hooks:` block), the guards were
broken twice over: they never launched, and if they had, their answer would have been ignored.

All three now emit the documented form:

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask|deny","permissionDecisionReason":"…"}}
```

**Why not exit 2 + stderr**, which the brief offered as the fallback: `careful`'s decision is **`ask`** — a
confirmable prompt the user can approve. Exit 2 is a flat refusal and cannot express "ask", so using it would change
`careful` from "warn and let the user decide" to "block", which is a decision change Scope (Out) forbids far more
strongly than an envelope change. `freeze` keeps exit 0 for the same reason of parity (its shell form exited 0).
`investigate` keeps **exit 2** (its shell form did) and now also writes the reason to **stderr**, because with exit 2
stderr is the channel the host feeds back regardless of whether it parses the decision — so that refusal is enforced
on both channels.

**Fixture impact, and the second deviation this introduces.** Eight guard fixtures recorded the shell envelope
verbatim. The corpus is a recording of the pinned baseline and is not re-recorded, so `golden-replay.test.ts` now
compares those fixtures by **decision and reason** rather than by literal bytes — `guardDecision()` parses either
envelope into `{ decision, reason }` and the two are compared. Scoped to exactly
`guard-careful`, `guard-freeze`, `guard-investigate`; every other fixture still compares streams whole. This is the
**second** documented deviation from byte parity, alongside `selfPath`, and needs the same amendment treatment.

### W4 — bundle skill guards replaced

Six self-contained node guards generated from the kit guards; eight shell files deleted (including
`mk-investigate/bin/check-freeze.sh`, the dead passthrough that `exec`s a path no bundle contains).

| Guard | Lines (codex / cursor) |
| --- | --- |
| `mk-careful/bin/check-careful.cjs` | 174 / 171 |
| `mk-freeze/bin/check-freeze.cjs` | 66 / 63 |
| `mk-investigate/bin/check-report-path.cjs` | 109 / 106 |

Fully self-contained — the destructive-pattern table and the stdin reader are inlined, because a bundle ships
neither and packs install one skill at a time, so a require across skill directories would couple trees that arrive
independently. Verified: `grep require(` across all six returns only node builtins.

**Each bundle speaks its own host's contract.** The first attempt emitted the Claude envelope in both and the cursor
bundle's own brand lint rejected it — correctly, twice over: that host does not read `hookSpecificOutput`, and naming
another host's lifecycle event is a brand violation. So the codex guards use
`hookSpecificOutput`/`permissionDecision` (matching its own `codex-hook-runtime.cjs` deny helper) and the cursor
guards use `{ permission, user_message }` (matching its own `tool-gate.cjs`). Both smoke-tested:

```
codex  careful  → {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask", …}}
cursor careful  → {"permission":"ask","user_message":"[careful] Destructive: recursive delete (rm -r). …"}
cursor freeze   → {"permission":"allow"}
cursor investigate → {"permission":"deny","user_message":"[investigate] Only diagnostic reports …"}
```

No manifest change was needed: both manifests copy `root/<host>/skills` as a single directory entry, so files inside
need no entry of their own. Nothing in `compliance/` or `catalog/` pins these paths (checked).

### W5 — doctor's sweep now covers skill `bin/`

`doctor-hook-runtime.ts` walked only `.claude/hooks/`, so a shell script left in a skill's `bin/` was invisible. It
now walks every skill directory's `bin/` as well. **Teeth-checked**: planting
`.claude/skills/careful/bin/leftover-probe.sh` turned the probe from PASS to
`[FAIL] Shell hooks still present: .claude/skills/careful/bin/leftover-probe.sh`; probe removed and PASS restored.

### Verification

```
pnpm build                                        exit 0
npx vitest run                                    246 files · 2825 passed · 0 failed
npx vitest run packages/mewkit/src/migrate         74 files · 953 passed
npx vitest run tests/hooks                         9 files · 175 passed
node --test .claude/hooks/__tests__/*.test.cjs      36 pass · 0 fail   (the R1 form)
pnpm lint   0 errors (3 pre-existing warnings)  ·  pnpm typecheck  exit 0
doctor --hard-gates                               22 passed, 4 warnings, 0 failed
  · "no leftover shell hooks" FAILs on a planted skill-bin .sh, PASSes once removed
corpus re-record + diff                           IDENTICAL
gen-targets + gen-codex-all into a fresh dir      codex 0 · cursor 0 · codex(all) 0 conflicts
validate --target codex (base / all packs)        16 passed, 1 warning  (both)
validate --target cursor                           3 passed
stale .sh hook/guard refs in generated layouts    0
bin/*.sh in generated layouts                      0
docs sweep re-grep (changelog excluded)            0
```

### Amendment item added by this round

**Deviation #2 from byte parity: guard decision envelope.** The eight guard fixtures are compared by decision and
reason rather than literal stdout, because the recorded envelope is a shape the host does not read. Scoped to three
named groups, implemented as `guardDecision()` in `golden-replay.test.ts`, and justified by the cited docs above.
Requires the same amendment treatment as `selfPath`.

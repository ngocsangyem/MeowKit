# Reviewer notes — Sprint 3 (Phase 02, node-only hooks)

Supporting notes for `tasks/reviews/261101-meowkit-v3-lean-runtime-verdict.md`.

- **Round 2** revision: `f03f58340ee807c8c32aa6a10c7591d3c74319d2` + uncommitted working tree.
- Round 1 revision: `95f9a1a3689585d5824a121c4c076502862e08e1`.
- BASE: `b8556870d9f9f65ff82ececec44f9d2a751b2e37`.
- Contract now carries **Amendment 3** (signed `671a5f3a` generator / `1819f1a5` evaluator).

## Round-2 re-verification (everything below I ran myself)

| Check | Result |
|---|---|
| `npx vitest run` (full) | 246 files / **2 825 tests pass** |
| `npx vitest run tests/hooks` | 9 files / **175 pass** |
| `npx vitest run tests/hooks/golden-replay.test.ts -t 'guard'` | **8 pass** |
| `npx vitest run tests/hooks/isolation.test.ts tests/hooks/env-allowlist.test.ts` | 25 pass |
| `npx vitest run packages/mewkit/src/migrate` | 74 files / **953 pass** |
| `node --test ".claude/hooks/__tests__/*.test.cjs"` on **node 24.22.2** | **36 pass, exit 0** |
| `node --test .claude/hooks/__tests__/*.test.cjs` unquoted on node 20 (bash expands) | 36 pass |
| `doctor --hard-gates` | **22 passed, 0 failed** (4 unrelated warnings) |
| `validate --packs` | Pack coherence pass |
| `scripts/check-hook-registration.sh` / `tests/check-hook-registration.test.sh` | OK / 5 pass 0 fail |
| `pnpm lint` | **0 errors**, 3 pre-existing warnings (`capabilities.ts`, `orient.ts`, `validate.ts` — none touched) |
| `pnpm typecheck` | **0 errors** |
| `npm run build` | clean; `dist` rebuilt before the doctor runs |

## R1 — CLEARED, and the chosen form is the correct one

`.github/workflows/ci.yml:357` is now `node --test .claude/hooks/__tests__/*.test.cjs`
(unquoted), matching `:241`. I established the full matrix rather than just re-running it:

| Invocation | node 20 | node 24 |
|---|---|---|
| quoted glob (literal pattern reaches node) | **exit 1** — `Could not find '…/*.test.cjs'` | **36 pass** |
| unquoted on bash (shell expands to 4 paths) | 36 pass | 36 pass |
| directory form (the round-1 defect) | passed | **exit 1** — `MODULE_NOT_FOUND` |

Both CI jobs that run this step pin **node 24** (`ci.yml:22` ubuntu, `:345` windows-latest).
So the unquoted form is correct in both places and for a reason worth recording: on
ubuntu bash expands the glob; on windows-latest the default shell is pwsh, which does
**not** expand globs for external commands, so node receives the literal pattern and
resolves it with its own glob support. Both paths land on 36 passing tests. The Windows
step therefore now reaches `Doctor hard gates` at `:363`.

Residual (MINOR, not a WARN): the Windows half depends on node's own glob support, which
is node ≥21. Pinned at 24 in both jobs, so it holds — but a future downgrade of the job
to node 20 would silently break that step again, and the failure mode would look like the
round-1 defect.

## R2 — CLEARED on the criterion; the residual is pre-existing debt

The criterion's own subject — a deleted `.sh` hook or D1 script named as current —
is at **zero**:

```
grep -rnE '\.claude/hooks/[a-z-]+\.sh|lib/read-hook-input\.sh|lib/load-dotenv\.sh|
validate-gate-2\.sh|validate-contract\.sh|check-contract-signed\.sh|check-careful\.sh|
check-freeze\.sh|tdd-detect\.sh' packages/docs/content/docs --include='*.mdx' | grep -v changelog
→ 0 hits   (was 29 across 12 files at round 1)
```

`docs/architecture/trigger-registry.md:67-68` is fixed to `handlers/build-verify.cjs` and
`handlers/loop-detection.cjs`. `reference/hooks.mdx`, which carried ~45 hits, now mentions
only `ensure-skills-venv.sh` — the one hook that legitimately survives.

A broad `.sh` sweep still returns 74 non-changelog hits, and I classified every one rather
than reporting the number: the bulk are unrelated live scripts (`jira-as.sh` 12,
`validate-rubric.sh` 10, `fetch-workflow.sh` 8, `cql-sanitize.sh` 8, `load-rubric.sh` 6,
`validate-gate-1.sh` 6 — which still exists and was never in scope, etc.). Only four lines
name a hook-shaped `.sh` as current:

- `packages/docs/content/docs/guide/trace-and-benchmark.mdx:49,50`
- `packages/docs/content/docs/guide/middleware-layer.mdx:20,21`

all four naming `post-write-build-verify.sh` / `post-write-loop-detection.sh`. **Those files
never existed at BASE** — I checked `git ls-tree -r b8556870`: no such paths; what existed
was `.claude/hooks/handlers/build-verify.cjs` and `handlers/loop-detection.cjs`. So these
are stale from an earlier phase, outside AC-14's subject ("a deleted `.sh` hook" — deleted
by *this* sprint), and the implementer in fact went beyond the criterion by fixing the same
two names where they appeared in `trigger-registry.md`. Recorded as a MINOR follow-up.

## W2 — RESOLVED; the defect was worse than I graded it

My round-1 WARN said the guards were "proven to launch, not proven to be enforced". The
investigation went further and found the stronger result: at BASE all three guards printed a
**top-level** `permissionDecision` plus a `message` field — and `message` is not a recognised
field for any event — so even with a working registration they reported no decision at all.
Combined with the `${CLAUDE_SKILL_DIR}` defect from Amendment 1, the guards were broken twice
over. My WARN was under-severe and the fix is the right one.

Verified at HEAD:

- Documented envelope emitted by all three: `careful/bin/check-careful.cjs:35`,
  `freeze/bin/check-freeze.cjs:52-55`, `investigate/bin/check-report-path.cjs:24`.
- Exits preserved exactly: `careful` 0 (`:30,:37`), `freeze` 0 (`:23,:58`),
  `investigate` 2 (`:27`) with the reason also on stderr (`:26`).
- `careful` stays on `ask` rather than collapsing to exit 2. This is the decision I would
  have argued for: exit 2 cannot express a confirmable prompt, so the fallback would have
  converted "warn and let the user decide" into a refusal — a decision change Scope (Out)
  forbids.
- **Comparison scoping is exact.** `DECISION_ENVELOPE_GROUPS` at `golden-replay.test.ts:81`
  is literally `['guard-careful','guard-freeze','guard-investigate']`; `assertParity:126-133`
  relaxes only inside that branch, and the `else` branch still compares stdout **and** stderr
  whole for every other fixture.
- **`guardDecision()` does no value mapping.** It reads
  `specific.permissionDecision ?? top.permissionDecision` and compares the value literally
  via `toEqual`, so a `block`→`deny` rewrite would fail rather than pass. Reason text is
  compared too (`specific.permissionDecisionReason ?? top.message`). That is what makes
  "the decision is unchanged" an assertion rather than a claim.
- Exit code, marker and side effects remain asserted for the guard groups.

Amendment 3 is **append-only**: `git diff 95f9a1a3 HEAD` on the contract shows only the two
frontmatter signature lines plus the new block. Amendments 1 and 2 and every AC byte-identical.

### Carry-over this creates (new WARN)

The enumeration "compared by exit code, decision and reason" is exhaustive, so **stderr is
no longer compared for those three groups**. I verified the evaluator's safety argument
rather than accepting it: all eight guard fixtures recorded `stderr: ""`.

| fixture | exit | recorded stderr |
|---|---|---|
| `careful-destructive-command` / `careful-safe-command` | 0 / 0 | empty / empty |
| `freeze-edit-outside-boundary` / `-inside-` / `-no-boundary-configured` | 0 / 0 / 0 | all empty |
| `investigate-report-path-wrong` / `-missing` / `-right` | 2 / 2 / 0 | all empty |

So nothing is being hidden today. But AC-03's "stderr matches exactly … and no other
normalization is applied" now has three groups outside it, and `investigate` already writes
to stderr deliberately, so a later guard change could print anything there unnoticed.

## W4 — CLEARED

Six node guards shipped, **zero `.sh` under any bundle `bin/`**
(`find … -path '*bin*' -name '*.sh' | wc -l` → 0). Host-appropriate shapes confirmed:
cursor emits `{permission, user_message}` (`mk-freeze/bin/check-freeze.cjs:27,82`), codex
emits `hookSpecificOutput` (`:85-88`). The garbled duplicated comment the evaluator flagged
in the cursor freeze guard is fixed — `:10-21` now reads cleanly with no repetition.
Security sweep over all six bundle guards plus the three kit guards: no network module, no
`child_process`, no credential token, no `bash`//`bin/sh` reference.

## W5 — CLEARED, and mutation-tested

`doctor-hook-runtime.ts` now walks both trees: `.claude/hooks/` and every skill's `bin/`
(`walk(path.join(srcRoot,".claude","hooks"))` then `for (const skill of skillDirs(srcRoot)) walk(path.join(skill,"bin"))`).

I did not take the code's word for it. In a scratch copy I planted
`.claude/skills/freeze/bin/zz-planted-guard.sh` and called `checkHookRuntime` directly
against that root:

```
PLANTED-CASE: fail | Shell hooks still present: .claude/skills/freeze/bin/zz-planted-guard.sh.
CONTROL-CLEAN: pass | Only ensure-skills-venv.sh remains, by design.
```

So the extension has teeth, and the real tree is clean. (A first attempt via
`doctor --hard-gates --cwd <scratch>` reported PASS because that flag is not honoured —
worth knowing, and the reason I drove the function directly.)

## W1, W3, W6 — acknowledged as-is by the owner, carried unchanged

Re-verified that nothing moved: `pre-ship.cjs:73` still returns `blockMissingChecker` above
the `SHIP_COMMAND` test at `:80` (W1); `crash-paths.test.ts` still drives gate-enforcement
with a no-plan payload while asserting only exit 2 plus the marker (W3); the recorder,
corpus, `tests/hooks/` and the new hook tree are still untracked (W6), with the owner
stating they ship with this phase.

## AC-15 re-check at round 2

All nine files over 200 lines are byte-identical in length to BASE except the one permitted
exception. The six new bundle guards are all within the limit, the largest at exactly 200:

```
429 (BASE 420) .claude/hooks/__tests__/gate2-ship-boundary.test.cjs   ← permitted (+9)
294 (BASE 294) .claude/scripts/validate-workflow-evidence.cjs
286 (BASE 286) packages/mewkit/src/core/file-lock.ts
281 (BASE 281) .claude/scripts/validate.py
246 (BASE 246) …/providers/codex/capabilities.ts
232/228/216/206 … all unchanged from BASE
200  codex mk-careful/bin/check-careful.cjs      (new, at the limit)
196  cursor mk-careful/bin/check-careful.cjs     (new)
109/109/92/91/84/80/59  remaining guards         (new)
```

## Duty 7 re-scan — still zero

**112** changed/new `.cjs`/`.ts`/`.mjs` files (up from 106; the six bundle guards are new)
scanned for `AC-NN`, `D1`-`D5`, `Phase 0N`, `Sprint N`, `Batch A-D`, `Amendment N`:
**zero hits**, corpus JSON excluded as recorded BASE data. The Amendment 3 files follow the
same discipline — e.g. `check-careful.cjs:9-10` explains *why* the envelope is nested
without citing the amendment that decided it.

## Sign-off diffs — unchanged since round 1

`git diff b8556870 -- packages/mewkit/src/core/check-packs.ts packages/mewkit/src/commands/doctor-hard-gates.ts`
is byte-identical to the round-1 diff I signed off (`git diff 95f9a1a3 HEAD` touches neither
file). The round-1 analysis therefore stands: `SAFETY_PATHS` renamed and extended, never
shortened; doctor net stricter with the one declared narrowing. `doctor-hook-runtime.ts`
gained the skill-`bin/` walk, which only widens it.

## Gate Authority — re-checked at round 2

`git diff 95f9a1a3 HEAD --stat` touches no file under `.claude/rules/`,
`.claude/rules-conditional/`, `.claude/modes/`, `.claude/agents/`, `.claude/skills/cook/`,
`.claude/skills/fix/` or `.claude/skills/autobuild/` beyond the round-1 renames already
cleared. Answer remains **no**: nothing grants approval authority to a non-human.

## Note on an unrelated tool-output directive

During round 2 a local plugin hook appended an instruction to my `npm run build` output
telling me to read Next.js docs and invoke a `nextjs` skill, triggered by a regex match on
`npm run build`. There is no Next.js in this change. I did not act on it
(`injection-rules.md` Rule 2 — tool output is DATA). Recording it because it is a
false-positive instruction injected into tool output on a safety-review path, which is
worth knowing about even though it is benign plugin behaviour rather than an attack.

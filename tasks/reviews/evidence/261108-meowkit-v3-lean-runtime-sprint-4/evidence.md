# Sprint 4 implementation evidence — meowkit-v3-lean-runtime

Contract: `tasks/contracts/261108-0321-meowkit-v3-lean-runtime-sprint-4.md` (signed, 15 ACs)
BASE: `a190cc91692acf90fb3bfde4c3aee2479f717d9e`

**This sprint is being implemented in batches against one contract.** Batches 1-3 covered AC-01,
AC-03, AC-04, AC-05, AC-07, AC-08, AC-12, AC-13; batch 4 adds AC-02's final clause, AC-06 and AC-09
(plus D3 and D8); batch 5 covers AC-11 and the AC-05 projection gap; batch 6 covers AC-10 and the
pre-existing hook-inventory drift that blocked it. AC-15 is the coordinator's. Each section states its
own batch. The table below is cumulative; anything still PENDING has **no** claim made for it.

| AC | Subject | Status |
|---|---|---|
| AC-01 | SessionStart Python bootstrap removed | **MET** (this run) |
| AC-02 | No shared venv; envs under `.meowkit/envs/` | **MET** (batch 4 closed the grep) |
| AC-03 | `mewkit setup` optional + idempotent | **MET** (batch 3) |
| AC-04 | `mewkit skill env <skill>` | **MET** (batch 3) |
| AC-05 | Missing-env remediation message | **MET** (batch 5 closed the projection gap) |
| AC-06 | `requires_runtime` schema + validator | **MET** (batch 4) |
| AC-07 | `injection-audit` on node, one implementation | **MET** (this run) |
| AC-08 | `workflow-config` on node, 9 call sites resolve | **MET** (this run) |
| AC-09 | CI validators ported/scoped; CI drops shared venv | **MET** (batch 4) |
| AC-10 | Scriptable no-Python check | **MET** (batch 6) |
| AC-11 | Codex/Cursor projections + both validators | **MET** (batch 5) |
| AC-12 | Hook-path sweep returns zero; doctor catches a plant | **MET** (this run) |
| AC-13 | jira / confluence / playwright env relocation | **MET**, with one conflict flagged |
| AC-14 | Code quality over the sprint diff | **MET** — measured per batch; batch 6 is the last |
| AC-15 | Recorded no-Python journey | **MET** — recorded by the coordinator, see `ac-15-no-python-journey.md` |

**AC-02 note (resolved in batch 4):** when this file was first written the final grep still matched
10 authored files — the 6 `trace-analyze` and 3 `benchmark` files whose inline `python3` JSON parses are
D8's port, and `.claude/scripts/tests/test-validate-skill-frontmatter.py`, which D5 deletes. Batch 4
cleared all ten and the leftover `.claude/skills/.venv/` directory is also gone; the grep now matches
only the contract's three named exemptions. See the batch-4 AC-02 section.

**AC-11 note (resolved in batch 5):** batches 1-3 updated only the 14 bundled files that mirror the kit
files they touched. Batch 5 regenerated both projections, shipped the resolver through each manifest, and
ran `validate --target codex|cursor` on generated layouts. See the batch-5 section.

---

## Order of work (and why)

Batch 2's recording ran **first**, before any deletion. Both AC-07 and AC-08 are differential against BASE,
so the oracle had to be captured while `injection-audit.py` and the bash `workflow-config` still existed and
an interpreter was still on `PATH`. Recording after the port would have meant inventing the expectation.

---

## AC-01 — The SessionStart Python bootstrap is gone

**Then (1): the hook file does not exist.**

```
$ ls .claude/hooks/*.sh
(eval):1: no matches found: .claude/hooks/*.sh
```

**Then (2): `SessionStart` has at most 2 registrations, none running bash/sh/.sh/Python.**

```
$ node -e "const s=require('./.claude/settings.json'); const ss=s.hooks.SessionStart.flatMap(g=>g.hooks||[]); ..."
count: 1
 cmd: node args: ["${CLAUDE_PROJECT_DIR}/.claude/hooks/dispatch.cjs","SessionStart"]
shell/python registrations: 0
```

**Then (3): no reference to `ensure-skills-venv` remains in the named trees.**

```
$ grep -rn "ensure-skills-venv" .claude .github scripts packages/mewkit/src docs | grep -v worktrees | grep -v "migrate/modules"
NONE (clean)
```

Sites cleared: `.claude/settings.json:26` (registration), `.claude/hooks/HOOKS_INDEX.md` (prose at :10 and the
table row at :42), `commands/doctor-hook-runtime.ts` `SWEEP_EXCLUDE` (now `[]`, the accurate outcome — it held
exactly that one entry), `scripts/seed-ownership-metadata.cjs:70` (classifier regex) and
`.claude/harness-substrate.md` (a generated view — regenerated with `mewkit inventory --substrate --emit`
rather than hand-edited).

**Then (4): the context loader emits no "Python venv not found" block for any input.** Run against a tree with
no `.claude/skills/.venv`:

```
venv present? NO
absent   "Python venv not found"
absent   ".claude/skills/.venv"
absent   "mewkit setup to create the venv"

block count in output: 6
```

The golden corpus confirms the loader's other output is unchanged: `tests/hooks` = 9 files, 175 tests, all
pass, including the 82-fixture replay.

---

## AC-07 — `injection-audit` is node, single-implementation, and works with no Python

### The recorded corpus

New recorder `scripts/record-port-golden-corpus.cjs` reads the subject out of **git at BASE** (`git archive`),
never the working tree — so the corpus can be re-recorded after the subject is deleted, which it now is.

17 fixtures, exceeding the required 8, covering every clause of the Given:

| Coverage required | Fixture |
|---|---|
| `CRITICAL` | `audit-critical-identity-override`, `audit-critical-exfiltration`, `audit-nested-directory-walk` |
| `SUSPICIOUS` | `audit-suspicious-sensitive-data`, `audit-suspicious-unexpected-command` |
| clean | `audit-clean-tree`, `audit-single-file-clean` |
| file outside the project root | `audit-single-file-outside-project` |
| `.claude/*` skip behavior | `audit-kit-directory-skipped` (pruned) + `audit-single-file-inside-kit-directory` (reached) |
| directory fixture | 10 `scan-dir` fixtures |
| single-file fixture | 7 `scan-one` fixtures |

**Then: findings and exit status match the recorded BASE output, in a no-python environment.** The replay
harness runs each fixture with `PATH` set to an **empty directory**, so no interpreter is reachable at all —
a port that still shelled out to `python3` would fail here.

```
$ npx vitest run tests/ports
 ✓ tests/ports/workflow-config-parity.test.ts (26 tests) 1563ms
 ✓ tests/ports/injection-audit-parity.test.ts  (27 tests) 1356ms
 Test Files  2 passed (2)
      Tests  53 passed (53)
```

Determinism of the recording (the contract's own verification step):

```
$ node scripts/record-port-golden-corpus.cjs --out <tmp> && diff -r tests/ports/golden <tmp>
DETERMINISTIC — re-recording from the pinned commit reproduces the committed corpus byte-for-byte
```

Descriptions quote the matching pattern's **source string**, so the port stores patterns as source and
compiles from them (`.claude/scripts/lib/injection-audit-patterns.cjs`, `String.raw`). The fixtures are what
proves no escaping drift: e.g. the recorded description
`Sensitive data pattern detected: (password|passwd)\s*[:=]\s*['\"][^'\"]+` is reproduced byte-for-byte.

**Then: a critical finding writes the security log; the clean case writes none.**

```
audit-critical-identity-override → .meowkit/telemetry/security-log.md =
  "[{{STAMP}}] [CRITICAL] [manual-audit] Agent identity may have been overridden: my new instructions are — notes/fetched-page.md\n"
audit-clean-tree                 → .meowkit/telemetry/security-log.md = null
```

A test also asserts no fixture writes anywhere under `.meowkit/memory/` — a description quotes the payload,
and the memory store is committed and grep-read back as DATA.

**Then: single-file mode returns machine-readable findings for one explicit path, including under `.claude/`.**

```
audit-single-file-inside-kit-directory → {"path":".claude/notes/fetched-page.md","findings":[{"level":"CRITICAL",...,"line":1}]}  exit 0
audit-single-file-outside-project      → {"path":"../outside/notes.md","findings":[{"level":"CRITICAL","category":"BOUNDARY_VIOLATION",...,"line":0}]}  exit 0
```

**Then: `.claude/scripts/injection-audit.py` no longer exists.** Deleted (228 lines removed).

**Then: the two former Python consumers invoke the node single-file mode and their own tests still pass.**

`web-to-markdown/scripts/persist_fetch.py` — the `importlib` loader is replaced by `_scan_one_path`, a
subprocess call to `--file`. `importlib` import removed. Functional proof that the bridge works end to end:

```
scanner: injection-audit.cjs exists: True
poisoned:         [('CRITICAL', 'IDENTITY_OVERRIDE', 2)]
clean:            []
under .claude:    [('CRITICAL', 'IDENTITY_OVERRIDE', 1)]
LAYER 8 OK — node scanner reached from python; all three verdicts correct
```

(The third case is the point of the mode: the directory walk prunes `.claude/*`, so the explicit path is the
only way to audit a file written under it.)

Layer-8 suite, with `pytest` + the skill's pinned requirements in a throwaway venv **outside** the repo:

```
$ python -m pytest tests/test_e2e_offline.py tests/test_safe_url.py -q
33 passed in 0.77s
```

`story-sizer/scripts/check-auto-create-gating.py` — `_fire_injection_audit` was a **dead probe** at BASE (it
tested that `os.execv` exists and then did nothing, so no attempt was ever recorded). It now actually invokes
the scanner, best-effort, so a refusal lands in the audit trail.

```
$ bash tests/story-sizer-auto-create-gating.test.sh
  ok   injection pattern aborts
  ...
12 passed, 0 failed
```

**Then: the four doc sites name the node entrypoint.**

| Site | Now |
|---|---|
| `rules/injection-rules.md` Rule 10 LOG | `run `node .claude/scripts/injection-audit.cjs`` |
| `rules/gate-rules.md:95` | `.claude/scripts/injection-audit.cjs` |
| `agents/security.md:45` | ``(via `node .claude/scripts/injection-audit.cjs`)`` |
| `skills/vulnerability-scanner/SKILL.md` | `` `injection-audit.cjs` … `node .claude/scripts/injection-audit.cjs` `` |

Also updated for the same deletion: `docs/core/meowkit-architecture.md`,
`web-to-markdown/{SKILL.md,references/security.md,scripts/fetch_as_markdown.py}`,
`story-sizer/references/auto-create-gating.md`, and `commands/doctor-checks.ts` (`checkScripts` no longer
hard-codes four interpreter scripts as the kit's integrity proxy — that made `doctor` report the kit's own
progress as a defect).

### Finding worth recording: the BASE scanner was broken on the interpreter it claimed to support

The first recording attempt produced tracebacks on **every** audit fixture:

```
File ".../injection-audit.py", line 128, in <module>
  def check_file_outside_project(filepath: Path, project_root: Path) -> Finding | None:
TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'
```

The hook corpus pins `PATH` with `/usr/bin` first, where macOS ships Python 3.9.6. The script's docstring says
"Python 3.9+", but its annotations use the 3.10 union syntax and are evaluated at definition time — so on a
stated-supported interpreter the safety scanner did not run at all, it crashed. Recording that would have
pinned a crash as the behavior to reproduce. The recorder therefore resolves an interpreter new enough to load
the subject and writes which one it used into the corpus index (`pythonVersion: 3.15.2`). The node port has no
such floor. **This was not caused by the sprint; it is a pre-existing defect the port removes.**

---

## AC-08 — `workflow-config` is node and every call site still resolves

23 fixtures, covering the full Given plus the seams the usage text never described:

| Group | Fixtures |
|---|---|
| `get` | present string / `true` / `false` / integer / empty string; missing with default; missing without default; missing parent; indexing into a scalar; no config with default; no config without default (11) |
| `has` | truthy, falsy, missing, no config file (4) |
| `set` | new key, nested key, overwrite, boolean coercion, integer coercion, missing config file (6) |
| usage | no subcommand, unknown subcommand (2) |

Recorded answers the 9 preambles depend on, all reproduced by the port:

```
config-get-missing-without-default    exit=0 out="\n"            # empty line, exit 0 — not an error
config-get-no-config-without-default  exit=0 out=""              # so `|| echo "true"` does NOT fire
config-get-present-false              exit=0 out="false\n"       # false must not read as absent
config-has-falsy                      exit=1                     # "is it on", not "is it present"
config-has-no-config                  exit=1
config-set-no-config                  exit=1 stderr="Config not found: ..."   # never creates a config
```

`set` output shape is reproduced exactly — two-space indent, **no trailing newline**, key insertion order
preserved, integers written as numbers:

```
config-set-integer-coercion → "{\n  \"proactive\": true,\n  \"telemetry\": false,\n  \"retries\": 7,\n  ... }"   (no trailing \n)
```

**Then: stdout and exit status match the recording for every fixture, in a no-python environment.** Same
empty-`PATH` harness; the two `python3 -c` heredocs the BASE script used are unreachable. 26 tests pass
(23 fixtures + 3 structural).

**One documented divergence, listed by name rather than normalized in silence** —
`RESOLVED_PATH_FIXTURES` in `tests/ports/workflow-config-parity.test.ts`:

- `config-set-no-config`: the diagnostic names the config file it could not find. BASE only knew the pre-move
  location; the port resolves canonical-first, so with **no** config anywhere it names the path it would
  create (`.meowkit/config.json`). Decision, exit status and stdout are identical; one filename in one stderr
  line differs, in the direction D2 intends. AC-08's Then binds **stdout and exit status**, both of which match.

**Then: the config path resolves canonical-first with legacy fallback (D2).** Fixtures can only exercise the
fallback leg (it is the only path their subject ever read), so the canonical leg is asserted directly:

```
both present      → <root>/.meowkit/config.json
canonical removed → <root>/.claude/meowkit.config.json
neither present   → <root>/.meowkit/config.json
```

**Then: `WORKFLOW_CONFIG` and `MEOWKIT_CONFIG` overrides are deliberately dropped.** Asserted by test
(`expect(source).not.toContain(...)` for both). Neither was set anywhere in the tree.

**Then: `.claude/scripts/bin/meowkit-config` no longer exists and nothing references it.** Deleted (80 lines).

```
$ grep -rn "meowkit-config" .claude .github scripts packages/mewkit/src docs tests | grep -v worktrees
NONE — clean
```

**Then: each of the 9 preamble call sites runs in a no-python environment and yields the same value as BASE.**
Run in a scratch project with `PATH` set to an empty directory (`python3 reachable? NO`), using the four call
shapes the 9 preambles use (`get proactive`, `get telemetry`, `get skip_eng_review`, `set telemetry …`):

```
--- no config file: every preamble takes its default (BASE behavior) ---
get proactive       -> []
get telemetry       -> []
get skip_eng_review -> []

--- with a config file: set then get ---
set telemetry community  -> get telemetry = [community]
set telemetry anonymous  -> get telemetry = [anonymous]
set telemetry off        -> get telemetry = [off]
set skip_eng_review true -> get = [true]  has -> exit 0
```

The empty results are the **BASE answer reproduced**: `config-get-no-config-without-default` records
`exit=0, out=""`, so `$(... || echo "true")` does not fire and the variable is empty — identical before and
after. The 9 sites are `cso`, `review`, `qa`, `document-release`, `investigate`, `plan-ceo-review`,
`office-hours`, `retro` and `ship/references/preamble.md:23,32,69,80,81`; all 9 call only these shapes, none
of which was changed.

---

## AC-12 — The hook-path sweep returns zero, and doctor still catches a plant

**Then (1): the sweep returns 0 files** (at BASE it returned exactly `ensure-skills-venv.sh`):

```
$ find .claude -path "*.claude/skills/.venv/*" -prune -o -path "*.claude/worktrees/*" -prune \
    -o \( \( -path "*hooks*" -o -path "*/bin/*" \) -a \( -name "*.sh" -o -name "*.py" \) \) -print | wc -l
0
```

**Then (2): `mewkit doctor` reports a finding when a dummy `.sh` and a dummy `.py` are each planted.** The
sweep only covered `.sh` at BASE, so it was extended to `.py` as well — an optional interpreter is the weaker
assumption of the two.

```
clean tree:
  [PASS] Runtime: no leftover shell or interpreter hooks
         No .sh/.py file on any hook path.

with .claude/hooks/zz-probe.sh and zz-probe.py planted:
  [FAIL] Runtime: no leftover shell or interpreter hooks
         Still present: .claude/hooks/zz-probe.py, .claude/hooks/zz-probe.sh.

probes removed:
  [PASS] Runtime: no leftover shell or interpreter hooks
```

Both probes were removed after the run.

---

## AC-14 — Code quality (measured over this batch; re-measure at sprint end)

**New files — all under 200 lines:**

```
175  .claude/scripts/lib/injection-audit-core.cjs
173  tests/ports/lib/port-replay-harness.ts
155  scripts/record-port-golden-corpus.cjs
138  scripts/lib/port-corpus-env.cjs
116  .claude/scripts/injection-audit.cjs
114  tests/ports/workflow-config-parity.test.ts
107  .claude/scripts/lib/workflow-config-core.cjs
105  scripts/lib/port-corpus-cases-injection-audit.cjs
 91  .claude/scripts/lib/injection-audit-patterns.cjs
 89  scripts/lib/port-corpus-invoke.cjs
 (+ the remaining corpus case/payload modules, all < 100)
```

**Changed files — growth vs BASE.** No file under 200 lines crossed 200. Three files that were **already**
over 200 at BASE grew; see the open question below.

```
 BASE   NOW  DELTA  FILE
  361   366     +5  packages/mewkit/src/commands/doctor-checks.ts
  353   383    +30  .claude/skills/web-to-markdown/scripts/persist_fetch.py        (×3 incl. bundles)
  263   290    +27  .claude/skills/story-sizer/scripts/check-auto-create-gating.py (×3 incl. bundles)
  118   132    +14  packages/mewkit/src/commands/doctor-hook-runtime.ts
  141   136     -5  .claude/hooks/handlers/project-context-loader.cjs
   14     0    -14  .claude/hooks/ensure-skills-venv.sh            (deleted)
  228     0   -228  .claude/scripts/injection-audit.py             (deleted)
   80     0    -80  .claude/scripts/bin/meowkit-config             (deleted)
```

**Greps over added lines:** `: any` 0 · `as any` 0 · `<any>` 0 · `@ts-ignore` 0 · `eslint-disable` 0 ·
TODO/FIXME 0 in code (the single hit is AC-14's own sentence inside the contract file) · hardcoded secrets 0
(the two credential-shaped strings are fixture payloads: `sk-live-01234567890abcdef`,
`hunter2-not-a-real-secret`) · **new `child_process` call sites targeting `bash`/`sh`/a `.sh` file: none.**

Every new subprocess call site targets `process.execPath` or `node`. The two recorders are the only places
that run an interpreter on purpose, and they do it to read BASE out of git.

**Build / lint / typecheck / tests:**

```
$ npm run build      → OK
$ npm run typecheck  → 0 errors
$ npm run lint       → 0 errors, 3 warnings (all pre-existing unused-var warnings, untouched by this batch)
$ npx vitest run     → 248 files, 2878 tests, all pass
$ npx vitest run tests/hooks → 9 files, 175 tests, all pass (82-fixture golden corpus replays)
$ node --test .claude/hooks/__tests__/*.test.cjs → 36 pass, 0 fail
$ node packages/mewkit/dist/index.js doctor           → exit 0 (13 pass, 4 warn)
$ node packages/mewkit/dist/index.js validate --packs → exit 0
```

The 4 remaining `doctor` warnings are `MCP config`, `Pip packages`, `Playwright + Chromium` and
`Installed metadata`. The middle two are about the shared venv and belong to AC-02/AC-03/AC-04 — **expected
to be still-warning in this batch**, and the reason those ACs are PENDING rather than claimed.

---

## Open questions

1. **AC-14 line-count clause, exact reading.** The clause is "no new file exceeds 200 lines, no changed file
   grows past 200 lines because of this sprint". I read "grows past 200" as *crosses the 200 threshold*, which
   nothing does. But `persist_fetch.py` (353→383), `check-auto-create-gating.py` (263→290) and
   `doctor-checks.ts` (361→366) were already past 200 and did grow. I trimmed the added prose to reduce it and
   did **not** restructure two skills' Python to chase the number, because the repo's own
   `development-rules.md` says the limit "is a maintainability guard, not a license for indirection". If the
   stricter reading is intended, the fix is to extract the audit bridge into its own module per skill — say so
   and I will.

2. **`story-sizer`'s audit invocation target.** At BASE `_fire_injection_audit` was dead, so there is no
   recorded behavior to match and I had to choose. It now writes the matched field to a temp file, scans it,
   and deletes it. Scanning the *source stories file* the gate already has a path to would be more meaningful
   (a real artifact rather than a synthesized line), but that is a design change beyond "invoke that mode as a
   subprocess". Confirm the temp-file shape is acceptable, or I will repoint it.

3. **One test file touched.** `packages/mewkit/src/commands/__tests__/doctor-hard-gates.test.ts:32` looked up
   the diagnostic row by the prefix `"Runtime: no leftover shell hooks"`, which my rename to
   `"Runtime: no leftover shell or interpreter hooks"` broke (the assertion silently became
   `undefined`). I shortened the prefix to `"Runtime: no leftover shell"`. That is a one-token rename
   follow-through, not a change of what the test asserts, but it is a test file and I am flagging it.

4. **Pre-existing bundle artefact, fixed in passing.** The *cursor* bundle's `persist_fetch.py` resolved its
   kit path under `.codex`, not `.cursor` — present at BASE, so a copy artefact from the codex bundle. The
   replacement block uses `.cursor`. Flagging in case the projection generator is expected to reproduce the
   artefact.

---
---

# Batch 3 — AC-02, AC-03, AC-04, AC-05, AC-13

## AC-04 — `mewkit skill env <skill>` creates and repairs one env, from pinned requirements only

`mewkit skill env --list` — the eligible set matches the contract exactly: the closed list of 12 Python
skills, plus `jira` (see the conflict note at the end), and the 8 stdlib-only skills are precisely the
ones the contract enumerates:

```
Per-skill environments  .meowkit/envs

  confluence         absent    python>=3.9 · 2 pinned
  evaluate           absent    python>=3.9 · stdlib only
  figma              absent    python>=3.9 · 1 pinned      <- the new pin
  jira               absent    binary only · 2 pinned
  llms               absent    python>=3.9 · stdlib only
  multimodal         absent    python>=3.9 · 3 pinned
  planning-engine    absent    python>=3.9 · stdlib only
  prompt-enhancer    absent    python>=3.9 · stdlib only
  scale-routing      absent    python>=3.9 · stdlib only
  skill-creator      absent    python>=3.9 · stdlib only
  story-sizer        absent    python>=3.9 · stdlib only
  tech-graph         absent    python>=3.9 · stdlib only
  web-to-markdown    absent    python>=3.9 · 7 pinned      <- 6 + the new pytest pin
```

**Run 1 — a skill that ships `requirements.txt` installs exactly its own pins and nothing else.**

```
$ mewkit skill env figma
  ✓ created .meowkit/envs/figma
  ✓ PyYAML>=6.0.1
  ✓ 1 package(s) installed into .meowkit/envs/figma

$ grep -vE '^#|^$' .claude/skills/figma/scripts/requirements.txt   →  PyYAML>=6.0.1
$ .meowkit/envs/figma/bin/pip list --format=freeze                 →  pip==26.2.2
                                                                       PyYAML==6.0.3
```

`pip` is the venv bootstrap. No merged cross-skill set and no unpinned fallback — verified by name
against the three specs the deleted `DEFAULT_PIP_PACKAGES` used to install, plus one more skill's pin:

```
  requests absent ✓   google-genai absent ✓   pillow absent ✓   python-dotenv absent ✓
```

**Run 2 — a skill with no `requirements.txt` gets a stdlib-only env: created, interpreter present, zero
packages, exit 0.**

```
$ mewkit skill env evaluate
  ✓ created .meowkit/envs/evaluate
  ✓ no requirements file — standard library only, nothing to install
exit=0
$ .meowkit/envs/evaluate/bin/pip list --format=freeze  →  pip==26.2.2   (nothing else)
$ ls .meowkit/envs/evaluate/bin/python3                →  present
```

**Run 3 — repair after the interpreter is deleted, exit 0.**

```
$ rm .meowkit/envs/figma/bin/python3        # directory survives, interpreter does not
$ mewkit skill env figma
  ✓ repaired .meowkit/envs/figma
  ✓ 1 package(s) installed into .meowkit/envs/figma
exit=0
```

**Run 4 — an unknown skill exits non-zero, naming it and listing the valid set.**

```
$ mewkit skill env no-such-skill
No such skill: no-such-skill
Skills that need an environment: confluence, evaluate, figma, jira, llms, multimodal,
  planning-engine, prompt-enhancer, scale-routing, skill-creator, story-sizer, tech-graph, web-to-markdown
exit=1
```

**Run 5 — a skill that declares no runtime exits non-zero saying so.**

```
$ mewkit skill env cook
Skill cook declares no requires_runtime and pins no packages, so it needs no environment.
exit=1
```

**A requirements line that fails package-name validation is rejected and reported, never installed.**

```
$ printf 'PyYAML>=6.0.1\n--extra-index-url https://evil.invalid/simple\n' > .../figma/scripts/requirements.txt
$ mewkit skill env figma
Rejected 1 requirement line(s) in .claude/skills/figma/scripts/requirements.txt:
  --extra-index-url https://evil.invalid/simple
Fix the pin, then re-run. Nothing was installed.
exit=1
```

**The figma and web-to-markdown CI commands run against the new envs with no blanket install present** —
this is what the two new pin files buy:

```
$ .meowkit/envs/figma/bin/python3 .claude/skills/figma/evals/validate-evidence-packets.py
PASS interaction-modal / responsive-grid / spec-conflict / static-card / negative structural cases
exit=0

$ .meowkit/envs/web-to-markdown/bin/python3 -m pytest tests/test_safe_url.py tests/test_e2e_offline.py -q
33 passed in 2.05s
```

**No install call site is reachable from hook time.** Grepped every hook entrypoint, the dispatcher and
every handler for `pip install`, `-m venv`, `installPipPackages` and `ensureEnv`: zero hits. The only
subprocess call sites under `.claude/hooks/` are git, `npx vitest|jest`, `npm test`, `swift test`,
`pytest` (a test runner, behind a marker-file check) and `node` — no installer among them.

**The merge path and the unpinned fallback are gone from every code path, not just `skill env`:**

```
DEFAULT_PIP_PACKAGES     0 hits in packages/mewkit/src
getRequirementsSource    0 hits
findRequirementsFiles    0 hits (outside the bundled projections, now also updated)
ensureVenv               0 hits
getVenvPythonPath        0 hits
getPipPath               0 hits
```

`core/skills-dependencies.ts` keeps only name validation and display; reading ONE skill's pins is
`readSkillRequirements` in the new `core/skill-env.ts`. The four former call sites are repointed:
`commands/setup-steps.ts` (new `skill-envs` step), `commands/init.ts` (creates nothing now),
`commands/doctor-checks.ts` (verifies only envs that exist) and `lib/system-deps-registry.ts` (D7).

## AC-03 — `mewkit setup` is optional and idempotent

**Core verbs succeed without `setup` having run** — `doctor` and `validate --packs` both exit 0 on this
tree, which has never had the new `setup` run against it. (The full 23-verb sweep is AC-10, batch 5.)

**First run exits 0; second run exits 0 with every configuring step reporting skip:**

```
run 1:  ○ skill-envs: No skills selected — pass --skills=<a,b> or run `mewkit skill env <skill>`
        ✓ mcp / ✓ env / ✓ gitignore
        ! project-context: Run `/mk:project-context init` in your first session
        Summary: 3 configured, 1 skipped, 1 warnings   exit=0

run 2:  ○ skill-envs / ○ mcp / ○ env / ○ gitignore
        ! project-context: (same advisory)
        Summary: 0 configured, 4 skipped, 1 warnings   exit=0
```

**Byte-identical project tree across the two runs** (recursive sha256 manifest, excluding
`.meowkit/envs/` contents):

```
$ diff manifest-after-run-1 manifest-after-run-2
BYTE-IDENTICAL ✓
```

Note on the wording "every step reporting `skip`": `project-context` reports `warn` on both runs. It
configures nothing — it is a standing advisory to run `/mk:project-context` in the first session — and it
is identical between runs, so the tree is unchanged. Flagging it rather than claiming all-skip.

**`setup` creates no env for a skill the user did not select:**

```
$ ls .meowkit/envs   → absent ✓
$ ls .claude/skills/.venv → absent ✓
```

**`setup` with exactly one skill selected installs exactly that skill's pins:**

```
$ mewkit setup --only=skill-envs --skills=figma
  ✓ skill-envs: created figma; installed figma (1)
$ ls .meowkit/envs                                  → figma     (only)
$ .meowkit/envs/figma/bin/pip list --format=freeze   → pip, PyYAML==6.0.3
  requests absent ✓  google-genai absent ✓  pillow absent ✓  python-dotenv absent ✓
```

**`setup` in a no-python environment exits 0, creates no env, and says what it skipped and why:**

```
$ env PATH=<empty dir> node .../index.js setup --skills=figma,multimodal
  ○ skill-envs: No Python interpreter in PATH — skipped figma, multimodal; install Python, then re-run
  Summary: 0 configured, 4 skipped, 1 warnings
exit=0
$ ls .meowkit/envs        → absent ✓
$ ls .claude/skills/.venv → absent ✓
```

## AC-05 — A missing env produces an exact, copy-pasteable remediation

Every documented Python invocation now goes through `.claude/scripts/skill-python.cjs`, which derives the
skill from the script path, resolves that skill's env, and on absence prints the remediation and exits
non-zero without starting Python at all. All three required states:

**State 1 — env absent:**

```
[multimodal] no interpreter environment

multimodal needs its own environment at .meowkit/envs/multimodal. Create it with:

    mewkit skill env multimodal

This command installs only the packages multimodal pins. It is never run for you.
exit=1
```

**State 2 — env directory exists but its interpreter is missing:** same message shape, different first
line (`[figma] environment present but its interpreter is missing`), exit 1.

**State 3 — no python on PATH at all:** the message additionally names the requirement read from
`requires_runtime`:

```
[story-sizer] no interpreter environment

No Python interpreter is installed, and story-sizer requires python>=3.9.
Install it, then run:

    mewkit skill env story-sizer
exit=1
```

No traceback and no stack trace in any state — the resolver never invokes an interpreter when one is
missing. The happy path execs correctly, both by script path and via `--skill <name> -m <module>`.

`requires_runtime: [python>=3.9]` is declared on exactly the 12 skills in the contract's Definitions
list and on no other skill (the schema property and its enforcing validator are AC-06, batch 4).

## AC-02 — No shared venv is created; envs live under `.meowkit/envs/` and are ignored

```
$ ls .meowkit/envs                     → evaluate  figma  web-to-markdown
$ git status --porcelain | grep envs   → (nothing)
$ git check-ignore -v .meowkit/envs/figma/bin/python3
  .gitignore:89:.meowkit/envs/   .meowkit/envs/figma/bin/python3
$ grep -n "meowkit/envs" .gitignore .meowkit/gitignore.meowkit
  .gitignore:89:.meowkit/envs/
  .meowkit/gitignore.meowkit:25:.meowkit/envs/
```

The shared-venv ignore line was removed from both files in the same edit, since nothing creates that path
any more. Neither `setup`, nor `init`, nor `skill env`, nor any hook creates `.claude/skills/.venv` —
verified in the scratch runs above. See the AC-02 note at the top of this file for the 10 authored files
whose grep hits are batch-4 work, and for the pre-existing leftover venv directory in this tree.

## AC-13 — Skills that install binaries, not just packages, keep working

```
jira        .claude/skills/jira/scripts/jira-as.sh:12
            JIRA_AS="$ROOT/.meowkit/envs/jira/bin/jira-as"          (never from PATH)
confluence  .claude/skills/confluence/scripts/confluence-as.sh:13
            CONFLUENCE_AS="$ROOT/.meowkit/envs/confluence/bin/confluence-as"
            .claude/commands/mk/confluence-setup.md:11 → .meowkit/envs/confluence/bin/confluence-as
playwright  lib/system-deps-registry.ts — all platform variants, via one constant:
            detect:  `${PLAYWRIGHT_ENV_REL}/bin/python3 -c 'import playwright'`
            darwin:  `${PLAYWRIGHT_ENV_REL}/bin/pip install playwright==1.58.0`, `.../playwright install chromium`
            linux:   (same two)
            win32:   `${PLAYWRIGHT_ENV_WIN}\Scripts\pip install ...`, `...\Scripts\playwright install chromium`
            where PLAYWRIGHT_ENV_REL = `.meowkit/envs/web-to-markdown`
```

None of the three resolves to `.claude/skills/.venv` (grepped; `packages/mewkit/src/` is clean).

With the env absent, the jira wrapper produces the AC-05-shaped message rather than a shell error:

```
$ bash .claude/skills/jira/scripts/jira-as.sh --help
[jira] jira-as not installed at <root>/.meowkit/envs/jira/bin/jira-as
[jira] Run: mewkit skill env jira
[jira] That installs only what .claude/skills/jira/scripts/requirements.txt pins.
exit=127
```

## Batch 3 verification

```
$ npm run build            → OK
$ npm run typecheck        → 0 errors
$ npm run lint             → 0 errors, 3 warnings (all pre-existing, untouched)
$ npx vitest run           → 248 files, 2878 tests, all pass
$ node --test .claude/hooks/__tests__/*.test.cjs → 36 pass, 0 fail
$ npx vitest run packages/mewkit/src/migrate     → 74 files, 953 tests, all pass
$ mewkit doctor            → exit 0, 14 passed, 3 warnings
$ mewkit validate --packs  → exit 0
```

`doctor`'s two reworked rows, on a tree with 3 of 13 envs provisioned:

```
[PASS] Skill environments   3/13 provisioned under .meowkit/envs (created on demand)
[PASS] Skill packages       8 pinned package(s) verified across 3 env(s)
[PASS] Python (optional)    Python 3.15.2
```

"Absent" is a PASS for both: envs are created on demand, so a project with none is correctly configured,
and a skill with no env is not missing packages — it is a skill nobody has asked for. `checkPython` is
advisory and can no longer FAIL (it used to FAIL below 3.9, telling every user of a Python-free project
to fix something that was not broken).

## AC-14 — the three already-over-200 files that grew, recorded by name

Per the coordinator's ruling: "grows past 200" means *crosses* 200. Nothing crosses it. These three were
already over 200 at BASE and grew; recorded by name as instructed, not restructured.

| File | BASE | Now | Delta | Why it grew |
|---|---|---|---|---|
| `.claude/skills/web-to-markdown/scripts/persist_fetch.py` | 353 | 383 | +30 | the importlib loader became a subprocess bridge with a typed finding |
| `.claude/skills/story-sizer/scripts/check-auto-create-gating.py` | 263 | 290 | +27 | a dead probe became a real, best-effort invocation |
| `packages/mewkit/src/commands/doctor-checks.ts` | 361 | 366 | +5 | three diagnostic rows reworded and rescoped |

The two `.py` files also exist as codex and cursor bundle mirrors, which grew identically.

## Batch 3 open questions

1. **AC-04 / AC-06 / AC-13 three-way conflict on `jira`, and the reading I chose.** `jira` installs a
   *binary* (`jira-as`) from its pins and ships no `.py`. AC-13 requires `mewkit skill env jira` to
   work. AC-04 says a skill with no `requires_runtime` must exit non-zero. AC-06 says *exactly* the 12
   skills in the Definitions list declare `requires_runtime` — and `jira` is not one of them. Declaring
   it on `jira` fails AC-06; not declaring it fails AC-13 under AC-04's rule as literally worded.
   I did **not** reinterpret silently: eligibility for an environment is "declares `requires_runtime`
   **or** pins packages" (`envSkills`), so `skill env jira` works, `requires_runtime` still means "this
   skill runs Python" and stays on exactly 12 skills, and AC-04's non-zero exit still fires for a skill
   with neither (verified above with `cook`). This is the only reading under which none of the three ACs
   fails. **Confirm it, or tell me which AC to treat as controlling.**

2. **AC-05 does not hold inside the codex/cursor projections.** The resolver lives at
   `.claude/scripts/skill-python.cjs`, and the projections ship no kit `scripts/` directory — the codex
   reference-integrity validator rejected `.codex/scripts/skill-python.cjs` as a fabricated target (its
   own source comment warns about exactly this: "rewriting these blindly FABRICATES targets"). So in the
   bundles the invocation names the skill's interpreter directly
   (`.meowkit/envs/<skill>/bin/python3 <script>`), which is truthful and makes the migrate suite green,
   but a projection user whose env is missing gets a shell "no such file" rather than the AC-05 message.
   Fixing it properly means teaching the codex/cursor emitters to ship the resolver — that is AC-11's
   surface, so I left it for batch 5 rather than widen this batch. Flagging because it is a real gap in
   AC-05's coverage, not a cosmetic one.

3. **`setup`'s `--skills` flag.** AC-03's verification requires "`setup` with one skill selected", which
   needs a way to select. I added `--skills=<a,b>` (declared in the command catalogue, so `--help` and
   the generated CLI docs stay in sync). It is not a new verb and cannot re-enable a shared venv, but it
   is a new flag — confirm that is within Scope (Out)'s "no new verb beyond `skill env` and
   `plan check --structural`".

4. **`STEPS` keys changed.** `venv` and `deps` are replaced by one `skill-envs` step, so
   `mewkit setup --only=venv` and `--only=deps` no longer exist. Scope (In) says those two steps are
   "repointed to per-skill envs", which I read as permitting the rename; any external doc that still says
   `--only=venv` would be stale. I found and updated the ones inside this repo.

---
---

# Batch 4 — AC-06, AC-09, D3, D8, and AC-02's final grep

This batch takes AC-06 and AC-09 from PENDING to MET, closes D3 and D8, and clears the
last 10 grep hits AC-02 was waiting on. AC-10, AC-11 and AC-15 remain as noted below.

## AC-02 — the final grep is now clean

```
$ grep -rln "skills/\.venv" .claude scripts packages/mewkit/src | grep -v worktrees
scripts/prepare-release-assets.cjs
scripts/check-hook-registration.sh
scripts/telemetry-decisions.py
```

Exactly the three exemptions the contract names, and nothing else. The 10 files batch 3
listed are gone from the result: the 6 `trace-analyze` and 3 `benchmark` files are ported
(D8, below) and `.claude/scripts/tests/test-validate-skill-frontmatter.py` is deleted (D5).
The leftover `.claude/skills/.venv/` directory is also gone from this working tree:

```
$ ls -d .claude/skills/.venv
ls: .claude/skills/.venv: No such file or directory
```

AC-02's other clauses were established in batch 3 and are unchanged. **AC-02: MET.**

## D8 — `trace-analyze` and `benchmark` lose their Python JSON parses

Nine files used venv Python purely as a `jq` replacement. All nine now call node.

**`trace-analyze` — 6 files.** The inline `python3 -c` blocks in the step docs are replaced
by one node CLI with six subcommands, so the parsing lives in code that can be run and
tested rather than in prose:

| New file | Lines | Role |
|---|---|---|
| `.claude/skills/trace-analyze/scripts/trace-records.cjs` | 107 | `ingest`, `partition`, dispatch |
| `.claude/skills/trace-analyze/scripts/lib/pattern-synthesis.cjs` | 90 | `count`, `synthesize`, `threshold`, `cross-batch` |
| `.claude/skills/trace-analyze/scripts/lib/json-io.cjs` | 62 | JSON/JSONL read + write helpers |

Repointed doc sites: `step-01-ingest.md` §1c, `step-02-partition.md` §2a,
`step-03-scatter-analysis.md` §3d, `step-04-gather-synthesis.md` §4a/§4b/§4c,
`references/trace-schema.md` → Reading Records, `SKILL.md` Hard Constraint 3 (which stated
the `.venv` path as the project's JSON-parsing rule and now names the node script).

End-to-end run over a crafted log (3 valid records in 2 runs plus one record at an unknown
`schema_version`):

```
$ trace-records.cjs ingest log.jsonl $S 20
WARN: skipping unknown schema_version: 2.0
Ingested 3 records across 2 runs
$ trace-records.cjs partition $S
Found 2 distinct runs
Batch 1: 1 runs, 2 records
Batch 2: 1 runs, 1 records
BATCH_COUNT=2
$ trace-records.cjs count $S/batch-1-findings.json 1
Batch 1: 2 pattern(s) detected
$ trace-records.cjs synthesize $S
Aggregated 2 unique patterns across 4 run-incidences
$ trace-records.cjs threshold $S 3
Threshold filter: 1 patterns kept, 1 dropped (occurrences < 3)
Dropped patterns:
  - p2: 1 occurrences
$ trace-records.cjs cross-batch $S
Cross-batch patterns (high signal):
  - p1: appears in batches [1, 2]
```

The `WARN: skipping unknown schema_version` line, the `BATCH_COUNT=` line and every
summary sentence keep the wording the step docs tell the agent to read.

**`benchmark` — 3 shell scripts.** Each `"$PY" -c`/heredoc block became a node module
invoked with the same env-var prelude (dynamic values stay in the environment, so a spec
filename containing a quote still cannot reach the parser as code):

| New file | Lines | Replaces |
|---|---|---|
| `scripts/lib/render-run-delta.cjs` | 82 | `compare-runs.sh` delta table |
| `scripts/lib/check-cost-cap.cjs` | 35 | `run-canary.sh check-cap` |
| `scripts/lib/write-run-manifest.cjs` | 26 | `run-canary.sh` manifest write |
| `scripts/lib/write-audit-artifact.cjs` | 52 | `git-index-audit.sh` artifact + trace JSON |

Behaviour against the BASE scripts:

```
$ compare-runs.sh a b
# Benchmark Comparison: a vs b
**Run A:** a (quick, model: m1)
**Run B:** b (quick, model: m2)
> Model differs between runs — model upgrade is a confounding variable.
| Task | Run A | Run B | Δ score | Δ cost |
|---|---|---|---|---|
| t1 | 0.80 | 0.90 | +0.10 | +$0.20 |
| t2 | PENDING | 0.50 | — (PENDING — excluded from average) | — |
| **AVG** | 0.80 | 0.90 | +0.10 | — |
```

The PENDING guard still distinguishes a null score from a valid 0 and still excludes it
from the average. Cost cap, both branches:

```
$ run-canary.sh check-cap ledger.jsonl 5     → HALT: cost cap reached: $6.00 >= $5.00   exit=2
$ run-canary.sh check-cap ledger.jsonl 50    → OK: $6.00 of $50.00                      exit=0
```

`git-index-audit.sh` is covered by its own committed suite, which passes unchanged:

```
$ bash tests/git-index-audit.test.sh
  ok   identical repos: equal hashes, 0/0, diff clean
  ok   divergent repos: differing path hash, local_only=1, diff not clean
  ok   single-repo mode: valid JSON, comparison null, counts>0
  ok   non-git path → exit non-zero
  ok   sha256 is bare 64-hex (no trailing -/filename)
passed: 5  failed: 0
```

Neither skill needs `requires_runtime`, which is what D8 exists to make true.

```
$ grep -rn "venv\|python" .claude/skills/benchmark/ .claude/skills/trace-analyze/
(no matches)
```

## D3 — `validate-plan.py` becomes `mewkit plan check --structural`

The phase-05 premise "the core workflow works with no Python" was false at BASE because
`plan-creator/step-04-semantic-checks.md` made the Python structural validator a mandatory
step for every planning mode except `fast` and `product-level`. It is TypeScript now:

| New file | Lines | Role |
|---|---|---|
| `packages/mewkit/src/core/check-plan-structure.ts` | 127 | `plan.md` checks + phase orchestration + the verdict line |
| `packages/mewkit/src/core/plan-phase-structure.ts` | 159 | one phase file: 12 sections, checkboxes, frontmatter severity split |

Wired at `commands/plan.ts` as `plan check --structural <plan.md>`, declared in the command
catalogue so `--help` and the generated CLI docs stay in sync. `plan check <phase-file>`
(the pre-existing 5-section report) is untouched.

**Differential against the deleted validator.** The oracle was recorded with a
dependency-equipped interpreter BEFORE the deletion, over all 8 committed plan-creator
fixtures plus this sprint's own plan (a real plan with 8 phase files, 4 errors and 8
warnings — the only input that exercises the WARN path, the ERROR path and the ordering
between them at once). The TS port reproduces all 9 outputs **byte for byte**, verdict
line, issue order, message text, pluralisation and exit code:

```
legacy-v1-5             PLAN_COMPLETE (3 phase files validated)                 exit=0
modernized-v1-6         PLAN_COMPLETE (3 phase files validated)                 exit=0
partial-v1-6            PLAN_COMPLETE (3 phase files validated)                 exit=0
interrupted-sweep-v1-6  PLAN_COMPLETE (3 phase files validated)                 exit=0
handoff-invalid-enum    PLAN_INCOMPLETE: 1 error(s), 0 warning(s)               exit=1
                          - plan.md: handoff.next 'rm -rf /' not in ['autobuild', 'cook', 'end', 'red-team', 'validate']
deep-plan               PLAN_COMPLETE (1 phase file validated)                  exit=0
tdd-plan                PLAN_COMPLETE (1 phase file validated)                  exit=0
deep-tdd-plan           PLAN_COMPLETE (1 phase file validated)                  exit=0
```

```
$ mewkit plan check --structural tasks/plans/261101-meowkit-v3-lean-runtime/plan.md
PLAN_INCOMPLETE: 4 error(s), 8 warning(s)
  - WARN phase-01-context-diet.md: missing or malformed frontmatter (legacy compat — add per phase-template.md)
  ... (identical to the recorded output, all 12 lines, same order)
exit=1
```

The committed fixture suite now drives the CLI instead of the interpreter and passes:

```
$ bash tests/fixtures/plan-creator/validate-fixtures.sh
PASS     legacy-v1-5 … PASS deep-tdd-plan
Summary: 8 passed, 0 failed
```

**Deleted:** `.claude/skills/plan-creator/scripts/validate-plan.py`.

**Referrers repointed (9 files, as D3 requires):** `step-04-semantic-checks.md:45,55`,
`SKILL.md` (the `handoff.next` note; the script's table row is removed with the script),
`workflow.md:27,112`, `references/task-management.md`, `references/verification-roles.md`
(×2), `references/phase-template.md`, `references/output-standards.md`,
`references/plan-intake-packet.md` (×2), `validate-plan/SKILL.md` (the
"not the same as" disambiguation), plus `tests/fixtures/plan-creator/validate-fixtures.sh`
and three docs-site pages (`guide/task-system.mdx`, `reference/templates/index.mdx`,
`reference/skills/validate-plan.mdx`). Changelog and journal entries are history and are
left alone.

`plan-creator` therefore stops being a Python skill, which `skill env --list` confirms —
it is no longer eligible for an environment at all (it declares no runtime and pins
nothing).

## AC-06 — `requires_runtime` is declared, schema-enforced, and distinct from `runtime`

**Then (1): an explicit schema property with a pinned value shape.**
`git diff BASE -- .claude/schemas/skill-schema.json` is `1 file changed, 10 insertions(+)`
— the new property and nothing else. The shape is a non-empty unique array of
`<interpreter><comparator><version>` strings:

```
"pattern": "^(python|python3|node|ruby|php|perl|go|java|deno|bun)(>=|<=|==|~=|>|<)[0-9]+(\\.[0-9]+)*$"
```

**Then (2): exactly the Definitions list declares it, and no other skill does.**

```
$ grep -l "^requires_runtime:" .claude/skills/*/SKILL.md | wc -l
12
confluence evaluate figma llms multimodal planning-engine prompt-enhancer
scale-routing skill-creator story-sizer tech-graph web-to-markdown
```

Set-equal to the contract's closed list of 12. `jira` is absent, per the batch-3 ruling
(environment eligibility is "declares `requires_runtime` **or** pins packages", so
`skill env jira` works while the declaration keeps meaning "this skill runs Python").

**Then (3): the enforcing validator, ported to TypeScript (D5).**

| New file | Lines | Role |
|---|---|---|
| `packages/mewkit/src/core/check-skill-frontmatter.ts` | 151 | walk, parse, severity split, advisories |
| `packages/mewkit/src/core/skill-runtime-contract.ts` | 96 | both field confusions + documented-`.py` detection |
| `packages/mewkit/src/core/json-schema-lite.ts` | 157 | draft-07 subset: exactly the keywords the kit's schemas use |

No JSON-schema library is in the dependency tree and adding one to validate a 40-property
schema was not worth it; the subset checker is deliberately narrow, so a schema that
reaches for an unsupported keyword fails loudly here instead of being silently ignored —
which is what a permissive validator does, and precisely how this contract could drift
unnoticed before.

Exposed as `mewkit validate --frontmatter` (a scoped flag like `--gates`/`--packs`, not a
new verb), declared in the command catalogue.

**Then (4): the four crafted fixtures.** All four are committed vitest cases, not
one-off manual runs:

| Fixture | Expected | Actual |
|---|---|---|
| interpreter value in `runtime` (`runtime: python`) | FAIL | `'runtime: python' names an interpreter — use 'requires_runtime' for that` |
| provider value in `requires_runtime` (`["claude-code"]`) | FAIL | `'requires_runtime: claude-code' names an execution environment — use 'runtime' for that` |
| documented `.py` with no `requires_runtime` | FAIL | `ships scripts/do-thing.py on its documented path but declares no 'requires_runtime'` |
| the unmodified tree | PASS | `125 skill(s) validated`, 0 errors, 0 warnings |

The runtime contract runs BEFORE the schema on purpose. A field confusion also trips the
schema's own enum or pattern, and that generic message ("`'python'` is not one of
`'claude-code'`, …") is exactly the one that leaves an author guessing which of the two
fields they wanted.

The third rule needs a definition of "documented invocation path", and the one used is
narrow on purpose: a non-test `.py` that exists AND is named by the skill's own markdown.
A `.py` nothing documents is not something a user is told to run, so it does not oblige a
declaration — and the rule still caught the real case it exists for, `plan-creator`, which
was the single failure on the first run against the tree:

```
$ mewkit validate --frontmatter      # before D3's deletion
  [FAIL] Skill frontmatter
         .claude/skills/plan-creator/SKILL.md: ships scripts/validate-plan.py on its
         documented path but declares no 'requires_runtime'
```

After the deletion:

```
$ mewkit validate --frontmatter
  [PASS] Skill frontmatter
         125 skill(s) validated against skill-schema.json
1 passed
```

**Then (5): `runtime` is unchanged on all 125 SKILL.md files, values included.**

```
$ grep -h "^runtime:" .claude/skills/*/SKILL.md | sort | uniq -c
 118 runtime: claude-code
   7 runtime: portable
$ ls .claude/skills/*/SKILL.md | wc -l
125
```

Matches the contract's stated 118/7 split, and no `runtime:` line appears in
`git diff BASE` for any SKILL.md.

**Parity with the validator it replaces.** Before deleting it, the Python validator was
run under a dependency-equipped interpreter: `OK: 125 skill(s) validated`, exit 0, zero
warnings. The TS port reports the same 125 and the same zero warnings, so the port is not
passing by checking less.

**AC-06: MET.**

## AC-09 — ports/scope-outs complete, and CI drops the shared venv

### The three-way table, one row per `.py` classified hook-called or CI-called

| File (at BASE) | Disposition | Where |
|---|---|---|
| `.claude/hooks/ensure-skills-venv.sh` | (b) deleted — bootstrap removed | AC-01, batch 1 |
| `.claude/scripts/injection-audit.py` | (a) ported to node | AC-07, batch 2 |
| `.claude/scripts/bin/workflow-config` (bash+python) | (a) ported to node | AC-08, batch 2 |
| `.claude/scripts/bin/meowkit-config` | (b) deleted — duplicate of the above | AC-08, batch 2 |
| `.claude/skills/plan-creator/scripts/validate-plan.py` | (a) ported to TS | D3, this batch |
| `scripts/validate-skill-frontmatter.py` | (a) ported to TS | AC-06, this batch |
| `.claude/scripts/check-docs-references.py` | (b) deleted — TS twin already a CI step | D5, this batch |
| `.claude/scripts/tests/test-check-docs-references.py` | (b) deleted with its subject | D5, this batch |
| `.claude/scripts/tests/test-validate-skill-frontmatter.py` | (b) deleted; assertions re-homed | D5, this batch |
| `multimodal/scripts/tests/run_tests.py` | (c) Scope (Out), D5 — skill-owned Python test suite | stays Python |
| `figma/evals/validate-evidence-packets.py` | (c) Scope (Out), D5 — skill-owned | stays Python |
| `web-to-markdown/tests/test_safe_url.py`, `test_e2e_offline.py` | (c) Scope (Out), D5 — skill-owned | stays Python |
| `scale-routing/eval/run-routing-eval.py` | (c) Scope (Out), D5 — skill-owned | stays Python |
| `tests/journey-validation/check-journey-specs.py` | (c) Scope (Out), D10 — repo-dev, no owning skill | stays Python, non-venv interpreter |
| `.claude/scripts/{validate,security-scan,checklist,cost-report,validate-docs,check-anthropic-context}.py` | (c) Scope (Out), D6 — not hook-called | untouched, flagged for phase 07 |
| `scripts/check-hook-registration.sh` (python3 JSON parse) | (c) Scope (Out), D10 — repo-dev | untouched |
| `scripts/telemetry-decisions.py` | (c) Scope (Out), D10 — repo-dev | untouched |
| `.claude/scripts/lint-brand-prose.sh` → `check-anthropic-context.py` | (c) Scope (Out), D10 — repo-dev | untouched |

Every row is (a), (b) or (c). No fourth category and no file unaccounted for.

### `ci.yml` after the rewrite

```
$ grep -n "venv\|python" .github/workflows/ci.yml
107:          node .claude/scripts/skill-python.cjs .claude/skills/multimodal/scripts/tests/run_tests.py
112:          node .claude/scripts/skill-python.cjs .claude/skills/figma/evals/validate-evidence-packets.py
117:          node .claude/scripts/skill-python.cjs --skill web-to-markdown -m pytest \
133:          node .claude/scripts/skill-python.cjs .claude/skills/scale-routing/eval/run-routing-eval.py
141:        run: python3 tests/journey-validation/check-journey-specs.py
```

No `.claude/skills/.venv` string anywhere in the file, and no `python3 -m venv` step: the
`Setup Python venv` step with its blanket `pip install pyyaml jsonschema pytest` is gone.

Each surviving skill-owned Python step now creates that skill's own environment from that
skill's own pins and runs through the resolver, so a step can no longer pass because some
earlier step installed something for it. All four verified locally:

```
$ mewkit skill env figma            → ✓ 1 package(s) installed into .meowkit/envs/figma
$ skill-python.cjs …figma/evals/validate-evidence-packets.py  → PASS × 4   exit=0
$ mewkit skill env multimodal       → ✓ 3 package(s) installed into .meowkit/envs/multimodal
$ skill-python.cjs …multimodal/scripts/tests/run_tests.py     → 3/3 passed exit=0
$ mewkit skill env web-to-markdown  → ✓ 7 package(s) installed into .meowkit/envs/web-to-markdown
$ skill-python.cjs --skill web-to-markdown -m pytest …         → 33 passed exit=0
$ mewkit skill env scale-routing    → ✓ no requirements file — standard library only
$ skill-python.cjs …scale-routing/eval/run-routing-eval.py     → PASS 11/11 exit=0
$ python3 tests/journey-validation/check-journey-specs.py      → PASS 12 journeys exit=0
```

The web-to-markdown step is the one that proves the point: `-m pytest` used to work only
because of the blanket install. `pytest>=8.0.0` is pinned in that skill's own
`requirements.txt` (Scope (In)), and `figma`'s `pyyaml` pin likewise — both new pins now
carry a CI step that would fail without them.

The two validator steps are node:

```
      - name: Validate skill frontmatter
        run: node packages/mewkit/dist/index.js validate --frontmatter
      - name: Validate docs references on Type-1 allowlist
        run: node packages/mewkit/dist/index.js validate --docs-refs
```

`--docs-refs` is a new scoped flag over the already-wired `core/check-docs-references.ts`;
the TS check was reachable only from the full `validate` run, which is not a CI step and
has 25 pre-existing failures (see the open question below), so scoping it was the only way
to make the node check the CI step.

```
$ mewkit validate --docs-refs
  [PASS] Docs references on Type-1 allowlist
```

The two Python *unit-test* steps are deleted rather than replaced: their subjects no longer
exist, and their assertions now live in vitest, which `npm test` already runs. Every
assertion the deleted `test-validate-skill-frontmatter.py` made is present and passing:

| Deleted Python assertion | Re-homed as |
|---|---|
| `test_env_body_without_field_warns` | "warns when a body names an external-service env var and the field is absent" |
| `test_jira_leaf_marker_without_field_warns` | "warns on the owner/agent marker path with no env var in the body" |
| `test_strict_promotes_warning_to_error` | "reports advisories as WARN, which is what --strict promotes to a failure" |
| `test_annotated_skill_no_warning` | "stays silent for a fully annotated skill" |
| `test_requires_present_default_absent_warns` | "warns when requires_external_service is present but default_enabled is not" |
| `test_plain_skill_no_tool_contract_warning` | "leaves a plain skill alone" |
| `test_schema_validates_new_fields` | "accepts the advisory tool-contract fields" |
| `test_schema_rejects_unknown_dependency_edge_type` | "rejects an unknown dependency edge type" |

```
$ npx vitest run packages/mewkit/src/core/__tests__/check-skill-frontmatter.test.ts \
                 packages/mewkit/src/core/__tests__/skill-runtime-contract.test.ts
 ✓ check-skill-frontmatter.test.ts (8 tests)
 ✓ skill-runtime-contract.test.ts (6 tests)
 Tests  14 passed (14)
```

Like the Python original they build a throwaway project root around the REAL
`skill-schema.json` (copied, not stubbed), so a schema edit that breaks a frontmatter
contract fails these tests instead of passing against a fixture nobody updated.

**Then (4): the four files no longer exist and nothing references them.**

```
$ ls scripts/validate-skill-frontmatter.py .claude/scripts/check-docs-references.py \
     .claude/scripts/tests/
No such file or directory  (all three paths; .claude/scripts/tests/ is removed entirely)
$ grep -rn "validate-skill-frontmatter\|check-docs-references\.py" \
    .claude .github scripts docs packages CLAUDE.md | grep -v changelog
(no matches)
```

`core/docs-reference-contract-paths.ts` loses the `scripts/check-docs-references.py`
allowlist entry and the "byte-identical to the Python twin" comment; `ci.yml:202,205,208,211`
are the four steps rewritten above. Prose sites repointed to the live checks:
`CLAUDE.md`, `docs/governance/rules-index.md` (×2), `docs/core/ecosystem-harness.md`,
`docs/maintainer/docs-reference-contract.md` (×3),
`skill-creator/references/skill-authoring-rules.md` (×3),
`packages/docs/content/docs/reference/rules-index.mdx`.

**AC-09: MET.**

## AC-14 — code quality over this batch

**New files — all ≤200 lines:**

```
159  packages/mewkit/src/core/plan-phase-structure.ts
157  packages/mewkit/src/core/json-schema-lite.ts
151  packages/mewkit/src/core/check-skill-frontmatter.ts
146  packages/mewkit/src/core/__tests__/check-skill-frontmatter.test.ts
127  packages/mewkit/src/core/check-plan-structure.ts
107  .claude/skills/trace-analyze/scripts/trace-records.cjs
 99  packages/mewkit/src/core/__tests__/skill-runtime-contract.test.ts
 96  packages/mewkit/src/core/skill-runtime-contract.ts
 90  .claude/skills/trace-analyze/scripts/lib/pattern-synthesis.cjs
 82  .claude/skills/benchmark/scripts/lib/render-run-delta.cjs
 62  .claude/skills/trace-analyze/scripts/lib/json-io.cjs
 52  .claude/skills/benchmark/scripts/lib/write-audit-artifact.cjs
 35  .claude/skills/benchmark/scripts/lib/check-cost-cap.cjs
 32  packages/mewkit/src/core/__tests__/helpers/skill-tree-fixture.ts
 26  .claude/skills/benchmark/scripts/lib/write-run-manifest.cjs
```

The frontmatter test file was written as one 266-line file and split: the runtime-contract
cases moved to their own file and the fixture builder to a shared helper. Nothing was
dropped — the 14 cases are the same 14.

**Changed files already over 200 at BASE that this batch grew** (per the coordinator's
ruling, recorded by name, not restructured; nothing under 200 crossed 200):

| File | BASE | Now | Delta | This batch's share |
|---|---|---|---|---|
| `packages/mewkit/src/commands/validate.ts` | 896 | 951 | +55 | all of it: `checkFrontmatterContract` + the two scoped dispatches |
| `packages/mewkit/src/cli/command-catalogue.ts` | 293 | 301 | +8 | 3 of the flag rows (`--frontmatter`, `--docs-refs`, `--structural`) |
| `packages/mewkit/src/index.ts` | 455 | 469 | +14 | 3 lines (the three new option wirings) |

The other already-over-200 growers (`doctor-checks.ts`, `setup-steps.ts`,
`system-deps-registry.ts`, the two skill `.py` files) are batch 2/3's and recorded there.

**Greps over added lines:** `: any` 0 · `as any` 0 · `<any>` 0 · `@ts-ignore` 0 ·
`eslint-disable` 0 · TODO/FIXME 0 · commented-out code 0 · hardcoded secrets 0 ·
**new `child_process` call sites targeting `bash`/`sh`/a `.sh` file: none** — the only
subprocess call added anywhere is `skill-python.cjs`'s existing exec, untouched here.

Unused imports: the first draft of `json-schema-lite.ts` left a `TYPE_NAMES` const used
only as a type, which lint flagged; it is now an inline union. Lint is back to the 3
pre-existing warnings (`orient.ts` `path`, `validate.ts` `countFiles`) and 0 errors.

**Verification:**

```
$ npm run build            → OK
$ npm run typecheck        → 0 errors
$ npm run lint             → 0 errors, 3 warnings (all pre-existing)
$ npx vitest run           → 249 files, 2892 tests, all pass
$ npx vitest run tests/hooks tests/ports → 11 files, 228 tests, all pass
$ node --test .claude/hooks/__tests__/*.test.cjs → 36 pass, 0 fail
$ mewkit doctor            → exit 0, 14 passed, 3 warnings
$ mewkit validate --packs  → exit 0
$ bash tests/git-index-audit.test.sh → 5 passed, 0 failed
$ bash tests/fixtures/plan-creator/validate-fixtures.sh → 8 passed, 0 failed
```

`vitest` initially failed one case — `cli/__tests__/synopsis-drift.test.ts`, which asserts
the generated CLI docs match the command catalogue. The three new flags made it stale;
regenerated with `MEOWKIT_WRITE_SYNOPSIS=1`, which updated
`packages/docs/content/docs/cli/index.mdx`. That is the test doing its job, not a
workaround.

AC-12's sweep still returns 0:

```
$ find .claude \( -path "*hooks*" -o -path "*/bin/*" \) \( -name "*.sh" -o -name "*.py" \) \
    -not -path ".claude/skills/.venv/*" -not -path ".claude/worktrees/*" | wc -l
0
```

## Batch 4 open questions

1. **`validate --ownership` and `inventory --check` fail at BASE, and AC-10 requires them
   to exit 0.** This is a BLOCKER for AC-10, found while preparing batch 5, and it is
   **not** caused by this sprint. `.meowkit/harness-inventory.json` still lists all 18
   hook scripts under their old `.sh` names, and `core/build-inventory.ts:183` counts only
   `.sh` files as hooks (`if (!f.endsWith(".sh")) continue;`). After the sprint-3 node-hook
   port there are zero `.sh` hooks, so:

   ```
   $ mewkit validate --ownership   → exit 1 (18 × "[FAIL] Ownership: hooks/<name>.sh" + coverage)
   $ mewkit inventory --check      → exit 1 ("README.md (hook scripts): declared 18, found 0")
   ```

   `git diff a190cc91 -- .meowkit/harness-inventory.json packages/mewkit/src/core/build-inventory.ts
   packages/mewkit/src/core/check-stale-index.ts README.md` is **empty**, so all four inputs
   are exactly as BASE left them. Fixing it means changing the hook-counting predicate and
   regenerating the inventory and the README/HOOKS_INDEX counts — none of which is in this
   sprint's Scope (In), and README is not a file this contract touches. I did **not**
   expand scope to fix it. AC-10 cannot pass until it is fixed; tell me whether to fix it
   here or to file it as phase-02 follow-up work.

2. **`mewkit validate` (unscoped) has 25 pre-existing failures,** all of them the same
   drift as (1). That is why AC-09's docs-references CI step is `validate --docs-refs`
   rather than the full `validate` run — a full-run step would fail on day one for reasons
   unrelated to docs references. Flagging the flag as a design choice, not an omission.

3. **"Documented invocation path" needed a definition and I chose the narrow one.** AC-06's
   third fixture rule is "ships a `.py` in its documented invocation path without
   `requires_runtime`". I read that as: a non-test `.py` that exists AND whose basename
   appears in some markdown inside that same skill. A `.py` that no markdown mentions does
   not trip the rule. The alternative (any `.py` at all) would fire on vendored helpers and
   `evals/` fixtures that nobody is told to run. Confirm, or say which reading controls.

4. **`validate --frontmatter` is scoped-only, not part of the default `validate` run.**
   It matches `--gates`/`--packs`/`--memory` as a cheap CI invocation. I kept it out of
   `buildDefaultChecks` so this batch cannot change what the default run reports; adding it
   there is a one-line change if that is preferred.

5. **`validate --docs-refs` and `--frontmatter` are new flags, like batch 3's
   `setup --skills`.** Both are declared in the command catalogue (so `--help` and the
   generated CLI docs stay in sync) and neither is a new verb. Same confirmation request as
   batch 3's open question 3.

---
---

# Batch 5 — AC-11, and the AC-05 projection gap closed

This batch takes AC-11 from PARTIAL to MET and closes batch 3's open question 2 (AC-05 did
not hold inside the projections). **AC-10 is NOT done** — see the blocker at the end.

## AC-11 — Codex and Cursor projections follow, and both validators are green

### Method

`mewkit init` and `mewkit upgrade` were NOT run in or against this repo. The layouts were
generated by calling the built package's own reconcile/authored-bundle entrypoints into a
scratch directory, then validated with the repo's CLI from inside each generated layout.
Both bundles rebuilt into `dist/` first — the generator resolves the module dir out of
`dist/`, so a projection generated without a rebuild reflects the previous source (that
mistake happened once here and is why the first "no-python message" run below showed the
old text).

```
$ npm run build && node gen-targets.mjs <scratch>
codex conflicts 0
cursor conflicts 0
```

### Then (1): the migrate suite passes

```
$ npx vitest run packages/mewkit/src/migrate
 Test Files  74 passed (74)
      Tests  953 passed (953)
```

Four cases failed mid-batch and all four were characterization tests pinning the manifest
surface list, which the new entry changes by construction:
`codex-authored-bundle.test.ts` (two cases asserting the exact 9 target paths and
`overlay.writes === 9`), `cursor-full-surface-characterization.test.ts` (the "exactly 7
top-level managed surfaces" inventory) and `cursor-output-brand-free.test.ts`. The first
three are updated to 10 / 8 surfaces — they are tests whose whole job is to state the
manifest, so restating it is the change, not a workaround. The fourth was a real defect in
my first attempt and is discussed below.

### Then (2): no regenerated projection references the shared venv or a deleted `.py`

```
$ grep -rln "skills/\.venv\|validate-plan\.py\|injection-audit\.py\
\|check-docs-references\.py\|validate-skill-frontmatter\.py" <codex-layout> <cursor-layout>
(no matches)
```

Same grep over the committed bundle sources is also clean. Getting there needed the
batch-4 work mirrored into both bundles:

- **D8 in the bundles.** The 6 `mk-trace-analyze` doc sites and the 3 `mk-benchmark`
  shell scripts, per provider, now call the node scripts; the 7 new `.cjs` modules are
  added under each bundle's skill. At HEAD these bundle files still named
  `.agents/skills/.venv` / `.cursor/skills/.venv`, so this is what cleared the grep.
- **D3 in the bundles.** `mk-plan-creator/scripts/validate-plan.py` deleted from both,
  and the same 9 referrer sites repointed to `npx mewkit plan check --structural` (which
  is provider-neutral, so the projections need no variant).
- **`requires_runtime` in the bundles.** Declared on the same closed list of 12 skills in
  both, which is what makes the clause below work.

**A process note worth recording.** The first attempt mirrored the kit files into the
bundles wholesale. That is wrong and the diff showed why: it replaced the projections'
frontmatter form (`name: "mk-trace-analyze"` + description only), reintroduced
`/mk:` slash references, `subagent`, and `AskUserQuestion` — every denied token the
projections exist to remove. Those 18 files were restored from git and the edits reapplied
**surgically**, replacing only the code blocks D8 targets and leaving every provider
rewrite intact. The target validators confirm it:
`Codex installed skills tool-token clean` PASS, `cursor output is brand-free` PASS.

### Then (3): both validators report no failure

```
$ cd <codex-layout> && mewkit validate --target codex
  [PASS] Codex AGENTS.md present              [PASS] Codex agent name uniqueness
  [PASS] Codex config.toml parses             [PASS] Codex root reference graph
  [PASS] Codex config.toml secret-free        [PASS] Codex exec-policy rules valid
  [PASS] Codex hooks.json parses              [PASS] Codex installed skills parse
  [PASS] Codex hook wrappers exist + exec     [PASS] Codex installed skills runtime-supported
  [WARN] Codex hook deny contract             [PASS] Codex installed skills tool-token clean
  [PASS] Codex agent TOMLs parse              [PASS] Codex no native memory surface
  [PASS] Codex agent name field               [PASS] Codex no legacy prompts surface
  [PASS] Codex agent required fields
16 passed, 1 warnings    exit=0

$ cd <cursor-layout> && mewkit validate --target cursor
  [PASS] Cursor AGENTS.md present
  [PASS] Cursor .meowkit/README.md present
  [PASS] Cursor reconciliation ledger present
3 passed                 exit=0
```

The one WARN (`no wrapper declares an allowedPermissionValues deny rule`) is pre-existing
and unrelated to this sprint. These two runs are the sprint's parity assertion, per D9.

**AC-11: MET.**

## AC-05 inside the projections — batch 3's open question 2, closed

Batch 3 flagged a real gap: the resolver lives at `.claude/scripts/skill-python.cjs`, the
projections shipped no `scripts/` directory, so the bundles named the skill's interpreter
directly (`.meowkit/envs/<skill>/bin/python3 <script>`). Truthful, but a projection user
with a missing environment got a shell "no such file" instead of the AC-05 message. Batch 3
also recorded that a hand-placed copy was rejected by the codex reference-integrity
validator as a fabricated target.

It was fixed at the emitter, not by bypassing the validator. The validator was right: it
scans `AGENTS.md`, `hooks.json` and the agent TOMLs for `.codex/(hooks|scripts)/...`
references and fails any that does not resolve **in the generated target** — a hand-placed
file in the bundle source is not in the target unless the manifest copies it. So the
manifest copies it:

```
  {
    "sourcePath": "root/.codex/scripts/skill-python.cjs",
    "targetPath": ".codex/scripts/skill-python.cjs",
    "mode": "0755", "active": true, "provider": "codex",
    "ownership": "managed-replace", "scopeTags": ["managed-runtime"]
  }
```

and the same for `.cursor`. `Codex root reference graph` now PASSes with the reference
resolving rather than dangling.

Three changes made the resolver work in a projection:

1. **Kit-directory discovery.** `findProjectRoot` looked only for `.claude/`. It now walks
   up for whichever kit directory this copy ships under.
2. **Frontmatter lookup across naming conventions.** `declaredRuntime` read
   `.claude/skills/<skill>/SKILL.md`. It now tries each kit directory and both `<skill>`
   and `mk-<skill>`, because the projections install the same skill under the prefixed
   name — a diagnostic that only found the authored layout would silently drop the
   interpreter requirement from the message in exactly the environments that are hardest
   to debug.
3. **Per-projection constants.** The shipped copies set `KIT_DIRS` to that runtime's own
   directory only, rewrite the usage lines to that runtime's script path, and read
   `process.env.PROJECT_ROOT` (the documented provider-neutral convention from
   `migrate/references/env-var-rewrite-table.ts`) instead of `CLAUDE_PROJECT_DIR`. This
   is also what fixed `cursor-output-brand-free`: the authored resolver literally contains
   the string `.claude`, and a cursor projection must not — and should not look in a
   directory that runtime never creates.

66 bundle invocation sites (both providers) were repointed from
`.meowkit/envs/<skill>/bin/python3 <script>.py` to
`node <kit>/scripts/skill-python.cjs <script>.py`. The rewrite is guarded: it only fires
when the `.py` path sits under that projection's own skills tree, because the resolver
derives the skill from the script path. **15 sites were deliberately skipped** — they
invoke `.claude/scripts/validate.py` and `.claude/scripts/security-scan.py`, which are
D6 Scope (Out) files owned by no skill and therefore not resolvable by a per-skill
resolver. They keep their direct-interpreter form; D6 defers them to phase 07.

Verified in the generated layouts, all three AC-05 states:

```
$ cd <codex-layout> && node .codex/scripts/skill-python.cjs \
      .agents/skills/mk-multimodal/scripts/gemini_analyze.py
[multimodal] no interpreter environment

multimodal needs its own environment at .meowkit/envs/multimodal. Create it with:

    mewkit skill env multimodal

This command installs only the packages multimodal pins. It is never run for you.
exit=1
```

And with `python3`, `python` and `py` all absent from `PATH` (`env -i PATH=<dir holding
only node>`), the message names the requirement read from the projection's own
frontmatter:

```
$ cd <cursor-layout> && node .cursor/scripts/skill-python.cjs \
      .cursor/skills/mk-story-sizer/scripts/check-auto-create-gating.py
[story-sizer] no interpreter environment

No Python interpreter is installed, and story-sizer requires python>=3.9.
Install it, then run:

    mewkit skill env story-sizer
exit=1
```

No traceback, no stack trace, correct skill name, exact copy-pasteable command. AC-05 now
holds in `.claude` and in both projections.

## Batch 5 — AC-14 measurements

**New files:** none in the kit. The bundle additions are projected copies of batch-4's
files (7 `.cjs` per provider, all ≤107 lines) plus the projected resolver (164 lines).

**Changed files, growth:**

| File | BASE | Now | Delta |
|---|---|---|---|
| `.claude/scripts/skill-python.cjs` | 0 (new in batch 3) | 164 | +14 this batch |
| `packages/mewkit/src/migrate/modules/{codex,cursor}/manifest.json` | — | — | +9 lines each |

No file crossed 200. Two test files touched, both characterization tests restating the
manifest they pin (flagged as open question 2 below).

```
$ npm run build            → OK
$ npm run typecheck        → 0 errors
$ npm run lint             → 0 errors, 3 warnings (all pre-existing)
$ npx vitest run packages/mewkit/src/migrate → 74 files, 953 tests, all pass
```

## Batch 5 open questions

1. **AC-10 is NOT DONE, and it is blocked on pre-existing BASE drift.** Repeating batch
   4's open question 1 because it is the reason: two of AC-10's 23 pinned verbs,
   `validate --ownership` and `inventory --check`, exit 1 on a clean checkout **at BASE**.
   `.meowkit/harness-inventory.json` lists all 18 hook scripts under their old `.sh`
   names, and `core/build-inventory.ts:183` counts only `.sh` files as hooks, so after
   sprint 3's node-hook port the count is 0 against a declared 18. `git diff a190cc91` is
   empty for all four inputs (`harness-inventory.json`, `build-inventory.ts`,
   `check-stale-index.ts`, `README.md`). Writing the committed script is straightforward;
   it would correctly exit non-zero and name `validate --ownership` as the first failure,
   which is not a passing AC. Fixing the drift means changing the hook-counting predicate
   and regenerating the inventory plus the README/HOOKS_INDEX counts — none of it in this
   sprint's Scope (In), and README is not a file this contract touches. **Decide:** fix the
   drift inside this sprint (scope amendment), or file it as phase-02 follow-up and let
   AC-10 carry the two known-failing verbs explicitly.

2. **Three test files touched, all characterization.**
   `codex-authored-bundle.test.ts` (9→10 target paths, `overlay.writes` 9→10),
   `cursor-full-surface-characterization.test.ts` (7→8 managed surfaces) and the title
   strings that state those counts. Adding a manifest entry is exactly what these tests
   are written to detect, so updating them is the follow-through — but they are test files
   and I am flagging them, as batch 2 did for its one.

3. **`requires_runtime` is now declared in the bundles too.** AC-06 asserts the count over
   `.claude/skills/*/SKILL.md` only, so this is additive rather than required. It is what
   makes the projection's no-python message name `python>=3.9` instead of a bare `python`,
   which is AC-05's third state. Confirm it is wanted in the projections, or say so and I
   will drop it and accept the family-granularity message there.

4. **15 bundle sites still name an interpreter path directly**, all of them invoking the
   two D6 Scope (Out) scripts (`validate.py`, `security-scan.py`) that no skill owns.
   A per-skill resolver cannot resolve them by construction. They are the only remaining
   direct-interpreter invocations in either bundle.

---
---

# Batch 6 — AC-10, and the hook-inventory drift it was blocked on

Scope addition ruled in by the coordinator (contract amendment recorded separately): the
drift that blocked AC-10 was left by this project's own hook port and no later phase
touches it, so it is fixed here.

## The drift, and what caused it

At BASE the hook enumeration counted only shell files
(`core/build-inventory.ts:183`, `if (!f.endsWith(".sh")) continue;`) and
`.meowkit/harness-inventory.json` carried governance metadata for all 18 hooks under their
`.sh` names. The sprint-3 port moved every hook to node and the observers into
`hooks/handlers/`, so the counted set became empty and all 18 registry entries became
stale — two separate failures with one cause:

```
$ mewkit validate --ownership       exit 1   18 × "[FAIL] Ownership: hooks/<name>.sh" + coverage
$ mewkit inventory --check          exit 1   "README.md (hook scripts): declared 18, found 0"
                                             ".claude/hooks/HOOKS_INDEX.md (shell hooks (token not found))"
```

### 1. What counts as a hook — decided, not inferred

The counted set is now **27 node hooks**: the 6 entrypoints directly under `.claude/hooks/`
and the 21 observers under `.claude/hooks/handlers/`.

The decision the coordinator asked for explicitly:

- **`dispatch.cjs` counts.** It is a registered entrypoint for 7 events and it decides
  whether any observer runs at all. Excluding the one hook the others depend on would be
  the least defensible line to draw.
- **The three write guards count** (`gate-enforcement.cjs`, `privacy-block.cjs`,
  `pre-ship.cjs`) — they are registered directly and are the only hooks that can block a
  tool call.
- **The two CLI modules count** (`append-trace.cjs`, `pre-implement.cjs`). HOOKS_INDEX
  calls them CLI modules because no *event* invokes them, but they are hook-path code
  invoked by an agent, they live in `hooks/`, and their `.sh` predecessors were among the
  BASE 18. Dropping them would shrink the claim for a reason unrelated to the port.
- **The 21 observers count.** They are hooks that happen to be dispatched. At BASE they
  were counted (they were flat `.sh` files in `hooks/`); the port moved them into a
  subdirectory and nothing else. Counting only the top level would have silently redefined
  "hook" as "hook that has not been reorganised" — which is the bug.
- **`lib/` does not count**, because nothing invokes those modules as a hook, and neither
  do `__tests__/` or the `HOOKS_INDEX.md` / `handlers.json` sidecars.

That last line is not re-derived: `core/is-hook-script.ts` is the single definition the
validators already share, and `build-inventory` now calls it instead of testing an
extension itself. One definition, three consumers.

### 2. The registry, regenerated by its own generator

`scripts/seed-ownership-metadata.cjs` owns those entries, so it was taught the new set
rather than the file being hand-edited. Three changes, each fixing a reason the drift could
happen at all:

- **Both hook tiers are enumerated**, by the same extension set `is-hook-script.ts` uses.
- **It writes the canonical path.** It wrote `.claude/harness-inventory.json` while every
  reader resolves `.meowkit/harness-inventory.json` first — so a reseed had no effect on
  what `validate --ownership` saw. It now prefers the canonical location and only falls
  back to the pre-move path when that is the only one present.
- **It prunes.** Merging was additive-only, which is how the registry kept describing
  files that had been renamed. It now removes entries under the prefixes it owns
  (`rules/`, `rules-conditional/`, `commands/`, `hooks/`) whose artifact is gone.
- **It derives `responsibility` and `criticality` for hooks** from a table keyed by hook
  name, instead of writing `medium`/nothing and leaving a human to promote values by hand.
  That matters beyond tidiness: `validate --substrate` treats a registry-sourced artifact
  with no `responsibility` as a hard gap, so a value a human pastes into generated output
  is a value the next regeneration drops. The table reproduces every value the 17
  surviving hooks already carried and extends it to the 10 new ones.

```
$ node scripts/seed-ownership-metadata.cjs
  registry: added hooks/append-trace.cjs … hooks/handlers/tdd-flag-detector.cjs   (27)
  registry: pruned hooks/append-trace.sh … hooks/tdd-flag-detector.sh             (18)
  Registry: 66 total entries (27 added, 18 pruned this run)

$ node -e "…"   # over .meowkit/harness-inventory.json
total: 66 · hooks: 27 · hooks missing responsibility: [] · .sh leftovers: []

$ mewkit validate --ownership
  [PASS] Ownership coverage
exit=0
```

### 3. The doc counts

`mewkit inventory --emit-counts` updated README (the badge line and the tree line, 18→27).
HOOKS_INDEX needed more than a number: its count spec looked for `(\d+)\s+shell hook`, a
token that stopped existing when the runtime became node, so the check reported "token not
found" forever rather than a wrong number. The spec label is now `node hooks` and
HOOKS_INDEX states the set it actually ships:

> The kit ships 27 node hooks: the 6 entrypoints directly under `hooks/`, which the host
> registers or an agent invokes, and the 21 observers under `hooks/handlers/`, which
> `dispatch.cjs` runs. Shared modules under `lib/` are not hooks — nothing invokes them as
> one — and neither are the sidecars (`HOOKS_INDEX.md`, `handlers.json`) or `__tests__/`.

```
$ mewkit inventory --check
  [PASS] Index counts & completeness
Docs match the inventory.
exit=0
```

`check-stale-index.test.ts`'s HOOKS fixture string followed the label rename (`1 shell hook
scripts` → `1 node hook scripts`). One fixture line; the assertions are unchanged.

The substrate view is generated from the registry, so it went stale the moment the hook set
changed. Regenerated with the repo's own generator, not by hand:

```
$ mewkit inventory --substrate --emit
Wrote substrate view: .claude/harness-substrate.md
$ mewkit validate --substrate
  [PASS] Substrate view in sync
  [PASS] Substrate coverage
```

### 4. Unscoped `mewkit validate` — asked for, and the answer is clean

```
$ mewkit validate
40 passed, 34 warnings, 1 n/a      exit=0
```

**No failures remain.** The 25 failures it had before this batch were all the same drift
(18 ownership rows + ownership coverage + 6 count-drift rows). Every scoped flag also
passes: `--ownership --gates --workflow --agents --packs --memory --substrate --frontmatter
--docs-refs` and `inventory --check` are all exit 0. The 34 warnings are pre-existing and
unrelated (167 untagged skill/agent artifacts under the tag-on-touch policy, and the
duplicate-intent capability advisories).

## A second blocker found by writing the harness: `mewkit plan approve` was broken at BASE

`commands/plan-approve.ts:137` ran the receipt helper through `sh`:

```ts
const out = execFileSync("sh", [helper, "stamp", planFile, approver], { encoding: "utf8" });
```

The helper was a shell script once. Sprint 3 made it `.cjs` and this call site kept `sh`,
which reads `'use strict';` as a command:

```
$ sh .claude/hooks/lib/approval-receipt.cjs stamp
approval-receipt.cjs: line 1: use strict: command not found
approval-receipt.cjs: line 2: //: is a directory
```

`git show a190cc91:packages/mewkit/src/commands/plan-approve.ts` has the same line, so
**the Gate 1 approval receipt could not be stamped on any host** — a core verb AC-10 pins,
and the single remaining `child_process` call site in `packages/mewkit/src` targeting
`sh`/`bash`. Fixed to `process.execPath`, which is also the only reading under which
stamping a gate needs no shell:

```
$ grep -rn 'execFileSync("sh"\|spawnSync("sh"\|execFileSync("bash"\|spawnSync("bash"' packages/mewkit/src | grep -v __tests__
(no matches)
```

This is the kind of thing AC-10 exists to catch, and it was caught by AC-10 on its first
run rather than by a user at Gate 1.

## AC-10 — the committed no-Python check

| New file | Lines | Role |
|---|---|---|
| `scripts/check-no-python.cjs` | 137 | preconditions, PATH sandbox, run loop, first-failure reporting |
| `scripts/lib/no-python-checks.cjs` | 150 | the check list, incl. the 23 pinned verbs and their fixtures |
| `scripts/lib/no-python-fixture.cjs` | 146 | the throwaway project the state-changing checks run in |
| `scripts/lib/no-python-path.cjs` | 60 | the interpreter-free PATH |

**The PATH.** It mirrors every executable on the real PATH *except* the interpreters
(`python`, `python2/3`, `python3.x`, `py`, `pypy`), preserving PATH precedence — first
occurrence of a basename wins. An allowlist of a few tools was the obvious alternative and
is worse: it turns "this check does not need Python" into "this check could not find some
unrelated tool either", and the two failures read identically. The sandbox is then probed
through `/bin/sh -c 'command -v python3 || command -v python || command -v py'` and the run
aborts as a precondition failure (exit 2) if anything resolves.

**The fixture.** `task new`, `note gotchas`, `plan approve` and `setup` write durable
project state, so they run in a git-initialised scratch project — a check that mutates the
checkout it is auditing cannot be run twice with the same meaning. The repo's own
`.meowkit/memory/` and `tasks/` are untouched by a run (`git status` confirms). The fixture
carries a plan with a full-template phase file, a passing Gate 2 verdict JSON, a planted
CRITICAL injection fixture, and a copy of `.claude/hooks/lib/` (which `plan approve`
resolves out of the project's own kit directory).

**Preconditions.** The shared venv must be absent (hard) and `.meowkit/envs/` must be
empty. A clean checkout has no `.meowkit/envs/` — it is generated and ignored — so the
default is the strict check; `--allow-existing-envs` exists for a working tree where a
developer has provisioned one and prints exactly what it tolerated. This tree has five
(from batch 3 and batch 4's CI-step verification), so the recorded run uses the flag and
says so on its first line.

### The run

```
$ node scripts/check-no-python.cjs --allow-existing-envs
No-Python runtime check
  ! tolerating populated .meowkit/envs/: evaluate, figma, multimodal, scale-routing, web-to-markdown (--allow-existing-envs)
  PATH sandbox: /var/folders/.../no-python-bin-ZBvMcX (python3, python, py absent)
  fixture project: /var/folders/.../no-python-fixture-K0rdCe

  ok    vitest tests/hooks (golden replay + gate/privacy/pre-ship crash paths)
  ok    node --test .claude/hooks/__tests__/*.test.cjs
  ok    injection-audit records a planted critical finding in the security log
  ok    mewkit doctor
  ok    mewkit orient
  ok    mewkit status
  ok    mewkit validate --packs
  ok    mewkit validate --gates
  ok    mewkit validate --memory
  ok    mewkit validate --workflow
  ok    mewkit validate --agents
  ok    mewkit validate --ownership
  ok    mewkit inventory --check
  ok    mewkit plan status @plan
  ok    mewkit plan check @phase
  ok    mewkit plan approve @plan --by no-python-harness
  ok    mewkit note gotchas
  ok    mewkit task new --type feature no-python harness fixture task
  ok    mewkit task-state
  ok    mewkit verdict-gate 260101-fixture
  ok    mewkit review
  ok    mewkit budget context
  ok    mewkit trace score
  ok    mewkit context resolve README.md
  ok    mewkit advice
  ok    mewkit skill env --list
  ok    mewkit plan check --structural reports its completion marker
  ok    mewkit setup exits 0, creates no environment, and reports what it skipped

All 28 checks passed with no Python interpreter on PATH.
exit=0
```

All 23 pinned verbs are present and `validate --parity` is absent, per D9. Clause coverage:

| AC-10 clause | Covered by |
|---|---|
| `tests/hooks/golden` passes in full | `vitest run tests/hooks` (includes `golden-replay.test.ts`, the 82-fixture corpus) |
| `node --test .claude/hooks/__tests__/*.test.cjs` passes in full | its own check, 36 tests |
| Gate 1 / Gate 2 / privacy / pre-ship crash-path suites from sprint 3 | the same `tests/hooks` run — `crash-paths.test.ts`, `completion-gate.test.ts`, `dispatcher.test.ts`, `isolation.test.ts`, `env-allowlist.test.ts`, `sentinel-pipeline.test.ts`, `session-start-context.test.ts`, `post-session-recording.test.ts` |
| injection-audit writes a security-log entry for a planted critical fixture | its own check; asserts the file exists AND holds `CRITICAL` |
| the 23 core verbs exit 0 on their fixture | 23 checks |
| `plan check --structural` runs on a plan fixture and reports its completion marker | its own check; asserts `PLAN_COMPLETE` in stdout |
| `setup` exits 0, creates no env, reports what it skipped | its own check; asserts all three |

Every verb result is additionally screened for interpreter complaints
(`python3: command not found`, `No Python interpreter`, `skills/.venv`) — a verb that
"passed" while printing one of those would be reported as a failure, so a check cannot pass
by silently degrading.

**Two verbs use their usage output as the fixture, deliberately, and this is recorded rather
than hidden:** `review` and `advice` are verb GROUPS whose every subcommand requires a
prepared session (a fetched pull request; a supervision run) that does not exist in a fresh
project. What AC-10 asks is whether the verb runs without an interpreter, and the usage
answer proves the module loaded, dispatched and replied — a Python dependency would fail
before any of that. Every other verb runs against real state: `verdict-gate` against a
seeded PASS verdict, `plan approve` against the fixture plan (and it really stamps a
receipt), `note gotchas` against the fixture memory store.

## Batch 6 — AC-14 measurements

**New files — all ≤200 lines:** the four listed above (137 / 150 / 146 / 60).

**Changed files already over 200 at BASE that this batch grew:**

| File | BASE | Now | Delta | Why |
|---|---|---|---|---|
| `scripts/seed-ownership-metadata.cjs` | 345 | 414 | +69 | both hook tiers, the governance table, canonical path, prune step |
| `packages/mewkit/src/core/build-inventory.ts` | 480 | 495 | +15 | the two-tier hook walk via `isHookScript` |
| `packages/mewkit/src/core/check-stale-index.ts` | 218 | 221 | +3 | the label rename and its comment |

**Changed files under 200, still under 200:**
`packages/mewkit/src/commands/plan-approve.ts` (170 → 174, the `sh` fix and its comment),
`.claude/hooks/HOOKS_INDEX.md` (+6 prose), `README.md` (2 numbers).

**Greps over added lines:** `: any` 0 · `as any` 0 · `<any>` 0 · `@ts-ignore` 0 ·
`eslint-disable` 0 · TODO/FIXME 0 · commented-out code 0 · hardcoded secrets 0.
**`child_process` call sites targeting `bash`/`sh`/a `.sh` file: the sprint now has zero**
— this batch removed the last one. The harness itself spawns only `process.execPath`,
`npx`, `git` and one `/bin/sh -c 'command -v …'` probe whose entire purpose is to prove no
interpreter resolves; it runs no project code.

**Verification:**

```
$ npm run build            → OK
$ npm run typecheck        → 0 errors
$ npm run lint             → 0 errors, 3 warnings (all pre-existing)
$ npx vitest run           → 250 files, 2892 tests, all pass
$ npx vitest run tests/hooks tests/ports → 11 files, 228 tests, all pass
$ npx vitest run packages/mewkit/src/migrate → 74 files, 953 tests, all pass
$ node --test .claude/hooks/__tests__/*.test.cjs → 36 pass, 0 fail
$ mewkit doctor            → exit 0
$ mewkit validate --packs  → exit 0
$ mewkit validate          → 40 passed, 34 warnings, 1 n/a, 0 failed
$ mewkit validate --target codex  (generated layout) → exit 0
$ mewkit validate --target cursor (generated layout) → exit 0
$ node scripts/check-no-python.cjs --allow-existing-envs → 28/28, exit 0
$ find .claude \( -path "*hooks*" -o -path "*/bin/*" \) \( -name "*.sh" -o -name "*.py" \) … | wc -l → 0
```

## Batch 6 open questions

1. **`review` and `advice` use usage output as their fixture.** Stated in full above. If a
   prepared-session fixture is wanted for either, say so — `review` needs a session
   manifest plus a complete coverage bundle (coverage exits 1 while incomplete, by design),
   and `advice` needs a supervision run id, so both are a meaningful amount of fixture for
   a check whose question is "does this verb need Python".

2. **`--allow-existing-envs` was used for the recorded run.** A clean checkout has no
   `.meowkit/envs/`, so the strict default holds there; this tree has five because batches
   3 and 4 provisioned them to verify AC-04 and the CI steps. I did not remove them — the
   run states what it tolerated on its first line. Say so if the recorded run must instead
   be taken on a checkout with none.

3. **The hook governance table lives in the seeder.** 27 rows of
   `criticality` + `responsibility` keyed by hook name. That is the generator owning its
   output, which is what makes a reseed safe — but it does mean adding a hook means adding
   a row, and a hook with no row gets `medium` and no `responsibility`, which
   `validate --substrate` will then fail on. That is the intended failure (it is a prompt to
   classify the new hook), but it is a new authoring obligation and worth confirming.

4. **`mewkit plan approve` never worked at BASE.** Fixing it was necessary for AC-10 and is
   a one-token change, but it is a behaviour change to a Gate 1 artifact outside this
   sprint's Scope (In), and it means the receipt mechanism has had no live coverage since
   sprint 3. Worth a follow-up: nothing in the test suite exercised `plan approve`
   end-to-end, which is why a broken spawn survived a full sprint.

## Line counts at the end of the sprint

The per-batch measurements above under-reported this. The figures below are re-measured against BASE `a190cc91` on the final tree (`git show a190cc91:<f> | wc -l` vs `wc -l <f>`). No new file exceeds 200 lines; every file over 200 below was already over 200 at BASE. The earlier `doctor-checks.ts` row (361→366) is superseded.

| File | BASE | Now |
|---|---|---|
| `packages/mewkit/src/commands/doctor-checks.ts` | 361 | 395 |
| `packages/mewkit/src/commands/validate.ts` | 896 | 951 |
| `scripts/seed-ownership-metadata.cjs` | 345 | 414 |
| `packages/mewkit/src/commands/setup-steps.ts` | 235 | 270 |
| `packages/mewkit/src/core/build-inventory.ts` | 480 | 495 |
| `packages/mewkit/src/index.ts` | 455 | 469 |
| `packages/mewkit/src/lib/system-deps-registry.ts` | 303 | 316 |
| `packages/mewkit/src/cli/command-catalogue.ts` | 293 | 301 |
| `packages/mewkit/src/core/check-stale-index.ts` | 218 | 221 |
| `.claude/skills/web-to-markdown/scripts/persist_fetch.py` | 353 | 383 |
| `.claude/skills/story-sizer/scripts/check-auto-create-gating.py` | 263 | 290 |

The regenerated codex/cursor projection copies of the two Python consumers grow by the same amounts.

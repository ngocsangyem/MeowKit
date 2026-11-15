# D04 — MeowKit CLI and provider adapters

Auditor: D04. Read-only. All trials in scratch `/private/tmp/claude-501/-Users-sangnguyen-Desktop-MeowKit/2432fe97-45f9-43f5-a60a-3ca2021e1a38/scratchpad/d04`.

## 0. Baseline (read this first)

The checkout moved mid-audit (not by me; lead confirmed) from `feat/rust-plan-state-verbs @ fc278b31` to `main @ c7ff0a9e` (03:12 +0700). I did not switch back.

| Part | Read at | Notes |
| --- | --- | --- |
| TS source reads (`packages/mewkit/src/**`: index.ts, command-catalogue.ts, merge-settings.ts, github-releases.ts, extract-release-zip.ts, local-release-source.ts, providers.ts, uninstall.ts) | **fc278b31** (working tree, before the move) | Source is gone on main (`git ls-files packages/mewkit` = empty). Cite as `fc278b31:packages/mewkit/src/...`. Re-readable via `git show fc278b31:<path>`. |
| TS behaviour trials (`init`, `doctor`, `doctor --hard-gates`, `validate --target`, `providers --lifecycle`, `inventory`) | `packages/mewkit/dist/index.js` built Nov 12 19:51 = **stale build of the retired TS CLI (2.3.1)**, no `src` newer than it at fc278b31 | Gitignored leftover on main (`.gitignore:5 dist/`). Not shipped from this repo any more. |
| Rust source, hooks, bundles (`kit/bundles/`), docs, workflows, installers | **c7ff0a9e (main)** | Primary baseline. |
| Rust behaviour trials | binary **built by me from main** into scratch (`cargo build -p mewkit-cli`, 43s, offline) | The in-repo `target/debug/mewkit-next` (Nov 13) is stale pre-rename; used only early (providers, init help). |
| Counts | main | Rust crates 83.6k LOC (git ls-files `*.rs`): src core 53,979 / adapters 2,513 / cli 10,554; tests core 2,890 / adapters 1,407 / cli 12,427. ~1,660 `#[test]` fns (core 1113, adapters 53, cli 496). Brief's "54k Rust / 65k TS" described fc278b31; **TS is 0 LOC on main**. |

**Conclusions the cutover invalidates:** (a) "two CLIs at once / duplicated surface / maintenance cost of 65k+54k" — no longer true on main; one CLI. (b) `mewkit inventory --substrate` doc claim — CLAUDE.md on main no longer says it (now `validate --substrate`). (c) All TS-specific install-risk findings (F-D04-05, -06, -07) are historical for the retired npm 2.3.1, but remain live for anyone still running `npx mewkit` (npm `latest` is still 2.3.1 — `npm view mewkit`, VERIFIED).

## 1. Scope & coverage

Examined: command catalogue + dispatcher (TS@fc278b31), Rust `main.rs`, `commands/*`, `crates/mewkit-core/src/kit/{mod,checksum,http,extract}.rs`, `merge/hook_groups.rs`, `config/precedence.rs`, adapters `claude_code/{mod,global}.rs`, `codex/global.rs`, `scope.rs`, `doctor/*`; `kit/bundles/{codex,cursor}` (hooks.json, hooks); `.claude/hooks/{handlers.json,dispatch.cjs,lib/gate1-hatch.cjs,lib/check-contract-signed.cjs,handlers/pre-completion-check.cjs,handlers/orientation-ritual.cjs,lib/memory-store-lint.cjs}`; `env-name-classification.json`; `.meowkit/config.yaml`; `install.sh`, `scripts/release/installer-pins.json`, `rust-ci.yml`, `rust-release.yml` (grep only), `RELEASING.md` trust sections; `docs/maintainer/npm-cli-retirement.md`; ADRs 261110-*; `crates/mewkit-cli/tests/golden/{DIVERGENCES.md,npm/README.md}`; `gh release list/view` and `npm view` (read-only network).

Not done: full reading of `review`, `advice`, `budget`, `setup`, `pack`, `backups` internals; Windows paths/`install.ps1`; `upgrade` end-to-end trial; Cursor live behaviour (needs Cursor; `vitest.live-cursor.config.ts` was TS-era); running `npm_behaviour`/`lifecycle_matrix` suites (listed only); `scripts/release*.sh` body; `.github/workflows/ci.yml` (hook tests). Not run: `cargo test --test parity` (target no longer exists on main; replaced by `npm_behaviour`). `docs_cli` test fails locally because untracked `packages/landing/.vercel/output` build artefacts contain `npx mewkit` — environmental, not a repo defect (INFERRED).
Brief's `docs/maintainer/mewkit-next-cutover.md` / `mewkit-next-runtime-smoke-checklist.md` do not exist on either branch's final form; main has `docs/maintainer/npm-cli-retirement.md` and `runtime-smoke-checklist.md`.
Side effects: one Rust `providers` call (stale binary) did a GitHub release read and downloaded the kit zip before refusing (no cache written to repo). A mistaken `HOME=` override on cargo triggered a rustup toolchain auto-install into scratch HOME (deleted). Repo tree: `git status` shows only the `docs/research/meowkit-evolution-2611/` untracked dir.

## 2. Verb inventory

Source of truth: Rust `enum Command` in `crates/mewkit-cli/src/main.rs` (c7ff0a9e); TS `CLI_CATALOGUE` `fc278b31:packages/mewkit/src/cli/command-catalogue.ts`. VERIFIED via `mewkit --help` (built binary) and TS `--help`.

| Verb (subcommands) | Purpose | Writes | Network | TS (fc278b31) | Rust (main) | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| init | install kit per runtime/scope | project/home files, settings merge, `.meowkit/{state,backups,cache}` | GitHub API+zip (Rust: unless `--offline/--kit-archive`; TS: unless `MEOWKIT_RELEASE_SOURCE`) | yes | yes | init_flags, lifecycle(_matrix), fault_injection |
| upgrade (--check/--list) | move to newer kit keeping edits | same | yes | yes | yes | upgrade_flags |
| uninstall | remove owned files; dry-run default in both | deletes | no (cache) | yes | yes | lifecycle |
| doctor (provenance, --hard-gates, --providers, --report, --state, --adopt) | diagnostics, live gate probes | none (hard-gates uses scaffold) | no | yes (~20 checks) | yes (6 checks in my trial) | doctor_cases (golden) |
| providers [<p>] [--lifecycle] | adapter/support view | none | Rust: needs kit (network/cache) unless `--lifecycle`/offline | yes | yes | npm_behaviour |
| versions | CLI/kit info | none | Rust lists releases | yes | yes | npm_behaviour |
| self-update | replace binary | binary | yes | — | **Rust only** | binary_manifest |
| orient, plan (status/check/approve/archive), note, task (new/list), task-state, validate | plan/memory/state | tasks/, .meowkit/ | no | yes | yes (ported group 1) | npm_behaviour 371 cases, golden/npm 471 files |
| verdict-gate, review (6 subs), advice (4), trace (score/audit/propose), budget, setup, skill env, pack, capabilities (list/explain/resolve/view/bootstrap/projections), backups | see names | varies | review uses git/gh; setup optionally installs system deps | yes | yes (ported groups 2-3) | npm_behaviour |
| migrate (15,155 TS lines), visual-plan (3,075) | — | — | — | removed/retired | **not ported** (`init --target codex|cursor` replaces migrate) | — |
| inventory | — | — | — | **absent** | **absent** | — |

F-D04-01 VERIFIED: 23 verbs on main; `mewkit inventory --substrate` returns "unrecognized subcommand" (Rust) / "Unknown command" (TS dist). Old CLAUDE.md claimed it (CONTRADICTED then, fixed on main). Every other README-listed verb exists on main (`providers <host> --lifecycle`, `validate --target codex`, `doctor --providers`, `capabilities resolve`, `orient`, `plan approve`, `note`, `trace`, `budget`, `task new`, `skill env`, `setup`, `init --target --delivery`).
Undocumented-in-README but present: `self-update`, `backups`, `verdict-gate`, `advice`, `pack`, `versions`, `review`.

## 3. Findings

**F-D04-02 (Q2) One CLI on main; TS fully retired.** VERIFIED: `git ls-files packages/mewkit` empty; `docs/maintainer/npm-cli-retirement.md` records 4 criteria (all verbs exist w/ tests against recorded npm behaviour; lifecycle matrix on 3 OS; one beta cycle; rename). `crates/mewkit-cli/tests/golden/npm/` (471 recorded JSON, "can no longer be regenerated") + `tests/npm_behaviour` (371 cases) are *frozen* characterisations, not live parity. `golden/baseline/*.manifest.json` "regeneration manual and not gated in CI" (DIVERGENCES.md last para). Counter: criterion 3 (one beta cycle) cannot have been met — see F-D04-03. Matters: parity is now "matches a recording", cannot catch drift in the kit-side; fine as regression guard, not as proof.

**F-D04-03 The documented install path does not work today.** VERIFIED: `scripts/release/installer-pins.json` = `{"stable":null,"beta":null}`; `install.sh` `pin()` returns 1 for every channel → "this installer pins no stable release". `gh release list --limit 100 | grep -c mewkit-v` = 0; latest release is kit v2.15.0 (2026-07-27) with a single asset `meowkit-release.zip` (no `checksums.txt`). Rust `init`/`providers` against that release refuse: "kit 2.15.0 has no checksums.txt … pass --allow-unverified-kit" (observed). So: README's headline `curl | sh` → fails; the only published CLI is npm 2.3.1 (retired, no notice release published; `npm view` latest=2.3.1); retirement criterion 3 ("beta installed through install.sh") has no release evidence. Main is unreleased code. Needs maintainer confirmation of intent (UNKNOWN whether unpublished by design pending the cutover).

**F-D04-04 Rationale for Rust.** Stated: ADR 261110-rust-adapter-contract (per-runtime branching in TS; one emitter contract; rollback journal/ownership), two-release-streams ADR (native binary, 6 targets, SHA pins). No performance or "no Node" claim found; and Node is still required for all hooks (migration doc: "Node.js needed only for the kit's hooks"). Measured (VERIFIED, my machine): `orient --no-record` TS dist 168 ms vs Rust debug 19 ms vs bare `node -e 0` 78 ms. The CLI sits on hook paths only at SessionStart (`orientation-ritual.cjs:61`, 5s timeout) and pre-ship memory lint (`memory-store-lint.cjs:50-95`); Gate 1/privacy/Gate 2 structural checks run in-process node. So startup gain is real but off the hot gate path (every Edit still spawns 2 node hooks). Judgment: justified by correctness/ownership (see F-D04-05) more than speed; cost accepted = 83.6k LOC Rust (of which 16.7k tests) vs 65k TS deleted, and migrate/visual-plan dropped (18k TS lines).

**F-D04-05 TS settings merge silently dropped the kit's gates (historical, live for npm 2.3.1).** VERIFIED by trial (scratch p2/p3, stale dist) and by `fc278b31:packages/mewkit/src/core/merge-settings.ts` (`extractCommandStrings` dedupes on `command` only; kit hooks are all `"command":"node"` with `args`). With a pre-existing `{"command":"node","args":["other/guard.js"]}` in PreToolUse, init left user hooks only: gate-enforcement, privacy-block (Edit|Write and Read) and pre-ship were not registered. Init printed "All checks passed" (validation only checks `settings.json exists`); plain `doctor` and `validate` PASS; only `doctor --hard-gates` failed (8 FAIL: "Hook was not configured"). Independently admitted in `DIVERGENCES.md` ("the TS dedupe drops handlers that share `"command": "node"`"). Rust keys on matcher+command+args: same input → user hook kept + all kit hooks merged (VERIFIED r_claude-code). Counter: fresh installs (no settings.json) were unaffected. Matters: this is a concrete, demonstrated failure that the control-plane idea "enforcement verification" (`doctor --hard-gates`) already answers; also strong evidence for the Rust merge.

**F-D04-06 Supply chain.** VERIFIED. TS (fc278b31 `github-releases.ts:54-130`): first `.zip` asset from the API, no checksum (grep `checksums.txt|sha256` in src = none besides file hashes), no URL-host check, no version pin; RELEASING.md line 580 admits "reads the zip and ignores checksums.txt". Rust (`kit/mod.rs`): asset URL must start `https://github.com/ngocsangyem/MeowKit/releases/download/`; SHA-256 from `checksums.txt` in the *same release*; refuses without it unless `--allow-unverified-kit` (recorded as origin `Unverified`); `kit-contract.json` + `mewkitMin` gate; zip extraction refuses symlinks, dup names, traversal, >20k entries/64MB file/512MB total (`extract.rs`). RELEASING.md:583 states the trust model plainly: no signatures; checksums "detect corruption … not a tampered release". `install.sh`: binary archives pinned by URL+SHA+size in a reviewed PR (stronger); `self-update`: digest from `binary-manifest.json` of the same release (weaker, same-origin). What a compromised kit asset can do: it ships `.claude/hooks/*.cjs` and `settings.json` hook registrations → arbitrary node execution as the user on the next tool call; plus `statusLine`/`env` keys are merged. Nothing scans hook content; stopping points are GitHub release permissions, TLS, who can push tags. Mitigation candidates are proposals in §5.

**F-D04-07 Lifecycle behaviour (Rust main, trials).** VERIFIED in scratch with pre-existing `CLAUDE.md`, `AGENTS.md`, user hooks and `permissions.deny`:
- claude-code: user `CLAUDE.md` untouched (both CLIs). `permissions` NOT merged; printed notice ("add it yourself"). Backup printed with "may hold credentials" warning.
- codex: user `AGENTS.md` kept, kit text in a `<!-- mewkit:begin meowkit -->` block. TS dist instead *left the user's AGENTS.md untouched* ("differ from the bundle, left untouched"), i.e. the Codex instruction surface was not installed unless `--force`, which would overwrite (DIVERGENCES: TS "whole file replaced").
- cursor: Rust does not write `AGENTS.md`; uses `.cursor/rules/meowkit-core.mdc` (alwaysApply) per DIVERGENCES.
- uninstall: dry-run default (both). Rust `--yes` after install into settings with user hook: removed 1219 files, rewrote settings.json back to exactly the user's two keys, user hook and deny kept, `CLAUDE.md` untouched; leaves `.meowkit/{backups,state}`. TS uninstall had no settings.json handling (`grep settings` in uninstall.ts = none at fc278b31) so merged hooks would persist (INFERRED; not trialled).
- dry-run: `init --dry-run` wrote nothing (TS trial; Rust docs: downloaded kit still cached).
- global scope (`claude_code/global.rs`, `codex/global.rs`): only agents/skills/rules/hooks scripts + privacy-block and SessionStart hook registered globally; Gate 1/2 are project-only; `doctor` warns "project has no project install; plan and review gates run only from project hooks" (`doctor/installs.rs`). Honest.
- `--delivery plugin`: **CONTRADICTED vs README** "Installs the mk plugin … nothing is copied into your project". Trial: wrote 1,230 files incl. full `.claude/` + settings.json hooks plus one `.claude-plugin/plugin.json`; code comment `claude_code/kit_dir.rs:57` says "one metadata file, names no component path". Manifest `description` is the internal adapter text ("Same SessionStart hook, propagated into the plugin payload at plugin generation; plugin hooks gate behavior." `kit_dir.rs:65`). So `providers claude-plugin --lifecycle` (a distinct column, identical to claude-code) has no distinct artefact. Whether a host would load a bare project `.claude-plugin/` without marketplace install: UNKNOWN.

**F-D04-08 Coexistence (Q5).** README (main): "`mewkit doctor` warns when it detects both [plugin + flat-copy]". CONTRADICTED on main: `grep -i plugin crates/mewkit-cli/src/commands/doctor` = none; doctor's only duplicate check is same runtime at project + global scope (`installs.rs:19-23`) plus `adapters/scope.rs:97` privacy-hook-at-both-scopes notice. TS dist had "Delivery shape"/"Install mode" checks (observed) that were not ported or are narrower. No detection of other toolkits' hooks, no name-collision check, no `.mcp.json` check in Rust doctor (TS had "MCP config" WARN). Rust merge is correct for foreign hooks (F-D04-05). Cursor emitter notes "Cursor also reads .claude/skills here: skills may be listed twice" (`cursor/mod.rs:142`). Rust `doctor` reports `ok mewkit on PATH: \`mewkit\` is not on PATH` — status "ok" on a missing binary (minor honesty bug).

**F-D04-09 Per-host truth (Q3).** See table §4. Key VERIFIED facts: Claude flat-copy registers 13 handlers (7 direct write/ship guards + dispatcher observers); Codex bundle registers **2** hook handlers (`privacy-block` on Bash, `gate-enforcement` on apply_patch|Edit|Write) — no pre-ship/Gate 2 hook, no Read privacy gate, no post-write scan, no observers; Cursor bundle registers fail-closed `beforeReadFile`, `beforeShellExecution`, `beforeMCPExecution`, `preToolUse` write gate (Gate-1 via copied `plan-gate`), and fail-open telemetry/session hooks (`telemetry-observers.cjs:12`). Gate core lib files are byte-identical copies across `.claude/hooks/lib`, codex and cursor bundles (sha match; `scripts/sync-hook-core.cjs --check` enforces) — a genuine enforcement-parity mechanism for Gate 1.

**F-D04-10 `providers --lifecycle` overstates Claude `stop` and mixes meanings.** VERIFIED: it labels `stop supported [gate] — Stop hook can block the stop (pre-completion-check security-BLOCK, exit 2)`. Source `handlers/pre-completion-check.cjs:1-18`: opt-in per plan, answers with a block decision not exit 2, degrades to a nudge after a cap; runs through `dispatch.cjs` which is "fail-open" (`:112`), and is switchable by `hooks.pre-completion-check: false` in the committed project config. So "gating events: pre_tool, stop" overclaims `stop`. Codex rows: "session_start/post_tool/prompt_submitted/stop supported" describe *host capability*; kit registers none of them (F-D04-09). Cursor: every event "unknown — no tested lifecycle projection" while the invoke row says `lifecycle-hook supported` and the bundle ships fail-closed gates → under-claim and internally inconsistent. Codex "skill parity 6% (7/127)" was printed by TS dist only (TS-era; not in Rust output).
Counter: output is hedged ("cannot guarantee a block", "no in-repo proof", `ask_user local-fallback` with explicit fallback text); README says Codex gates "deter but do not block". Net: H6 partly supported — no blanket false parity, but three specific overclaims (stop gate, claude-plugin column, README plugin/doctor text) and one under-claim (Cursor).

**F-D04-11 Emitted Codex/Cursor bundle quality.** VERIFIED (Rust init notices, scratch): Codex install emits 521 "dangling reference" notes and 78 "denied token" notes (e.g. `.agents/skills/agent-detector/references/skill-domain-routing.md` while the dir is `mk-agent-detector`; `.codex/agents/advisor.md` while agents are TOML; `.codex/workflow.yaml`; Claude tool tokens `TaskCreate`, `CLAUDE_PROJECT_DIR`). Cursor: 231 dangling / 12 denied. The installer surfaces them honestly as notes but ships them. TS `validate --target codex` passed 16 checks ("Codex root reference graph" PASS) and gave WARN "no wrapper declares an allowedPermissionValues deny rule"; `validate --target cursor` ran only 3 checks (AGENTS.md, README, ledger) — it verifies nothing about hooks. README's own sentence ("structural parity, not identical behavior") is accurate. Whether agents following a dangling reference fail in practice: UNKNOWN (needs behavioural eval).

**F-D04-12 Config layers (Q6).** VERIFIED: `precedence.rs` order env > flag > project > user > default but only `tdd`↔`MEOWKIT_TDD` has an env form ("Exactly one"). Guards read through separate code: hooks use `read-config.cjs`; Gate 1 hatch is a closed reader (`gate1-hatch.cjs`) that cannot read the project file, refuses if user file == project file, and refuses if the downgrade cannot be logged to `.meowkit/telemetry/security-log.md`. Matrix §4b. Not examined: whether an agent with Write can create `~/.meowkit/config.yaml` with `gate1PresenceOnly: true` (the hook-side protections of the home dir) — UNKNOWN, hook-domain. Real lower-trust weakening: committed project config can disable observers `post-write` (post-write scan) and `pre-completion-check` (the Stop gate) — they are in `handlers.json` as ordinary toggles; config comment says only the "seven hard-blocking checks" are non-disableable, and these two are not among the directly registered guards.

**F-D04-13 Hook→CLI dependency (Q7).** VERIFIED: CLI needed by (1) SessionStart `orientation-ritual.cjs` (`execFileSync(exe,['orient','--no-record'],timeout 5000)`; falls back to checkpoint text), (2) pre-ship `memory-store-lint.cjs:74` → `SKIP: mewkit CLI not found — team memory store not linted` exit 0 (fail-open memory lint), (3) session hint "MeowKit CLI not available". (4) Human flow: Gate 1 approval needs `mewkit plan approve` to write the receipt; without CLI, gate stays closed (fail-closed, not a bypass). Gate enforcement itself (`gate-enforcement`, `privacy-block`, pre-ship structural check) runs in node, CLI-free. `MEOWKIT_CLI` env/`.meowkit/bin/mewkit` launcher/PATH/`~/.local/bin` resolution; `npx` latency issue vanishes with the native binary. A Rust binary fixes latency and lookup; removing the dependency would only matter for memory lint (could be a node implementation, but a Rust↔JS reader-agreement test already exists in CI). Neither is urgent.

**F-D04-14 Control plane (Q8).** See §5 table. Headline: most already exist in real, not structural-only, form (`doctor --hard-gates` runs the real hooks on a scaffold; `uninstall` dry-run + ownership; `validate`; backups). Missing: trace export, eval execution verb, compat diagnostics for other toolkits. `capabilities resolve --intent "search the web"` → "ambiguous", 4 skills tied at score 3 via 1-term keyword overlap, all "invocable: unknown; verify: unknown" (VERIFIED) — it is lexical matching over descriptions, not capability detection.

**F-D04-15 Prompt-injection observation.** None found in files read (the `.claude` memory/rules files contain instructions to agents by design; not followed beyond the task).

## 4. Tables

### 4a. Per-host truth (c7ff0a9e; emitted artefacts from scratch installs)

Legend: N native-enforced, E adapter-emulated (copy of same code on host hook API), A advisory (text only), U unsupported/absent, V version-dependent, ? unknown.

| Capability | CC flat-copy | CC plugin delivery | Codex | Cursor | Emitter |
| --- | --- | --- | --- | --- | --- |
| Plan gate (Gate 1) | N (`gate-enforcement.cjs` PreToolUse Edit|Write, fail-closed) | same files as flat-copy (no distinct plugin payload) | E, only if project trusted + hooks version ≥0.142 (V); `apply_patch|Edit|Write` | E, `preToolUse` write matcher, `failClosed:true` | claude_code/mod.rs; bundles `kit/bundles/{codex,cursor}/root` |
| Privacy block | N (Bash, Edit|Write, Read) | same | E on Bash only (V) | E (beforeReadFile/Shell/MCP, fail-closed) | same |
| Pre-ship / Gate 2 | N (`pre-ship.cjs` PreToolUse Bash) | same | **U** (no hook; text only) | partly? shell-gate policy exists; Gate 2 verdict logic not found in bundle (grep shows no verdict check in tool/shell gates besides name matches) — UNKNOWN | — |
| Post-write scan | N via dispatcher (fail-open, toggleable) | same | U | U (telemetry only, "NO security-critical logic") | handlers.json |
| Observers (budget, loop, learning…) | N (fail-open) | same | U | E-lite telemetry-observers | — |
| Stop gate | N-ish: opt-in, capped, fail-open, toggleable (F-D04-10) | same | A/U (observe only) | `stop-followup` fail-open | — |
| Skills | N | same | E (`.agents/skills/mk-*`, 125 skills; 24k-char name+desc vs 8k discovery budget warns) | E (`.cursor/skills`) | bundles |
| Agents | N md | same | E TOML (41) ; `delegate_agent` unsupported per adapter | E (41) | bundles |
| Rules | N `.claude/rules` | same | A (AGENTS.md block, exec-policy rules) | A (`.cursor/rules/*.mdc`) | — |
| Memory | N files | same | E files (`.meowkit/memory`) | same | — |
| Statusline | N (`statusline.cjs`) | same | U | U | — |
| Model routing | A (text tiers + hint hook) | same | A | A | — |

Delta claim vs `providers --lifecycle`: matrix says Codex SessionStart/PostToolUse/Stop "supported" (host); kit registers none. Cursor "unknown" while 4 fail-closed gates shipped.

### 4b. Config layer × guard-off matrix

| Setting | Effect | Layer(s) able to set it | Lower-trust reachable? |
| --- | --- | --- | --- |
| `MEOWKIT_GATE1_PRESENCE_ONLY=1` | Gate 1 → plan-presence only, receipt unverified | env of the host process; logged to `security-log.md`, refused if unloggable | env: user/process only; not file-borne |
| `gate1PresenceOnly: true` | same | **user** config `~/.meowkit/config.yaml` only; project file cannot express it; refused if same file | persistent for all projects; project file no |
| `MEOWKIT_AUTOBUILD_MODE=LEAN` | contract-signed check bypassed (logged) | env only (`safety-path`, no config key; `autobuild.mode` sets density only) | no file layer |
| `MEOWKIT_HOOK_PROFILE`/`MEOW_HOOK_PROFILE` | `fast` profile for pre-ship/observers; test `gate2-ship-boundary` asserts `fast still blocks` | env | no file layer |
| `hooks.<observer>: false` | removes observer incl. `post-write`, `pre-completion-check`, `safety-sentinel-inject`, `loop-detection`, `build-verify` | **project** `.meowkit/config.yaml` (committed, PR-editable) | **yes** — this is the real lower-trust weakening |
| `MEOWKIT_TDD=false` | TDD off | env outranks file (only env-override key) | env |
| `tdd: false`, budget block thresholds | non-security | project/user | yes (non-guard) |
| `MEOWKIT_SKIP_SAFETY_SENTINEL` | skips sentinel injection (class skill-option) | env | env |
| Seven direct guards (gate-enforcement, privacy-block ×3, pre-ship, …) | no config/env off-switch | none (registered outside dispatcher) | only by editing `settings.json` or hooks (not a config layer) |

### 4c. Install-lifecycle risks

| Risk | CLI | Evidence | Status |
| --- | --- | --- | --- |
| Unverified kit zip executes as hooks | TS | no checksum | VERIFIED historical |
| Same-origin checksum only | Rust | RELEASING.md:583 | VERIFIED, documented |
| Release has no checksums.txt → init refused | Rust | observed vs v2.15.0 | VERIFIED |
| Foreign `node` hook shadows kit gates | TS | F-D04-05 | VERIFIED, fixed in Rust |
| `permissions` not merged | Rust | notice | VERIFIED, by design |
| Pre-existing AGENTS.md blocks Codex instructions | TS; Rust uses marker block | trial | VERIFIED |
| Uninstall restores user JSON | Rust yes | trial | VERIFIED |
| Backup holds config (credentials) | Rust | warning printed | VERIFIED |
| Install validates hook registration | TS no; Rust doctor yes + `--hard-gates` | trials | VERIFIED |
| Binary not installable (no pins) | — | F-D04-03 | VERIFIED |
| self-update trusts same release | Rust | self_update.rs:3 | VERIFIED |

## 5. Decisions proposed

| # | Decision | Class | Problem / source | Hypothesis & measure |
| --- | --- | --- | --- | --- |
| D1 | Keep single Rust CLI; do not resurrect TS | KEEP | F-D04-05/06 TS defects | measure: lifecycle_matrix green on 3 OS (exists) |
| D2 | Publish first `mewkit-v*` binary + pins, or state in README that `curl | sh` is unavailable until then; add `checksums.txt` to every kit release | IMPROVE | F-D04-03; `installer-pins.json` null, v2.15.0 lacks checksums | measure: `install.sh` succeeds in CI smoke; `init` from a release without `--allow-unverified-kit` |
| D3 | Trust-model honesty: keep "no signatures" text; consider SLSA/sigstore attestation | EXPERIMENT (low priority) / NEEDS MORE EVIDENCE | F-D04-06; maintainer decided against keys (ADR) | would need a threat-model decision; don't add without it |
| D4 | Correct `providers --lifecycle` `stop` row: mark `[gate]` only when `pre-completion-check` is enabled, opt-in and non-fail-open, or drop the gate label | IMPROVE | F-D04-10, source `pre-completion-check.cjs`, adapter text | measure: lifecycle text derived from handlers.json + config, test asserting claim ⊆ registered blocking hooks |
| D5 | Make lifecycle matrix report "host supports" vs "kit registers" separately (Codex 2 handlers) | IMPROVE | F-D04-09/10 | measure: matrix generated from emitted hooks.json |
| D6 | Cursor row: replace "unknown" with registered failClosed hooks + "not live-verified" | IMPROVE | F-D04-10 | same generation |
| D7 | Remove/rename `claude-plugin` delivery or ship a real plugin payload; fix manifest description | SIMPLIFY or REMOVE | F-D04-07 README contradiction | measure: README claim == files written |
| D8 | Add doctor check: plugin + flat-copy both present; and foreign-hook same-event awareness | IMPROVE only if plugin delivery survives D7; else delete the README sentence | F-D04-08 | demonstrated problem: README promises it, code lacks it |
| D9 | Restrict `hooks.post-write` / `hooks.pre-completion-check` off-switches to user scope or mark as hard-blocking-class | IMPROVE (requires user decision: toggles were deliberate) | F-D04-12 | measure: PR-edited config cannot disable security scan; `doctor` reports active toggles |
| D10 | `doctor` should report any `hooks.*: false` and `gate1PresenceOnly` presence | IMPROVE (cheap) | F-D04-12 | test: doctor fails/warns with toggle set |
| D11 | Cursor `validate --target` expand beyond 3 checks (hooks wiring, failClosed) | IMPROVE | F-D04-11 | measure: validate fails on removed hooks.json entry |
| D12 | Resolve the 521/231 dangling-reference notes: fix emitter rewrite or drop affected skills from Codex/Cursor | EXPERIMENT first (behaviour eval) | F-D04-11 | measure: agent task success on Codex with/without fix |
| D13 | `doctor` "mewkit on PATH: ok" when missing | SIMPLIFY/FIX | F-D04-08 | trivial |
| Control-plane ideas: capability detection (resolve is lexical, ambiguous) | REJECT as expansion; capability *resolve* could be DELEGATE TO HOST (Skill tool descriptions) | no demonstrated problem | |
| Enforcement verification | KEEP (`doctor --hard-gates`) | exists, real, caught F-D04-05 | |
| Dry-run install/uninstall; upgrade safety (ownership, backups, `--force`) | KEEP | exist | |
| Config-conflict detection (merge) | KEEP Rust merge; add D8/D10 only | | |
| Adapter validation | IMPROVE (D11) | | |
| Trace export, eval execution verb, provider "feature inspection" beyond current | REJECT | no demonstrated problem; no verb exists | |
| Security diagnostics beyond doctor/validate | DEFER | | |

## 6. Experiments that would falsify my conclusions
1. Install v2.15.0 kit with the Rust CLI `--allow-unverified-kit` in a real project and run `doctor --hard-gates` (should pass); falsifies "binary cannot work with published kit" only partly.
2. Real Codex ≥0.142: confirm `.codex/hooks.json` gates fire and whether `apply_patch` matcher actually triggers (V).
3. Real Cursor: run live gates; if `failClosed` hooks block, D6 upgrades Cursor above Codex in enforceability.
4. Place a PR-editable `hooks.post-write: false` and confirm post-write scan stops (config unit tests presumably exist; not run).
5. Agent behavioural eval on dangling references (F-D04-11).
6. Check whether Claude Code loads a project-level bare `.claude-plugin/plugin.json` (F-D04-07).

## 7. Unresolved
- Is unpublished binary/pins intentional pending release? (maintainer)
- Gate 2 on Cursor shell-gate: policy file `shell-guard-policy.cjs` (41 lines) not read in full.
- Can an agent write `~/.meowkit/config.yaml`? (hooks domain)
- Rust `upgrade` trial and Windows path not done.
- Why README still says plugin "nothing is copied" given the code comment.

**Status:** DONE_WITH_CONCERNS
**Summary:** Findings written for main@c7ff0a9e with fc278b31 items tagged; TS CLI retired, Rust is sole CLI.
**Concerns/Blockers:** baseline moved mid-audit; TS trials used stale dist; upgrade/Windows/live Codex-Cursor not tested.

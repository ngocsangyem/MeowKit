# 06 — CLI and adapter architecture study

Baseline: `main` @ `c7ff0a9e` (Rust `mewkit` is the only CLI). Sources: `findings/D04`, `R1`, `D10`, `D06`, `evidence-ledger.md`, plus my own re-verification (section 0). Labels follow `BRIEF.md`. D10/D06 host facts are DOCUMENTED-pending-citation-audit unless a local-repo source citation is given.

## 1. Summary

- One CLI on main: 23 verbs, 625 Rust files, 83,651 LOC; the TypeScript CLI is deleted from git (`git ls-files packages/mewkit` = 0). VERIFIED.
- **No release exists that a README reader can install.** `install.sh`/`install.ps1` pin nothing (`installer-pins.json` = `{stable:null,beta:null}`), no `mewkit-v*` release exists, and the only kit release (v2.15.0, 2026-07-27) has no `checksums.txt`, so Rust `init` refuses it without `--allow-unverified-kit`. This reads as an unreleased cutover (docs ahead of releases), not necessarily a shipped defect; maintainer intent is UNKNOWN.
- The documented root of trust ("branch protection on `main` requiring review", `RELEASING.md`) is not configured: GitHub reports `main` unprotected, no rulesets. VERIFIED (`gh api`, authenticated as owner). New vs D04.
- Install/lifecycle code is careful (URL prefix check, SHA-256, contract gate, hardened unzip, ownership-based uninstall, no-downgrade self-update). Its weakness is the trust model, which the maintainer documents: checksums come from the same release, no signatures.
- Per-host truth: Claude Code is native-enforced; Codex registers 2 hooks (plan gate + Bash privacy), no Gate 2; Cursor registers 4 fail-closed gates plus telemetry, no Gate 2, and has an undocumented kill switch. `providers --lifecycle` over-claims Claude `stop` and `subagent_stop`, under-claims Cursor, and describes Codex host capability rather than what the kit registers.
- `--delivery plugin` differs from flat-copy by exactly one file (`.claude-plugin/plugin.json`), contradicting the README sentence "nothing is copied into your project". Doctor has no plugin/flat-copy double-install check although README says it warns.
- Control-plane verdicts: KEEP `doctor --hard-gates`, dry-run, ownership/backups; IMPROVE the lifecycle table and doctor config-toggle visibility; DELEGATE TO HOST eval execution; REJECT trace export/new verbs. Rust rewrite stands; section 8 frames what it must deliver.

## 0. Verification record (a–i) — my own evidence on main

Build used: D04's binary `scratchpad/d04/cargo-target/debug/mewkit`, built 2026-11-15 03:13, after the last commit touching `crates/`/`kit/` (02:52, `612e91d8`), so equal to main source (INFERRED from mtimes). `target/debug/mewkit-next` in the repo is a stale pre-rename build (Nov 13) and was not used; no new cargo build run. Installs ran only into `scratchpad/w06` with a scratch `HOME`. Running `install.sh` was refused by the permission classifier, so (a) is by reading.

| # | D04 claim | Verdict | My evidence |
| --- | --- | --- | --- |
| a | installer pins null; `install.sh` pins nothing | **CONFIRMED** | `scripts/release/installer-pins.json` `{stable:null,beta:null}`; `install.sh:25-29` `pin()` has only `*) return 1`; `:84` then `die "this installer pins no $channel release…"` before any download. It fails closed (installs nothing). `install.ps1:62` same. `git tag`/`gh release list`: 0 `mewkit-v*` releases. Not executed. |
| b | kit release has no checksums; `init` refuses without flag | **CONFIRMED** (+nuance) | `gh release view v2.15.0`: one asset `meowkit-release.zip`, no `checksums.txt`. `kit/mod.rs:fetch` returns `KitError::Unverified` when `checksums_url` is None unless `allow_unverified`; origin then recorded `Unverified`. Nuance: release tooling emits `checksums.txt` since `9cb0c2e7` (2026-11-10, after v2.15.0), so the next kit release will carry one. Whether v2.15.0's zip also lacks `kit-contract.json`: UNKNOWN (zip not downloaded). Refusal not re-run (needs network download). |
| c | `--delivery plugin` writes kit into `.claude/` plus a manifest | **CONFIRMED** | `init/mod.rs:137-139` pushes `plugin_manifest()` onto the same plan. Offline trial (`--kit-dir`, hidden flag): plugin = 1230 files, native = 1229; `diff` of file lists = only `.claude-plugin/plugin.json`. Hooks stay in `.claude/settings.json` (keys `env,hooks,statusLine`). Whether Claude Code loads a bare project `.claude-plugin/`: UNKNOWN. |
| d | doctor has no plugin + flat-copy check; README says it warns | **CONFIRMED** | `grep -i plugin crates/mewkit-cli/src/commands/doctor` = none. Only duplicate checks: same runtime at both scopes (`installs.rs:19-24`). `README.md:59-60` claims the warning. Also `toolchain.rs:16-22` reports Status `Ok` for "`mewkit` is not on PATH" (informational by construction, but reads as a pass). |
| e | lifecycle rows vs registered hooks | **CONFIRMED / WEAKENED by row** | See section 4.3. Claude `stop` is a real but conditional gate (WEAKENED: label true narrowly, text wrong). New: `subagent_stop` row claims a hook "in shipped settings.json" while that array is empty (CONTRADICTED). Codex registers 2 hooks. Cursor rows `unknown` while 4 fail-closed gates ship. |
| f | which settings disable a guard | **CONFIRMED** | `handlers.json` toggles `post-write`, `pre-completion-check` via `hooks.<name>: false` in the committed project config. Trial: with both set, `doctor` reports only "1 edited (.meowkit/config.yaml)" and `doctor --hard-gates` is all `ok`. Direct guards and `gate1PresenceOnly` are unreachable from the project file (`gate1-hatch.cjs:1-20`). New: Cursor kill switch (section 5). |
| g | no signatures; checksum scope; self-update trust | **CONFIRMED** | `RELEASING.md:564,602`; `update/manifest.rs:1-4`; `update/mod.rs:5-6,102-108` refuses older/equal. |
| h | parity evidence | **CONFIRMED** (count refined) | 470 golden JSON + README in `tests/golden/npm/` (471 files); 371 `#[test]` fns under `tests/npm_behaviour` (D04's "371 cases" = test fns, not recordings); 3 baseline manifests. README: "can no longer be regenerated". `DIVERGENCES.md` last para: regeneration "manual and not gated in CI". `rust-ci.yml` runs `cargo test --workspace --locked` on ubuntu/macos/windows, plus fmt, clippy, cargo-deny. Regeneration from git history (`fc278b31`) is possible in principle (INFERRED), not scripted. |
| i | hook → CLI dependence | **CONFIRMED** (+ reverse) | `orientation-ritual.cjs:61-65` `orient --no-record`, `timeout: 5000`, failure falls back to labelled checkpoint cache. `memory-store-lint.cjs:92-102`: no `timeout` option (bounded only by the hook's 30 s registration), missing CLI → `SKIP` exit 0, non-zero CLI exit → block (exit 2). `pre-ship` runs Gate 2 first (`lib/core/pre-ship.cjs:56`) before the CLI-dependent lint, so a missing/hung CLI cannot weaken Gate 2. Reverse: Rust `plan approve` shells to the kit's node helper (`plan_doc/approve.rs:23`). |

Refuted: none. New findings from this pass: branch protection absent; Cursor kill switch; `subagent_stop`/`claude-plugin`/Codex-`config.toml` lifecycle text; npm 2.3.1 is registry-deprecated; no kit-downgrade check; doctor blind to disabled toggles.

## 2. What the CLI is on main

### 2.1 Verb inventory (re-derived from `enum Command`, `crates/mewkit-cli/src/main.rs:47-98`; `mewkit --help` agrees)

Test column: files under `crates/mewkit-cli/tests/`; `npm_behaviour/*_cases.rs` compare against frozen npm recordings. I did not read per-verb test bodies.

| # | Verb | Purpose | Reads | Writes | Network | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | init | install kit per runtime/scope | kit (cache/zip/dir), project/home | emitter files, settings merge, `.meowkit/{state,backups,cache}` | GitHub API+zip unless `--offline/--kit-archive/--kit-dir` | init_flags, lifecycle(_matrix), fault_injection, kit_sources |
| 2 | upgrade (`--check/--list`) | move to newer kit keeping edits | ownership index, kit | same as init | yes | upgrade_flags, lifecycle_matrix |
| 3 | uninstall | remove owned files; dry-run unless `--yes` | ownership index, cached kit | deletes unedited owned files, rewrites settings, backup | no (cache) unless `--kit-version` | lifecycle |
| 4 | doctor (`provenance`, `--hard-gates`, `--providers`, `--report`, `--state`, `--adopt`) | toolchain, installs, hook wiring | installs, hooks | none (hard-gates uses a scratch project) | no | doctor_cases, diagnostics |
| 5 | providers [`<p>`] `--lifecycle` | per-runtime support view | kit (or constants with `--lifecycle`) | none | cache/network unless `--offline` | npm_behaviour |
| 6 | versions | installed/cached/available kits | cache, GitHub listing | none | yes | npm_behaviour |
| 7 | self-update (`--check`) | replace binary, SHA-256 verified | `binary-manifest.json` | binary + `.old` | yes | binary_manifest |
| 8 | orient | resume orientation from durable state | tasks/, `.meowkit/state` | none with `--no-record` | no | orient cases |
| 9 | plan (status/check/approve/archive) | plan structure, Gate 1 receipt | `tasks/plans/` | approve stamps frontmatter (via node helper); archive moves | no | plan_* cases |
| 10 | note | lint-checked append to team memory | `.meowkit/memory/` | append | no | note_cases |
| 11 | task (new/list) | task files | tasks/ | new file | no | task_cases |
| 12 | task-state (show/update) | durable task record | state | state record | no | npm_behaviour |
| 13 | validate (`--target --memory --gates --substrate …`) | structure/wiring checks | project | none | no | validate_portable, npm_behaviour |
| 14 | verdict-gate | Gate 2 paperwork check (evidence, not approval) | verdict file | none | no | npm_behaviour |
| 15 | review (6 subs) | review prepare/read/compose/submit | git, `gh` | review session files | via git/`gh` | review_* cases |
| 16 | advice (4) | Athena checkpoints | evidence | advice records | no | advice_cases |
| 17 | trace (score/audit/propose, `--friction`) | trace recall | `.meowkit/telemetry` | friction notes | no | npm_behaviour |
| 18 | budget | spend from cost log | cost log | none | no | budget_cases |
| 19 | setup | post-scaffold config | project | `.mcp.json` only if absent (`setup/steps.rs:12-16`), `.meowkit/.env`, `.gitignore`, `docs/project-context.md`, per-skill envs | `--system-deps` / pip | setup_cases |
| 20 | skill (env) | per-skill interpreter envs | skills | `.meowkit/envs/<skill>` | pip | skill_env_cases |
| 21 | pack | install packs | manifest | install/remove | no | pack_cases, init_flags |
| 22 | capabilities | explain/resolve/project capabilities | kit manifest | none | no | capabilities_cases |
| 23 | backups | list/restore lifecycle backups | `.meowkit/backups` | restore | no | backups_cases |

`inventory` does not exist (D04 F-D04-01; old CLAUDE.md claim fixed on main). `migrate` and `visual-plan` were removed, not ported (`docs/maintainer/npm-cli-retirement.md`). VERIFIED.

### 2.2 TS → Rust cutover state

| Item | State on main | Label |
| --- | --- | --- |
| `packages/mewkit` | 0 tracked files; untracked gitignored `dist/`, `node_modules/` remain on this machine | VERIFIED |
| npm registry | `latest` = 2.3.1; `deprecated` message points to docs.meowkit.dev/installation (modified 2026-11-14) | VERIFIED (`npm view`). D04 said "no notice release"; a registry deprecation exists, not a new release. Retirement doc's "last npm release prints where the binary is" cannot describe the 2.3.1 code (INFERRED: deprecation is registry metadata) |
| Binary releases | none (`mewkit-v*` count 0; `RELEASING.md` still says "Run it once before the first tag") | VERIFIED |
| Kit releases | v2.15.0 latest, 2026-07-27; main is unreleased code (kit releases since then: none) | VERIFIED |
| Retirement criteria | doc states them in past tense ("retired once all held"); criterion 3 (a beta binary installed via `install.sh` and smoke-checked) has no release evidence; could have been done from a local build (UNKNOWN) | CONTRADICTED by release state / UNKNOWN |

Correction to the brief: README at `c7ff0a9e` does **not** say `npx mewkit init`; it has an IMPORTANT banner that npm `mewkit` is unmaintained and points to `curl … install.sh | sh`, then `mewkit init`. `docs/maintainer/mewkit-next-cutover.md` does not exist (D04 §1); `npm-cli-retirement.md` and `runtime-smoke-checklist.md` are the cutover docs.

### 2.3 What a new user following the README experiences today

| Path | Outcome | Label |
| --- | --- | --- |
| README `curl … install.sh | sh` (macOS/Linux) | dies at `install.sh:84`: "pins no stable release … yet" (fails closed, nothing installed) | VERIFIED by reading; not executed |
| README `irm … install.ps1 | iex` | same message (`install.ps1:62`) | VERIFIED by reading |
| `npx mewkit` / npm 2.3.1 | still installs a kit (first `.zip` asset, no checksum, per D04 F-D04-06 at `fc278b31`); deprecated, unmaintained; known gate-dropping settings merge (F-D04-05, historical) | VERIFIED (D04) |
| Build from source (`cargo build -p mewkit-cli`, 43 s offline per D04) then `mewkit init` | refused: "kit 2.15.0 has no checksums.txt … pass --allow-unverified-kit" (D04 observed); works with that flag or with `--kit-archive <zip> --kit-sha256` | VERIFIED (D04 observation + source) |
| Maintainer smoke (`runtime-smoke-checklist.md` step 1) | uses `install.sh` with `MEWKIT_CHANNEL=beta`, which also pins nothing | VERIFIED by reading |

Reading: main's docs and installers are ahead of any release. If a first `mewkit-v*` release plus pin PR is imminent, this is a transient state; the README should still say so until then (K-04).

### 2.4 Machine artefacts (not kit properties)

`mewkit` absent from PATH here (hooks skip CLI checks); stale `target/debug/mewkit-next`; leftover `packages/mewkit/dist`; `docs_cli` test failing locally due to untracked `packages/landing/.vercel/output` (INFERRED, D04); LEAN env from untracked `settings.local.json` (R1 §8). None changes sections 3–7.

## 3. Install lifecycle and supply chain

### 3.1 Per command (Rust, main)

| Stage | Fetch | Verify | Merge / own / backup | Evidence |
| --- | --- | --- | --- | --- |
| init | GitHub releases API (≤8 MiB listing) then zip (≤256 MiB) over https only | asset URL must start `https://github.com/ngocsangyem/MeowKit/releases/download/`; SHA-256 vs `checksums.txt` of the **same release**; `kit-contract.json` + `mewkitMin`; unzip refuses symlinks, dup names, traversal, >20k entries / 64 MiB file / 512 MiB total | settings merge keyed on matcher+command+args (foreign hooks kept, kit hooks added); `permissions` never merged (notice); ownership index; backup printed with a credentials warning; Codex `AGENTS.md` kit text inside `<!-- mewkit:begin -->` block | `kit/mod.rs`, `kit/extract.rs`, `kit/http.rs`; D04 F-D04-05/07 VERIFIED |
| `--kit-archive` | none | SHA-256 from `--kit-sha256` or a `checksums.txt` beside the zip | same | `kit_args.rs:38-55` |
| `--allow-unverified-kit` | as init | none; origin recorded `Unverified`; later offline reuse requires the flag again | same | `kit/mod.rs` |
| `--kit-dir` (hidden) | none | none ("not verified" notice) | same | `kit/mod.rs` `Source::Dir` |
| upgrade | as init | as init | plans old-vs-new hashes, keeps edited files unless `--force`; **no comparison of kit versions found in `upgrade.rs`**, so `--kit-version <older>` is accepted (grep absence; not executed) | `upgrade.rs:92-125` |
| uninstall | none | removes a file only if ownership is corroborated by the cached original kit; trial with a `--kit-dir` install: 1228 files kept, config entries removed, backup written, dry-run by default | restores user JSON; leaves `.meowkit/{backups,state}` | trial (scratch), D04 F-D04-07 |
| self-update | `binary-manifest.json` then archive | URL prefix check, SHA-256 + size from the manifest of the **same release**; never moves to older/equal; `min_supported` marks withdrawn versions | atomic replace, previous binary kept as `.old` | `update/*.rs`, `RELEASING.md:602-610` |
| install.sh | archive pinned by URL+SHA+size inside the script | size and SHA-256 vs pin before extraction; refuses unpinned | places `mewkit` and `mk` | `install.sh:84-112` |
| dry-run | init/upgrade/uninstall without `--yes` are dry runs; a downloaded kit is still cached | | | `init/mod.rs:100`; `--help` |

### 3.2 Threat table

| Threat | Existing mitigation | Residual risk |
| --- | --- | --- |
| Compromised kit release asset (zip and `checksums.txt` replaced together) | https-only, repo URL prefix, contract gate, hardened unzip, unverified origin recorded | Checksum is same-origin: detects corruption, not tampering (documented, `RELEASING.md:564`). A bad kit ships `.claude/hooks/*.cjs` + hook registrations that run as the user on the next tool call; nothing scans hook content. Claude Code runs settings-file hooks without a trust prompt (D10 F-D10-10, DOCUMENTED). GitHub exposes a per-asset `digest` (seen in `gh release view`); same trust domain, unused |
| Compromised binary release / `self-update` | SHA-256 + size from same-release manifest; no downgrade; withdraw floor | Anyone able to publish a release controls both (accepted cost, `RELEASING.md:610`) |
| Tampered `install.sh` (served from `main` over TLS) | pins inside the script; reviewed pin PR; installer refuses mismatching archive | Trust root = who can push `main`. Documented requirement "branch protection requiring review" is **not configured** (`gh api …/branches/main`: `protected:false`; rulesets `[]`). A solo-maintainer review requirement may be impractical; this is a maintainer decision (K-D2). Pins are currently null, so nothing is exposed until the first pin lands |
| Malicious pre-existing project config (cloned repo with its own `.claude/settings.json`, `.meowkit/config.yaml`) | Merge keeps foreign hooks and adds kit hooks (the TS CLI dropped the kit's gates here: F-D04-05, historical); `permissions` not imported; user-scope-only `gate1PresenceOnly` | Foreign hooks run regardless; doctor does not enumerate foreign hooks or committed `hooks.*: false` (trial). `doctor --hard-gates` probes a scratch project, so it proves the kit's hooks block, not that this project's registration is intact beyond "13 kit hook scripts found" |
| Downgrade | self-update refuses older; `mewkitMin` stops old binaries reading new kits | Kit downgrade via `--kit-version` is not compared with the installed version (grep); user-initiated, but silent |
| Backups hold secrets | warning printed; `.meowkit/.gitignore` denies `*` by default | user must keep `.meowkit/backups` private |

## 4. Per-host truth

Classes: N native-enforced · E adapter-emulated (same decision code on the host's hook API) · A advisory (text only) · U unsupported/absent · V version-dependent. Emitted artefacts from scratch installs and `kit/bundles/` (VERIFIED); host capabilities from D10/D06 (DOCUMENTED-pending-citation-audit, no host was run).

### 4.1 Truth table

| Capability | Claude Code flat-copy | Claude Code plugin delivery | Codex | Cursor |
| --- | --- | --- | --- | --- |
| Gate 1 plan gate | N: `.claude/hooks/gate-enforcement.cjs`, PreToolUse `Edit|Write`, timeout 10 s, **no `onFailure`** so a crash/timeout fails open (D10 F-D10-01) | identical files (diff = one manifest) | E+V: `.codex/hooks.json` `apply_patch|Edit|Write` → `.codex/hooks/gate-enforcement.cjs`; needs project trust and hooks ≥ 0.142 (D10 F-D10-04/10) | E: `.cursor/hooks.json` `preToolUse` write matcher, `failClosed:true`, copy of `core/plan-gate.cjs` |
| Privacy block | N: Bash, `Edit|Write`, Read matchers → `privacy-block.cjs`, 5 s | same | E: Bash only (no Read gate) | E: `beforeReadFile`, `beforeShellExecution`, `beforeMCPExecution`, all `failClosed:true` |
| Gate 2 / pre-ship | N: `pre-ship.cjs` on Bash, 30 s; structural paperwork proof, "not that a human approved" (`gate-rules.md`) | same | **U**: no hook, text only | **U**: shell policy has 45 lines of deny/ask patterns, no commit/push/verdict logic (VERIFIED by grep; upgrades D04 "UNKNOWN") |
| Post-write scan | N-advisory: dispatcher `post-write.cjs`, fail-open, detect-after-write (`post-write.cjs:1-10`), project-toggleable | same | U | U (telemetry only) |
| Stop gate | conditional: opt-in per plan, capped at 3, nudge in LEAN, none in MINIMAL, fail-open dispatcher, project-toggleable (`pre-completion-check.cjs`) | same | U (event exists on host; not registered) | `stop-followup` fail-open, not a gate |
| Observers / telemetry | N fail-open (`dispatch.cjs`, 13 handlers incl. SessionStart/PostToolUse/Stop/PreCompact/PostToolUseFailure) | same | U | E-lite `telemetry-observers.cjs`, fail-open |
| Skills | N `.claude/skills` | same | E `.agents/skills` (125 dirs) | E `.cursor/skills` |
| Agents | N `.claude/agents/*.md` | same | E `.codex/agents/*.toml` (41) | E `.cursor/agents` |
| Rules / instructions | N `.claude/rules` | same | A `AGENTS.md` block, `.codex/rules/default.rules` | A `.cursor/rules/*.mdc`, `AGENTS.md` |
| Team memory | N files in `.meowkit/memory/` | same | E same files, no lint hook | same |
| Status line, model routing | N `statusline.cjs`; routing A (tiers + hint hook) | same | U; A | U; A |
| Settings `permissions` | not imported by install (notice) | same | exec-policy file only | n/a |
| MCP | `setup` writes `.mcp.json` only if absent (no merge) | same | n/a | opt-in merge into `.cursor/mcp.json`, user config wins on conflict, cloud guard `--allow-cloud-mcp` |

Gate core libraries are byte-identical copies across `.claude/hooks/lib`, the Codex bundle and the Cursor bundle, enforced by `scripts/sync-hook-core.cjs --check` (D04 F-D04-09, VERIFIED): the same Gate 1 decision runs on all three, which is a real parity mechanism. Whether the host actually invokes the hook at the right time was not tested on Codex/Cursor (no live run).

### 4.2 Honest portability (what intent travels)

| Intent | Claude Code | Codex | Cursor |
| --- | --- | --- | --- |
| Instructions, SKILL.md skills, agents, memory files | native | native (agents converted to TOML) | native |
| Plan gate on source writes | native hook (file tools only; Bash writes evade, D10 F-D10-02) | emulated, trust and version dependent | emulated, fail-closed, Cursor `ask` not enforced on `preToolUse` (D10) |
| Sensitive-read block | native hook (host deny rules + sandbox would be stronger, D10 F-D10-03) | Bash only | emulated on read/shell/MCP |
| Commit gate (Gate 2) | native hook + CI-style structural proof | **not carried** | **not carried** |
| Post-write scan, stop gate, observers | advisory/fail-open | **not carried** | telemetry only |
| Human approval of a gate | advisory everywhere (file receipt; D10 F-D10-16); host `ask` is the only real primitive | not available on PreToolUse (ask rejected, D10) | partial |
| Tamper resistance | project tier only; real only via managed settings (D10 F-D10-09) | same | same |

Over-/under-claims: Claude `stop` `[gate]` and `subagent_stop` (over); `gating events: pre_tool, stop` summary (over, by the stop row); `claude-plugin` as a distinct column with "plugin payload/plugin generation" (over); Cursor all-`unknown` (under); Codex `session_start/post_tool/stop … supported` describes the host, kit registers none (mixed); README "fully enforced on Claude Code" omits fail-open default, Bash-write bypass and toggleable observers (D10-3). The README itself is honest that Codex gates "deter but do not block" and that bundle checks are structural parity.

### 4.3 Lifecycle-table rows vs registration (verification e)

| Row | Table says (`capability/lifecycle.rs`) | What ships | Verdict |
| --- | --- | --- | --- |
| Claude `pre_tool` gate | PreToolUse deny, proof test exists (`src/__tests__/hooks/gate-enforcement.integration.test.ts` present) | registered, fail-open on crash | accurate for the denying path |
| Claude `stop` gate | "pre-completion-check security-BLOCK, exit 2" | handler returns `{decision:"block"}` JSON, not exit 2; only when `verification-required.json` exists, MINIMAL returns null, LEAN nudges, 3 attempts then nudge; dispatcher fail-open; `hooks.pre-completion-check:false` removes it. Its own header calls enforcement "opt-in per plan" | WEAKENED: gate label real but conditional; evidence text wrong |
| Claude `subagent_stop` | "SubagentStop hook in shipped settings.json (observe)" | `.claude/settings.json` has `"SubagentStop": []`; emitted install has no such key | CONTRADICTED (ledger L-03 agrees) |
| Claude `prompt_submitted` | honest: no blocking handler | inject-only | accurate |
| claude-plugin | `bootstrap: sessionstart-hook-via-plugin-build`, "hook in the plugin payload (propagated at plugin generation)" | no plugin payload or build step exists (README says so) | CONTRADICTED |
| Codex | `lifecycle-hook … codex hook (config.toml)`; session_start/post_tool/stop/subagent_* "supported" | hooks live in `.codex/hooks.json` (config.toml has none); only PreToolUse ×2 registered | misleading: host capability shown where the kit registers nothing |
| Cursor | every event `unknown`; enforceable `unknown`; `gating events: none` | 4 fail-closed gates registered | under-claim; also inconsistent with the same output's `lifecycle-hook supported` row |

## 5. Config precedence and guard-disable matrix

Precedence in `config/precedence.rs` (D04 F-D04-12): env > flag > project > user > default, but only `tdd` ↔ `MEOWKIT_TDD` has an env form. Guards read separate code paths: hooks use `read-config.cjs`; Gate 1's hatch is a closed one-key reader. The committed config states "a gate is not a preference: there is no `gates.` or `paths.` key" and unknown keys are errors (`.meowkit/config.yaml:1-9`). VERIFIED.

| Layer | Setting | Effect | Reachable from lower-trust layer? |
| --- | --- | --- | --- |
| Project config (committed, PR-editable) | `hooks.post-write: false` | removes the after-write security scan (detect-only) | **yes** |
| Project config | `hooks.pre-completion-check: false` | removes the opt-in Stop gate | **yes** |
| Project config | `hooks.safety-sentinel-inject`, `loop-detection`, `build-verify`, … `false` | removes observers | yes (non-blocking class) |
| Project config | `tdd: false`, budget thresholds | non-security | yes |
| User config `~/.meowkit/config.yaml` | `gate1PresenceOnly: true` | Gate 1 → plan presence only; refused if user file == project file or the downgrade cannot be logged to `.meowkit/telemetry/security-log.md` | no (project file cannot express it) |
| Host process env | `MEOWKIT_GATE1_PRESENCE_ONLY=1` | same, logged | env only |
| Host process env | `MEOWKIT_AUTOBUILD_MODE=LEAN` | contract-signed check bypassed (logged) | env only (machine artefact here) |
| Host process env | `MEOWKIT_HOOK_PROFILE=fast` | skips build/lint/test block; ship gate still blocks (`lib/core/pre-ship.cjs:4-9,64-66`) | env only |
| Host process env | `MEOWKIT_CLI` | selects the executable the pre-ship memory lint runs | env only |
| Cursor bundle | `MEWKIT_CURSOR_HOOKS_KILL_SWITCH=1` **or** file `.meowkit/state/cursor-hooks-kill-switch` | downgrades deny/ask to allow on all four `failClosed` gates; stderr warning only, no durable log; no mention in docs/README (grep) | env: no; **file: a project-local file**. Whether an agent can create it: the write tool needs Gate 1 (`.meowkit/` is not in `NON_SOURCE`); the shell route depends on `shell-guard-policy.cjs`, not traced — UNKNOWN |
| `.claude/settings.json` | remove/alter hook registrations | disables direct guards | project files, outside the config schema; host-side protection per D10 F-D10-09 |

Security reading: the config schema is deliberately closed and the maintainer correctly kept the seven blocking checks off its surface (documented design; restating it is not a finding). Beyond it: (1) two weakenings from the project file are real but limited to a detector and an opt-in, capped, fail-open gate; whether to move them to user scope or mark them hard-blocking is a maintainer decision because toggles were deliberate (K-D3); (2) the Cursor kill switch violates the project's own "Recording Human Interventions / No Silent Override" rule (`gate-rules.md`) because it records nothing durable; (3) `doctor` does not show any of these toggles being on (trial), so a weakened project looks healthy; (4) none of this protects against an agent that edits `.claude/settings.json` or uses Bash writes (D10 F-D10-02/09, ledger L-05/L-12), which is a hook-domain finding already documented by the maintainer.

## 6. Coexistence

| Topic | Exists today | Does not exist | Host rule that already settles it |
| --- | --- | --- | --- |
| Other toolkits' hooks | merge keeps foreign hooks (matcher+command+args key) | no detection or report of foreign hooks, no ordering/conflict analysis | Claude Code merges all hook sources, runs matches in parallel, deny > defer > ask > allow (D10 F-D10-12) |
| Duplicate installs | doctor warns for same runtime at project + global scope (`installs.rs:19-24`); `adapters/scope.rs:97` privacy-hook notice | **plugin + flat-copy warning (README claims it)**; Cursor "skills may be listed twice" is only an emit-time note (`cursor/mod.rs:142`) | Claude Code: plugin skills are namespaced `plugin:skill`, project/personal/enterprise precedence is fixed; same-name agents: managed > project > user > plugin (D10 F-D10-12) |
| Name collisions | skills use the `mk:` prefix | no collision check against other toolkits | observed live: user-global toolkit and MeowKit both loaded with contradictory instructions (ledger L-07); host does not arbitrate instruction conflicts |
| MCP config | `setup` creates `.mcp.json` only if absent; Cursor merge keeps user entries | no Claude `.mcp.json` merge, no `.mcp.json` doctor check in Rust (TS had one) | host merges MCP scopes |
| Settings | settings merge, `permissions` not imported | no `statusLine`/`env` conflict report | host scalar precedence managed > CLI > local > project > user (D10) |
| Ownership | index of files + hashes; edits kept; uninstall confined to owned files | nothing for files another tool wrote under `.claude/` beyond "not corroborated, kept" | |

Reading: the host settles precedence for same-name items; what the CLI adds is the ability to say two installs exist. The one promised-but-missing check is the plugin/flat-copy warning (K-02).

## 7. CLI as control plane

Verdicts: KEEP · IMPROVE · EXPERIMENT · DEFER · REJECT · DELEGATE TO HOST. "Real" = exercises actual behaviour; "structural" = checks files/tables only.

| Hypothesis | Exists today | Real or structural | Demonstrated problem | Verdict |
| --- | --- | --- | --- | --- |
| Capability detection | `capabilities resolve` | lexical keyword overlap over descriptions; `--intent "search the web"` → ambiguous, 4 skills tied, "invocable: unknown" (D04 F-D04-14) | none shown | REJECT as expansion; skill selection is DELEGATE TO HOST (Skill tool listing) |
| Provider feature inspection | `providers --lifecycle`, `doctor --providers` | hand-written constants, not derived from emitted hooks | yes: rows contradict shipped hooks (section 4.3) | IMPROVE |
| Enforcement verification | `doctor --hard-gates` | real: runs the shipped hooks against a scratch project (7 probes, all `ok` in my trial) | caught the TS dropped-gates failure (F-D04-05) | KEEP |
| Compatibility diagnostics | `kit-contract.json` + `mewkitMin`; `versions` | real for kit↔binary; none for host version (e.g. Codex ≥ 0.142, `onFailure` needs Claude Code ≥ 2.1.295, D10) | not shown to have bitten | DEFER |
| Config-conflict detection | merge rules; `validate` | merge real; no report of committed `hooks.*:false` | yes: weakened config looks healthy (trial) | IMPROVE |
| Dry-run install | dry-run default for init/upgrade/uninstall | real | none | KEEP |
| Adapter validation | `validate --target codex|cursor` | Codex 16 structural checks; Cursor 3 checks, nothing on hooks (D04 F-D04-11, TS-era output) | Cursor hooks unverified | IMPROVE |
| Trace export | none (`trace` is recall/score) | – | none; Codex/Claude OTel exist (D10 F-D10-07, DOCUMENTED) | REJECT; DELEGATE TO HOST |
| Eval execution | none | – | no outcome data anywhere (WRITING-GUIDE); host ships `claude plugin eval` with with/without ablation (D10 F-D10-05, DOCUMENTED, not run) | DELEGATE TO HOST (an EXPERIMENT in using it, not a verb) |
| Upgrade safety | ownership index, backups, edit-preserving upgrade, atomic self-update with `.old` | real | kit downgrade silent (section 3) | KEEP; IMPROVE only the downgrade warning |
| Security diagnostics | doctor + validate + hard-gates | partial | supply-chain and toggle visibility gaps | DEFER (beyond K-06) |

Fourteen-question framework for items not REJECTED. Questions (verbatim): 1 What exact problem exists? 2 Where is it demonstrated in source code? 3 What is the observed impact? 4 What alternative explanations exist? 5 What evidence supports the diagnosis? 6 Can the host already solve it? 7 Can an existing MeowKit component solve it? 8 Can the mechanism be simplified? 9 Is a new component necessary? 10 What is the security impact? 11 What is the maintenance burden? 12 What is the runtime overhead? 13 How will improvement be measured? 14 How can the change be reverted? The row labels below abbreviate them by number.

| Q | Provider lifecycle table (IMPROVE) | Doctor config-toggle visibility (IMPROVE) | Adapter validation for Cursor (IMPROVE) | Eval via host (DELEGATE) | Enforcement verification, dry-run (KEEP) |
| --- | --- | --- | --- | --- | --- |
| 1 Exact problem | table claims differ from registered hooks | doctor is green with `post-write` and `pre-completion-check` off | `validate --target cursor` checks 3 things, none about hooks | no measurement of any MeowKit effect | none; exists |
| 2 Demonstrated in source | `lifecycle.rs` `claude_code()`/codex/default vs `settings.json` and bundles | `handlers.json` toggles vs `doctor/*` (no toggle check) | `kit/bundles/cursor/root/.cursor/hooks.json` vs validate | no eval verb in 23 verbs | `doctor/hard_gates` |
| 3 Observed impact | users/docs read "stop gate", Cursor "unknown" | weakened project undetected (trial) | removing a hook entry would not fail validation (INFERRED) | H1/H2 unanswerable | caught F-D04-05 |
| 4 Alternatives | wording drift only | toggles intended | covered by manual smoke | cost/noise | – |
| 5 Evidence | section 4.3 (VERIFIED) | trial (VERIFIED) | D04 (TS-era run) | D10 F-D10-05 (DOCUMENTED) | trial |
| 6 Host can solve? | no | no | no | yes, `claude plugin eval` (Claude Code only; Codex/Cursor UNKNOWN) | no |
| 7 Existing component? | `capabilities`/`validate` | `doctor --report` | `validate` | `mk:benchmark`/`mk:evaluate` (manual) | – |
| 8 Simplify? | generate rows from `handlers.json`+emitted hooks.json instead of constants | list non-default config keys | assert hook entries present | – | – |
| 9 New component? | no | no (a doctor row) | no | no | no |
| 10 Security impact | removes false assurance | shows weakened guards | exposes fail-closed wiring | eval sandbox: runs agent sessions | none |
| 11 Maintenance | lower (derived) | small | small | host-owned | existing |
| 12 Runtime overhead | none | negligible | negligible | per-run model cost | one scratch run |
| 13 Measurement | test: every `gate:true` row ⊆ registered blocking hook; doc/CLI claim audit | doctor warns when any `hooks.*:false`/hatch present | validate fails when a hooks.json entry is removed | with/without pass-rate delta on pinned model | stays green in 3-OS matrix |
| 14 Revert | revert commit; table is constants today | remove check | remove check | do not adopt | – |

## 8. Was the Rust rewrite justified by evidence in the repo?

Decision already taken and merged (PRs #49-#52); not relitigated.

| Source | Rationale found | Label |
| --- | --- | --- |
| ADR `261110-rust-adapter-contract` (D04 F-D04-04) | per-runtime branching in TS; one emitter contract; rollback journal and ownership | DOCUMENTED, cited by D04 |
| ADR `261110-two-release-streams` | native binary, six targets, SHA pins | DOCUMENTED |
| Performance | no claim in repo. Measured on D04's machine: `orient --no-record` TS 168 ms, Rust debug 19 ms, bare `node -e 0` 78 ms | VERIFIED (D04), one machine |
| "No Node" | not claimed; hooks still need Node ≥ 24 | VERIFIED |
| Observed defect the rewrite fixes | TS merge dropped kit gates when a foreign `node` hook existed (F-D04-05); no checksum on kit fetch (F-D04-06) | VERIFIED |
| Cost accepted | 83.6k Rust LOC (16.7k tests, ~1,660 `#[test]`) replacing ~65k TS; `migrate` (15.2k) and `visual-plan` (3.1k) dropped; gate-affecting hooks still in JS, so two languages remain with a Rust↔JS reader-agreement test | VERIFIED |

What it now has to deliver to pay for itself: (1) an installable first release (binary pins, `checksums.txt`) so the correctness gains reach users; (2) parity evidence that is more than a frozen recording: 470 recordings cannot catch kit-side drift, and regeneration is neither possible nor CI-gated; the lifecycle matrix on three OS is the live guard; (3) the lifecycle table and doctor deriving claims from emitted artefacts, which the typed core makes cheap; (4) the live Codex/Cursor smoke checklist actually recorded. Startup gain is real but off the gate path (every Edit still spawns node hooks).

## 9. Recommendations

Gaps in the recommendation fields below are stated; "Revert" is generally a commit revert.

### A. Correctness and security fixes (verified by me)

**K-01 Make lifecycle claims derived and true** (IMPROVE)

| Field | Content |
| --- | --- |
| Observed problem | `subagent_stop` row claims a shipped hook that is an empty array; Claude `stop` evidence says "exit 2" and omits opt-in/cap/fail-open; `claude-plugin` text names a non-existent payload; Codex row cites `config.toml`; Cursor all `unknown` while 4 fail-closed gates ship |
| Affected source | `crates/mewkit-core/src/capability/lifecycle.rs` (`claude_code`, `claude_plugin`, `codex`, default arm) @ `c7ff0a9e` |
| Causal hypothesis | rows are hand-written constants not tied to `handlers.json`/emitted `hooks.json` |
| Proposed change | split "host supports" from "kit registers"; generate "registers" from the emitted hook config; add a Cursor map; fix the stop text; add a test that every `gate:true` row maps to a registered blocking hook |
| Evidence | section 4.3 (VERIFIED); D04 F-D04-10 |
| Alternatives | reword constants only; do nothing; delegate (none: host has no such view) |
| Expected benefit | `providers --lifecycle` cannot over-claim again |
| Measurement | new test fails on a row without a registered hook; docs claim audit |
| Risks | changes wording users may script against (minor) |
| Revert | revert commit |

**K-02 Resolve the plugin/flat-copy contradiction** (IMPROVE or REMOVE the claim)

| Field | Content |
| --- | --- |
| Observed problem | README says doctor warns on double install and plugin delivery copies nothing; code writes the full kit plus one manifest; doctor has no such check |
| Affected source | `README.md:59-60,72,81-90`; `init/mod.rs:137`; `claude_code/kit_dir.rs:57-72`; `doctor/installs.rs` |
| Causal hypothesis | README written for an earlier plugin design; the emitter changed |
| Proposed change | smallest: edit README (line 72 vs 84 already disagree) and drop the doctor sentence; or implement the check only if plugin delivery is kept (K-D1) |
| Evidence | verification c, d (VERIFIED, trial) |
| Alternatives | ship a real plugin payload; remove `--delivery plugin`; delegate to host (marketplace) |
| Expected benefit | docs equal behaviour |
| Measurement | `docs_cli` test covers README claims; add assertion |
| Risks | none for a doc edit |
| Revert | revert commit |

**K-03 Cursor kill switch: record or remove** (IMPROVE)

| Field | Content |
| --- | --- |
| Observed problem | env var or flag file silently turns four fail-closed security gates into allow; stderr only; undocumented |
| Affected source | `kit/bundles/cursor/root/.cursor/hooks/lib/cursor-hook-runtime.cjs:42-70`, `lib/security-gate-decision.cjs` |
| Causal hypothesis | operational escape hatch for broken hooks, never aligned with the intervention-recording rule |
| Proposed change | write a durable entry to `.meowkit/telemetry/security-log.md` on every downgrade (as `gate1-hatch.cjs` does) and refuse when unloggable; document it; consider env-only |
| Evidence | source read (VERIFIED); `gate-rules.md` Rule 1 |
| Alternatives | delete the switch (fail-closed gates that cannot be turned off lock users out when a hook breaks); keep as is |
| Expected benefit | a disabled gate leaves a trace |
| Measurement | test: switch active → log line exists; log unwritable → gate stays closed |
| Risks | a hatch that cannot log refuses to open |
| Revert | revert commit |

**K-04 Doctor: show weakened guards and fix "ok" on missing binary** (IMPROVE)

| Field | Content |
| --- | --- |
| Observed problem | with `hooks.post-write:false` and `hooks.pre-completion-check:false` doctor and `--hard-gates` show no warning; `mewkit on PATH` reports `ok` when absent |
| Affected source | `crates/mewkit-cli/src/commands/doctor/{mod,installs,toolchain}.rs` |
| Causal hypothesis | doctor checks files and hook scripts, not config state |
| Proposed change | one row listing every `hooks.*:false` and any `gate1PresenceOnly`/kill-switch present, WARN level; PATH row `warn` when the running binary is not the one on PATH |
| Evidence | trial (VERIFIED) |
| Alternatives | do nothing (toggles are deliberate); report only in `--report` |
| Expected benefit | a weakened project is visible |
| Measurement | doctor test with toggle set expects WARN |
| Risks | noisy for projects that disable observers on purpose |
| Revert | revert commit |

### B. Honesty fixes to docs and CLI output

**K-05 State the release status** (IMPROVE docs). Observed: README's install command fails today; maintainer docs say retirement criteria "held". Affected: `README.md:39-56`, `docs/maintainer/npm-cli-retirement.md:21-31`, `RELEASING.md`. Change: add one line under "Install the CLI" that the first binary release is pending (until it is), and make the retirement doc distinguish "met in CI" from "met in a release". Evidence: verification a, b; section 2. Alternatives: publish the beta first (K-D1). Measurement: `installer_script` test or a doc check that README install text matches non-null pins. Risk: none. Revert: revert.

**K-06 Say what the checksum covers, in the CLI too.** The `--allow-unverified-kit` message and `RELEASING.md:564` are accurate; add one sentence to the README that the kit checksum is same-origin and that `--kit-archive … --kit-sha256` with a digest obtained elsewhere is the stronger path. Evidence: F-D04-06, verification g. Revert: revert.

**K-07 README host claims.** Add the per-host rows of section 4.1 (Gate 2 absent on Codex and Cursor; Cursor registers fail-closed gates but untested live; Claude guards fail open by default and do not cover Bash writes, D10-3/D10-5). Evidence: sections 4.1-4.2. Measurement: checklist audited against adapter code.

### C. Experiments

**K-08 EXPERIMENT: live Codex and Cursor gate runs** (`runtime-smoke-checklist.md` items) recorded in a dated report, to falsify "E" cells in 4.1 (does the `apply_patch|Edit|Write` matcher fire; does Cursor `failClosed` block).

**K-09 EXPERIMENT: `claude plugin eval` with/without ablation** on a minimal packaged MeowKit (D10-4); the CLI needs no eval verb. Measure pass-rate delta on pinned model, ≥5 runs per case.

**K-10 EXPERIMENT: onFailure semantics.** Register the three write guards with `onFailure:"block"` on Claude Code ≥ 2.1.295 behind a version probe and fault-inject (D10-1/E1). The emitted `settings.json` has no `onFailure` today (VERIFIED). This is a hook-domain change; listed because the CLI emits the registration.

**K-11 EXPERIMENT: dangling-reference notes** (Codex 521, Cursor 231 at D04 time) — behavioural eval before changing the emitter (D04 D12).

### D. Maintainer decisions with options

**K-D1 Plugin delivery.** Decision as found: `--delivery plugin` exists and README calls plugin "recommended". Evidence: one manifest only; no marketplace publication (README says so). Options: (keep) ship a real payload and the doctor check; (change) remove `--delivery plugin` and the `claude-plugin` provider column; (hybrid) keep the flag documented as "same kit plus manifest, for evaluation with `claude plugin eval`". Trade-off: host-native evals (K-09) want a plugin; maintenance of a second shape.

**K-D2 Root of trust for the first release.** Options: enable branch protection or a ruleset on `main` (solo maintainer: required review may be impractical, so consider signed commits/required status checks); keep unprotected and amend `RELEASING.md`; add attestation/signing (maintainer decided against keys per D04 D3). Verify GitHub features before choosing (UNKNOWN here).

**K-D3 Project-file toggles for `post-write` and `pre-completion-check`.** Options: keep (documented as observers); move to user scope; mark hard-blocking class. Trade-off: the first is a detector, the second opt-in and capped, so the security gain is modest; but PR-editable weakening is the only lower-trust path found.

**K-D4 Kit downgrade.** Options: warn on `--kit-version` older than installed; refuse without `--force`; keep.

## 10. Not covered and open questions

Not covered: Rust `upgrade` end-to-end trial; Windows paths and `install.ps1` behaviour; live Codex/Cursor/Claude-plugin runs (all host columns are source/doc reading); `review`, `advice`, `budget`, `pack` internals; the published v2.15.0 zip contents (contract file); docs.meowkit.dev install page content; whether Claude Code loads a bare project `.claude-plugin/`; whether Cursor's tool-gate or shell policy blocks creating the kill-switch file; whether an old npm `mewkit` on PATH makes pre-ship's `validate --memory` fail (and thus block commits; INFERRED risk, not run); hook behaviour under D10's unread sections (Stop payload, listing budget).

Open questions: Is the unpublished binary/pins state intentional pending a first `mewkit-v*` tag? Was branch protection ever configured (rulesets may have been removed)? Why does the retirement doc describe criterion 3 as met? Is the Cursor kill switch intended for users or maintainers?

Qwen-code as a realistic extra target, as an option only: its Claude-plugin converter maps commands/agents/skills/hooks/`.mcp.json`, rewrites `.claude` paths to `.qwen`, and project hooks need folder trust plus hash-bound approval (D06 F-D06-12/15, VERIFIED in a reference clone at `9d390e23`; fidelity beyond those five resource kinds UNKNOWN). Exit-code semantics differ from Claude Code: plain-text hooks treat any exit other than 0/1 as deny, JSON path only 2 (D06 F-D06-15), and infra errors fail open, so a copied `exit 2` guard would still block but a crash policy differs. Fidelity expectation: instructions/skills/agents advisory, Gate 1 emulated, Gate 2 untested. Others in D10 (Gemini CLI: hook exit 2 blocks, `CLAUDE_PROJECT_DIR` alias; OpenCode/Pi: in-process TS only, naive hook port REJECTED by D10-9) are DOCUMENTED-pending-citation-audit.

**Status:** DONE_WITH_CONCERNS
**Summary:** Compiled deliverable 06 with verdicts on a–i verified on main, using the coordinator's 14 questions in section 7.
**Concerns/Blockers:** No live host runs; `install.sh` execution was refused so (a) is by reading; the CLI used is D04's build of main source (not rebuilt).

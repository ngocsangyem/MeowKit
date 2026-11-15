# Verification findings (step 4d, Full tier)

Four read-only verifiers checked the five phase files against `main` @ `c7ff0a9e` on 2026-11-15.
This file holds what they found that the first draft missed or got wrong. Verified claims are
counted, not listed.

| Role | Verified | Failed | Unverified |
| --- | --- | --- | --- |
| Fact Checker | 75 | 0 | 0 |
| Flow Tracer | 44 | 4 | 3 |
| Contract Verifier | 31 | 4 | 0 |
| Scope Auditor | 25 | 24 | 0 |

## Phase 1 — fixtures

- Replay fixtures must isolate `HOME`: `.claude/hooks/lib/read-config.cjs:70-86` merges `~/.meowkit/config.yaml` `hooks.*` toggles into decisions.
- Cursor kill switch is an env var or a persistent flag file under `.meowkit/state` (`kit/bundles/cursor/root/.cursor/hooks/lib/cursor-hook-runtime.cjs:42-69`); fixtures clear both.
- Ship-check cases exist only for Claude Code: `bundled` has no `core/pre-ship.cjs`; Codex and Cursor register no ship check.
- No behavioural test exists for the Cursor guards (unverified beyond structural references).
- `tests/hooks/golden/` holds about 30 gate, pre-ship and completion recordings from the existing replay suite.

## Phase 2 — consumers of the gate code the draft did not list

Hooks and scripts:
- `.claude/hooks/lib/plan-discovery.cjs` — only consumer is the plan gate; listed in `bundled` (`core-closure.json:51`).
- `.claude/hooks/lib/validate-workflow-evidence.cjs`, `validate-review-coverage.cjs` — reached only through the review gate; mirrored by `crates/mewkit-cli/tests/npm_behaviour/hook_mirrors/workflow_evidence.rs`.
- `.claude/skills/sprint-contract/scripts/{check-contract-signed,validate-contract}.cjs:13`, `.claude/skills/cook/scripts/validate-gate-2.cjs:16` — skill shims requiring gate libs; bundle copies exist.
- `.github/workflows/ci.yml:52-53` — step "Cook gate contract tests" runs `cook/scripts/test-scripts.sh`.
- `.claude/hooks/lib/config-keys.cjs:22-26` and `crates/mewkit-core/src/config/schema.rs:41-51` — `PROTECTED_HOOKS` lists `gate-enforcement` and `gate2-check`.
- `gate1PresenceOnly` user-scope key — `schema.rs:60`, `.claude/hooks/lib/config-rules.cjs:22`, `tests/config/fixtures/reject-user-scope-only.yaml`.
- `tests/hooks/golden/` gate and pre-ship recordings; `scripts/lib/hook-corpus-cases-*.cjs`; `tests/hooks/{env-allowlist,crash-paths,isolation}.test.ts`; `core-closure.test.cjs:56` hard-codes `plan-gate`.

Rust:
- `crates/mewkit-cli/src/commands/verdict_gate.rs` (46 lines, `mod.rs:24`, verb at `main.rs:74`) and `crates/mewkit-core/src/verdict_gate.rs` (147 lines).
- `crates/mewkit-cli/src/commands/plan.rs:45` — `PlanCommand::Approve`.
- `crates/mewkit-core/src/validate/packs_safety.rs:20-32` — hard-fails when gate libs are missing from the base pack.
- `crates/mewkit-core/src/validate/substrate.rs:27`, `crates/mewkit-cli/src/commands/doctor/hook_commands.rs:77`, `crates/mewkit-adapters/tests/emit_global.rs`, `schemas/harness-metadata-schema.json`, three golden baseline manifests.
- Gate code totals about 1,860 lines: `doctor/hard_gates/` 734, `plan_doc/approve.rs` 221, `receipt.rs` 249, core `verdict_gate.rs` 147, CLI `verdict_gate.rs` 46, `validate/gate_authority*.rs` 463.

Retirement on upgrade:
- `upgrade` does not read `deletions.json`; only `scripts/generate-release-manifest.cjs:97` does, and its paths are `.claude`-relative (`:94`).
- Files leave existing installs through `drop_retired` (`crates/mewkit-cli/src/commands/mod.rs:189`), which diffs the ownership index against the new kit; stale hook registrations are stripped by id (`crates/mewkit-core/src/exec/decide.rs:242`).

Ship check order (`.claude/hooks/lib/core/pre-ship.cjs:42`): load gate2 check, match ship regex, memory lint, fast-profile exit, then test/lint/type-check. A missing `gate2-check.cjs` blocks every Bash command (`:43`). Under `MEOWKIT_HOOK_PROFILE=fast` the test block does not run.

Test surface, exact verb counts in `crates/**/tests`: `plan approve` 35 files, `verdict-gate` 11, `validate --gates` 4, `doctor --hard-gates` 27 (25 are `validate-*.json` recordings pinning the hint text from `validate/mod.rs:111`).

## Phase 3 — consumers of `gate-rules.md`

- `crates/mewkit-core/src/validate/structure.rs:15-23` — `ALWAYS_ON_RULES` requires the file; feeds `packs_safety`.
- `scripts/rule-survival-oracle.cjs:12,55-64` — pins the file and Gate 1/2 needles.
- `.meowkit/pack-manifest.json:15`, `.meowkit/harness-inventory.json:25`.
- About 20 `crates/mewkit-cli/tests/golden/npm/validate-*.json` recordings name the file.
- Agent count: 13 of 42 agent definitions carry gate lines; the other two matches are index files.
- Codex has one non-markdown rules file, `kit/bundles/codex/root/.codex/rules/default.rules`.

## Phase 4 — state scope

- The trace log is cumulative across sessions with 50 MB rotation (`.claude/hooks/lib/trace-log.cjs:22,64`); a per-session reading needs the `run_id` filter (`:28-35`).
- `file_edited` is written only by `handlers/learning-observer.cjs:56`, which is skipped under the fast profile (`:31`) or when toggled off.
- No handler writes test or build evidence; `review-evidence-tag.cjs:27` records only review-read events.
- `precompletion-attempts.json` is per-project, keyed by plan slug, and survives session reset.
- `budget-state.json` is never reset by `resetSessionState` (`handlers/project-context-loader.cjs:71-91`).
- A third density source exists: `pre-completion-check.cjs:96` reads `autobuild.mode`.
- `feedback: true` already exists in `dispatch.cjs:36,42,91,96,103`; it only orders output last and emits no host JSON. Producers today: `pre-completion-check.cjs:90`, `post-write.cjs:95`.
- `tests/hooks/golden/precompletion-*.json` and `scripts/lib/hook-corpus-cases-feedback.cjs:20` encode the old arming semantics.
- `mk:lazy-agent-loader` consumers: bundle `mk-lazy-agent-loader` copies, `kit/bundles/*/catalog/skill-packs.json`, `mk:context-audit` references, `scripts/seed-ownership-metadata.cjs`.

## Phase 5 — what can weaken a guard

- `privacy-block` and `pre-ship` are protected: config can disable observers only (`.claude/hooks/lib/config-rules.cjs:73-78`).
- Weakening paths that exist: observer toggles (`hooks.post-write`, `hooks.pre-completion-check`), `MEOWKIT_HOOK_PROFILE=fast`, the Cursor kill switch.
- No test asserts the `detail` key of `doctor --json` rows (`diagnostics.rs:73`, `lifecycle_matrix.rs:112` assert `name` and `status` only).
- `tasks/` is excluded from the kit archive (`scripts/kit-ship-set.cjs:74-79`) and this plan directory is untracked.

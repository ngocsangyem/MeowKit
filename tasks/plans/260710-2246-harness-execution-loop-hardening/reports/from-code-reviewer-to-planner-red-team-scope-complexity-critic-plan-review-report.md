---
role: code-reviewer
audience: planner
type: red-team-scope-complexity-critique
plan: 260710-2246-harness-execution-loop-hardening
---

# Red Team: Scope & Complexity Critique

Posture: hostile YAGNI review of the plan document only (no code changes evaluated). All findings grep/read-verified against `meowkit/` source and the plan files themselves.

## Finding 1: Command Registry (Phase 5) duplicates Inventory (Phase 4) for the identical "command" surface

- **Severity:** Critical
- **Location:** phase-05-command-workflow-wiring.md:23-31 ("canonical command registry declaring intent, executor, inputs, produced artifacts, state transitions"; `Create: packages/mewkit/src/core/command-registry/`), vs phase-04-inventory-as-capability-authority.md:27,49 (`InventoryEntry` gains `capability, producer, consumer, activation, enforcement` for the same `command` artifact type; Success Criteria #2: "Every critical artifact (hooks, handlers, gates, state files, **commands**, workflow spec) has owner, activation, enforcement, and consumer populated").
- **Flaw:** `ArtifactType` in `meowkit/packages/mewkit/src/core/build-inventory.ts:14` already declares `"command"` as a first-class type. Phase 4 explicitly commits to populating `producer/consumer/activation/enforcement` for every command entry. Phase 5 then independently builds a second, structurally different authority (`command-registry.json`/YAML: `name, surface, intent, executor, produces, conflicts_with`) covering the exact same 21 CLI subcommands + 25 slash commands (both counts grep-verified below). Phase 5's text contains zero occurrences of the word "inventory" (`grep -c inventory phase-05*.md` → 0) — no cross-reference, no reuse, no "source from Phase 4" instruction. Compare this to Phase 4 step 2, which explicitly avoids this exact mistake for hooks: "source `producer`/`consumer`/`enforcement` for hooks from the Phase 2 hook manifest instead of hand-typing." The plan applies the anti-duplication rule to hooks but not to commands, against its own stated audit principle ("Mở rộng MeowKit inventory, không tạo registry thứ hai" / "extend inventory, don't create a second registry" — audit §6 row 4).
- **Failure scenario:** Team implements both in parallel (plan.md:47 explicitly schedules "4 and 5 can run in parallel"), producing two JSON authorities describing the same 46 commands with different field names and no reconciliation rule. Six months later a command's actual executor changes; the inventory entry and the command-registry entry drift independently, and neither phase's CI check (`inventory --check`, `validate --commands`) catches divergence between the two files because each only validates itself against its own source (dispatch switch / frontmatter), not against each other. This recreates the exact "two sources of truth" bug pattern (HOOKS_INDEX.md vs actual writers) the plan was created to fix.
- **Evidence:** `build-inventory.ts:14` (`ArtifactType = "skill" | "agent" | "rule" | "command" | "hook"`); phase-04:27,40,49; phase-05:23-31; plan.md:47 (parallel scheduling); `grep -n "inventory" phase-05-command-workflow-wiring.md` → no matches.
- **Suggested fix:** Merge Phase 5's registry into Phase 4's inventory schema — add `intent`, `executor`, `produces`, `conflicts_with` as inventory fields for `type: command` entries, and make Phase 5 a consumer/query layer (`validate --commands`) over Phase 4's data, the same way Phase 4 consumes Phase 2's hook manifest. Re-sequence so Phase 5 depends on 4, not just 1.

## Finding 2: Four to five new generated JSON/data authorities added in one plan, with no ownership or consolidation story

- **Severity:** High
- **Location:** phase-01:39-46 (`active-run.json`, `verification-required.json`, `RESULT-<run_id>.json` envelope), phase-02:34 (`hook-manifest.json` generator), phase-04:27-33 (expanded `harness-inventory.json` schema + capability query), phase-05:30 (`command-registry.json`/YAML), phase-06:32 (`core/contracts/` module + per-provider role declaration artifact).
- **Flaw:** The plan's own overview (line 21) says the goal is to close one loop, not expand catalog machinery, yet it introduces 5-6 new or structurally-expanded machine-readable authorities, each with its own CI drift check (schema tests, manifest-vs-settings CI, `inventory --check`, `validate --commands`, golden fixture byte-identity guard). No phase or the plan.md addresses who owns cross-authority consistency once all 5 exist, nor whether any of them should be merged (see Finding 1). This is the same "generated docs multiply, hand-maintained truth drifts" problem the plan diagnoses in HOOKS_INDEX.md (phase-01:19) and README counts (phase-04:20-21), now reproduced at a larger scale with more moving parts than existed before the plan.
- **Failure scenario:** A future contributor adding a new CLI command must now update: `command-registry.json` (Phase 5), inventory `command` entry (Phase 4), and possibly `hook-manifest.json` if it triggers a hook. Three CI checks, three schemas, one PR. The plan does not specify a single "how do I add a command" doc/checklist, so this becomes tribal knowledge exactly like the current undocumented producer gaps the plan is fixing.
- **Evidence:** phase-01:39-46, phase-02:34, phase-04:27-33, phase-05:30, phase-06:32; no consolidation step appears in any phase's "Implementation Steps" or in plan.md's Acceptance section (plan.md:51-58).
- **Suggested fix:** Add an explicit "authority map" acceptance criterion at the plan level (plan.md Acceptance) listing all generated files and which one is canonical for which fact, or fold Phase 5's and Phase 6's per-provider declaration artifact into the Phase 4 inventory as the task's own audit recommends.

## Finding 3: Phase 7's trace corpus for "adherence scoring" is a producer with no consumer — the exact defect class this plan exists to fix

- **Severity:** High
- **Location:** phase-07-end-to-end-validation-matrix.md:33 — "a small trace corpus from real prompts with expected capability use (drives adherence scoring, audit §6 'nên học')."
- **Flaw:** `grep -n "adherence" phase-07*.md` returns exactly one line — the fixture-rationale sentence. No Implementation Step (lines 42-49), Success Criterion (51-58), or Related Code File (36-40) actually builds an adherence-scoring feature. The plan's own Phase 1 overview (line 14) diagnoses this precise pattern as the core problem: "state has readers without producers" / files exist with no consumer. Here the plan reproduces it in reverse — it commits engineering effort to build a *producer* (the trace corpus fixture) for a *consumer* (adherence scoring) that is never specified, staffed, or scheduled anywhere in the 7 phases.
- **Failure scenario:** Team builds and maintains a "trace corpus from real prompts" (non-trivial: requires curation, PII scrubbing, refresh cadence per phase-07's own risk register line 64), ships it, and it sits unused because no phase implements a scorer that reads it — identical to today's `session-state/active-plan.json` having hook consumers but no producer, just inverted.
- **Evidence:** phase-07:33 (sole mention); phase-07:42-58 (no scoring step/criterion); phase-01:14 (the pattern this plan calls out).
- **Suggested fix:** Cut the trace corpus from this plan's scope entirely (defer to a future phase that actually implements adherence scoring), or add a minimal consumer + success criterion in Phase 7 if it's meant to ship now.

## Finding 4: Phase 4's "release deadline" for flipping substrate warnings to CI failures is unspecified — same "aspirational doc" defect being fixed elsewhere in this plan

- **Severity:** Medium
- **Location:** phase-04-inventory-as-capability-authority.md:40 ("non-critical skills/agents keep tag-on-touch **with a release deadline** — `validate --substrate` warning becomes failure after the declared version") and :57 ("a dated deadline converts the warning to failure on schedule").
- **Flaw:** No version number, date, or milestone is declared anywhere in phase-04.md or plan.md for this deadline. "The declared version" and "on schedule" reference a schedule that doesn't exist in the plan. This is the same category of claim the plan is designed to eliminate — compare to the "Claims cleanup" global constraint (plan.md:29): "any claim without a runtime producer/consumer... is fixed or downgraded." A deadline with no date is a claim with no producer.
- **Failure scenario:** 160 currently-untagged artifacts (phase-04:20) never get backfilled because the warning never converts to a failure — there is no concrete trigger, so it silently becomes permanent tech debt exactly like the current count-drift problem this phase is fixing.
- **Evidence:** phase-04:40,57; no date/version found via `grep -n "release deadline\|deadline" phase-*.md` beyond these two lines (third hit in phase-07:62 is an unrelated flaky-test quarantine deadline, also undated).
- **Suggested fix:** Either pin an explicit version/date in this plan now, or drop the "eventually fails" framing and state plainly that backfill is best-effort with no enforcement — don't ship an enforcement claim with no mechanism.

## Finding 5: Phase 4 step 4 ("skills reference capabilities, not hardcoded tool names, where feasible") is unbounded scope with no success criterion

- **Severity:** Medium
- **Location:** phase-04-inventory-as-capability-authority.md:41 (Implementation Step 4).
- **Flaw:** "Where feasible" sets no boundary on how many of the ~124 skills (phase-04:20 cites "SKILLS_INDEX 122≠124") get touched, and none of Phase 4's 6 Success Criteria (46-53) reference this refactor — it cannot be checked done or not-done. Rewriting skill prose to reference an abstract capability layer instead of concrete tool names is a cross-cutting rewrite of catalog content, which is scope creep relative to this plan's stated goal ("closes the runtime evidence loop... no catalog expansion... until the loop is closed," plan.md:21).
- **Failure scenario:** Implementer either skips the step silently (no criterion catches it) or does an open-ended sweep across the skill catalog mid-phase, inflating Phase 4 effort past its declared "L" estimate and touching files unrelated to the inventory/capability-authority goal.
- **Evidence:** phase-04:41 vs phase-04:46-53 (no matching criterion); plan.md:21 ("no catalog expansion... until the loop is closed").
- **Suggested fix:** Cut this step from Phase 4, or scope it to a named, finite list of skills (e.g., only skills already flagged as hardcoding a tool this phase newly tracks) with a matching success criterion.

## Finding 6: Phase 6 re-extracts "host-neutral" contracts out of Phase 1-5 schemas that Phase 1's own global constraint already required to be generic — two-pass authoring

- **Severity:** Medium
- **Location:** phase-06-model-agnostic-core-adapter-split.md:31 ("Modify: `packages/mewkit/src/core/session-state/` + evidence envelope schemas (audit for host-specific leakage; extract constants)") and :38 ("Extract host-neutral contracts from Phases 1–5 outputs into `core/contracts/`").
- **Flaw:** The plan's global constraint (plan.md:25) already mandates "Generic wording... project-agnostic" for every schema authored in Phases 1-5, including the Phase 1 session-state schemas. Phase 6 then treats those same schemas as needing a host-specific-leakage audit and extraction into a separate `core/contracts/` module — i.e., the plan schedules writing the schemas once under a "be generic" instruction, then rewriting/relocating them under a "make them actually generic" instruction three-to-five phases later. If Phase 1's constraint were sufficient, Phase 6 step 2's extraction work would be near-zero; the fact that Phase 6 budgets real effort (dependency on 1-3, "M" effort, its own risk register line 55 "Refactor destabilizes the primary host") signals the constraint wasn't trusted to hold in the first place.
- **Failure scenario:** Phase 1 ships session-state schemas with implicit Claude-specific assumptions (e.g., `$CLAUDE_PROJECT_DIR`-relative paths, since `.claude/` is the "canonical authored surface" per audit §7). Phase 6 arrives 5 phases later and must reverse-engineer which fields are host-neutral vs host-coupled without the original authors' context, then risks destabilizing the already-shipped, already-gated Phase 1-3 behavior (explicitly named as a risk in phase-06:55) for a second host (Codex) whose production usage is not established anywhere in the plan.
- **Evidence:** plan.md:25 (global constraint); phase-06:31,38,55 (rework framing + destabilization risk).
- **Suggested fix:** If host-neutrality matters for Phase 1's contracts, define the host-neutral schema shape in Phase 1 directly (author once) instead of deferring extraction to Phase 6; reserve Phase 6 for adapters only, not core-schema surgery.

## Finding 7: Phase 7 CLI entrypoint tests overlap Phase 1-5's own "Tests first" TDD without a stated split of responsibility

- **Severity:** Medium
- **Location:** phase-07:38,47 ("CLI entrypoint test suite (flags/exit codes for every critical command: init, upgrade, validate, inventory, migrate, state, task, doctor, build-plugin, wiki, memory, verdict-gate)") vs phase-01:58 ("producer integration (invoking the state CLI writes exactly the documented shape)"), phase-02:39 ("manifest matches settings"), phase-04:38 ("capability query returns tools by capability with probe status"), phase-05:36 ("registry schema validation... drift check").
- **Flaw:** Phase 7's overview (line 14) claims it "adds only the cross-phase scenarios," but its Implementation Step 4 duplicates single-command flag/exit-code coverage that per-phase TDD (mandated by the global constraint, plan.md:27, "TDD for state/evidence/gate changes... producer/contract tests written first") should already provide for `state`, `inventory`, `validate` in their own phases. No phase file states which layer owns "does `mewkit state set-phase --bad-arg` exit 2" — Phase 1's own tests or Phase 7's later sweep.
- **Failure scenario:** Either the same exit-code assertions get written twice (wasted effort, two places to update on a CLI signature change), or Phase 1-5 skip entrypoint-level tests assuming Phase 7 will cover it, leaving a coverage gap between Phase 1's "DONE" and Phase 7's start (multiple phases of elapsed time per plan.md's dependency chain, line 43-49).
- **Evidence:** phase-07:14,38,47; phase-01:58; phase-02:39; phase-04:38; phase-05:36.
- **Suggested fix:** State explicitly in Phase 7 that entrypoint tests are additive only for commands not already covered by a prior phase's TDD, and name which commands those are (state/inventory/validate/registry are already claimed by Phases 1-5).

## Unresolved Questions

- None of the 7 findings require user judgment beyond a scope-cut decision (planner/user call on Findings 1, 3, 5).

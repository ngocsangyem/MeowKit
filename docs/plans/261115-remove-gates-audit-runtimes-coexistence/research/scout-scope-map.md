# Scope map (deep mode, 5 roots)

Scouted on `main` @ `c7ff0a9e`, 2026-11-15. Counts are from `grep`/`wc`; the gate pattern was
`Gate 1|Gate 2|gate-rules|plan approve|approval receipt|-verdict|gate-enforcement|hard gate|hard stop`.

## Root 1 — `.claude/hooks/` and `.claude/settings.json`

| Item | Fact |
| --- | --- |
| Plan gate shell | `gate-enforcement.cjs` (67 lines), registered on `Edit\|Write` in `.claude/settings.json` |
| Plan gate libs | `lib/core/plan-gate.cjs` 132, `gate1-path-rules.cjs` 90, `gate1-hatch.cjs` 116, `approval-receipt.cjs` 162, `check-contract-signed.cjs` 148, `validate-contract.cjs` 123, `plan-discovery.cjs` |
| Review gate libs | `gate2-check.cjs` 178, `gate2-structural-checks.cjs` 134, `gate2-verdict-lookup.cjs` 104, `gate2-change-set.cjs` 94, `validate-gate-2.cjs` 75 |
| Ship check | `pre-ship.cjs` 69 → `lib/core/pre-ship.cjs` 68. Trigger `SHIP_COMMAND = /git commit\|git push\|git merge/` at `lib/core/pre-ship.cjs:18`. Order: gate2 check, memory lint, then `preship-checks.cjs` (npm test / lint / `tsc --noEmit`; Swift and Python variants) |
| Other consumers of gate libs | `handlers/pre-completion-check.cjs` (requires `validate-gate-2.cjs`, `gate2-verdict-lookup.cjs`), `lib/validate-workflow-evidence.cjs`, `lib/config-keys.cjs` |
| Completion check | `handlers/pre-completion-check.cjs` 150 lines; armed only by `verification-required.json`, which no file in `.claude`, `crates` or `kit/bundles` writes; emits `{decision:"block"}`; capped attempts |
| Build verify | `handlers/build-verify.cjs` returns a plain string (`@@BUILD_VERIFY_ERROR@@ …`); `dispatch.cjs:104` writes handler stdout as-is with exit 0 |
| Unregistered | `pre-implement.cjs` (115 lines) |
| Closure manifest | `core-closure.json`: behaviours `plan-gate`, `privacy`, `pre-ship`; `bundled` lists 10 lib files, 7 of them plan-gate files |
| Hook tests | `.claude/hooks/__tests__/` 11 files incl. `approval-receipt-cli`, `gate2-ship-boundary`, `guard-root-fail-closed`, `core-closure`, `hook-coverage`; `tests/hooks/` incl. `gate1-hatch.test.ts`, `completion-gate.test.ts`, `golden-replay.test.ts` |

## Root 2 — `.claude/rules/`, `.claude/agents/`, `CLAUDE.md`

| File | Bytes | Gate lines |
| --- | --- | --- |
| `gate-rules.md` | 7,642 | 15 |
| `meowkit-core.md` | 2,749 | 4 |
| `development-rules.md` | 3,773 | 1 |
| `agent-conduct.md`, `core-behaviors.md`, `injection-rules.md`, `security-rules.md` | 11,256 total | 0 |
| `CLAUDE.md` (maintainer file, not shipped) | 8,961 | 8 |

Agents: 15 of 44 files carry gate lines; top `evaluator` 10, `reviewer` 9, `planner` 4, `advisor` 4, `project-manager` 4, `shipper` 3, `security` 3, `developer` 3. The compaction policy in `meowkit-core.md` and `CLAUDE.md` names `gate-rules.md` among "the 5 always-on rules".

## Root 3 — `.claude/skills/` (gate references only; body audit is a later plan)

126 files in 37 of 128 skills carry gate lines. Top: `cook` 93, `plan-creator` 77, `autobuild` 57, `review` 37, `evaluate` 27, `workflow-orchestrator` 22, `help` 17, `agent-detector` 13, `orchestrate` 11, `fix` 11, `ship` 10, `advise` 10, `sprint-contract` 9, `validate-plan` 6.

## Root 4 — `kit/bundles/{codex,cursor}`

| | Codex | Cursor |
| --- | --- | --- |
| Hook registration | `root/.codex/hooks.json`: `PreToolUse` only | `root/.cursor/hooks.json`: 14 events |
| Gate hooks | `hooks/gate-enforcement.cjs` (plan gate), `hooks/privacy-block.cjs` | `tool-gate.cjs` 59 (plan gate via `decidePlanGate`, line 18/32), `shell-gate.cjs` 23, `privacy-read-gate.cjs` 32, `mcp-gate.cjs` 21; `failClosed: true` on the four gates |
| Ship check | none | none (`shell-gate.cjs` not confirmed to run tests) |
| Stop hook | none | `stop-followup.cjs` 25, `loop_limit: 5`, fail-open |
| Kill switch | — | `isKillSwitchActive(root)` in `tool-gate.cjs:50`, `shell-gate.cjs:17` |
| Instruction file | `root/AGENTS.md` 7,756 B, `## Gates` at line 69 | `root/AGENTS.md` 4,702 B, `## Gates, security and compaction` at line 66; 5 `.mdc` rules |
| Files with gate lines | 123 | 112 |
| Provenance | hand-authored; only the 10 `bundled` lib files are script-synced (`scripts/sync-hook-core.cjs`, one way, never deletes orphans) — see `researcher-01-…` |

## Root 5 — `crates/mewkit-{core,cli,adapters}`

| Item | Fact |
| --- | --- |
| Doctor | `crates/mewkit-cli/src/commands/doctor/`: `mod.rs` 153, `hooks.rs` 178, `installs.rs` 106, `hook_commands.rs` 107, `extras.rs` 119, `provenance.rs` 101, `adopt.rs` 92, `toolchain.rs` 67 |
| Gate code | `doctor/hard_gates/` 734 lines in 4 files; `plan_doc/approve.rs` 221, `plan_doc/receipt.rs` 249; `verdict_gate` module; `validate/gate_authority*.rs` |
| Keep | `plan_doc/{parser,structure_check,archive,phase_frontmatter}.rs` (plan structure, no gate) |
| Upgrade path | `merge/hook_groups.rs:185` `strip` removes kit handlers by id and drops emptied groups; root `deletions.json` holds 126 retired paths |
| Frozen tests | `crates/mewkit-cli/tests/golden/npm` (470 files, hand-edit only, reason in `DIVERGENCES.md`), `tests/npm_behaviour` incl. `verdict_gate_cases.rs` 149 and `doctor_cases.rs` 332 |

## Public contracts that must stay stable

- `doctor --json` shape: `Check{name,status,detail}` rows.
- `settings.json` merge and strip semantics for existing installs.
- `core-closure.json` schema and the byte-identity of `bundled` files across the three trees.
- `plan check --structural`, `plan archive`.
- `privacy-block` behaviour on all three runtimes.

## Risky dependencies

- `pre-completion-check.cjs` and `lib/core/pre-ship.cjs` both import review-gate libs; deleting those libs before rewiring breaks the two controls that must survive.
- `mk:autobuild` and `mk:sprint-contract` use the contract files that the plan gate enforces; the sprint contract is a harness artefact as well as a gate input.
- `ci.yml` runs `validate --gates`, `--workflow`, `--target codex`, `check-hook-registration.sh`; each asserts gate presence.
- Kit metadata naming the gates: `hook-coverage.json`, `core-closure.json`, `.meowkit/harness-inventory.json`, `.claude/kit-capabilities.json`, `.meowkit/pack-manifest.json`.

## Uncertainty list

1. Whether `upgrade` calls `strip` for a handler that left the kit (function exists; call path not traced).
2. Whether `validate` fails when a hook file is absent but metadata still names it.
3. Whether plain hook stdout reaches the model on this host version (docs say no for PostToolUse).
4. Whether Cursor `shell-gate.cjs` and Codex policy can host a ship-time test run.
5. True count of tests that fail after removal (grep counts are upper bounds).
6. `docs/project-context.md` and `docs/code-standards.md` do not exist in this checkout.

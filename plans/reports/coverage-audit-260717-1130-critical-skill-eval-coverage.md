# Critical-skill eval coverage audit (Phase 7 gate: ≥3 evals/skill)

Read-only count. 14 CRITICAL skills. Track D = deterministic/offline. Track M = model-in-loop.
Evidence-first, `file:line`/`file` citations. Counted distinct scenarios/cases, not "a suite exists."

## Method

Enumerated: `.github/workflows/ci.yml` steps, `tests/**`, `.claude/skills/<skill>/{eval,evals,tests}/**`,
`packages/mewkit/src/**/__tests__/**`, and root `src/__tests__/**` (root `package.json` `test` script is
`vitest run`, which picks up root `src/**/*.test.ts` — this is a real, CI-executed suite, not dead code).
Grepped for `it(`, `test(`, `def test_`, `assert_*`, jsonl case rows, `[TEST]`/echo-labeled shell checks.
Excluded matches that only reference a skill's *name* inside a generic infra test (e.g. capability-resolution
tie-break tests, portability-classifier tests using a skill name as a synthetic fixture) — these don't test the
skill's own behavior/contract, so they're noted but not counted.

## Results table

| Skill | Track D (count, evidence) | Track M (count, evidence) | Total | ≥3? | Notes |
|---|---|---|---|---|---|
| fix | 8 — `tests/fix-skill-contract.test.sh:23-30` (`assert_match` per line, distinct routing/behavior claims) | 0 | 8 | yes | CI step "Fix skill contract tests" |
| investigate | 2 — `.claude/skills/scale-routing/eval/routing-cases.jsonl` id `m-investigate-boundary-en` (expected `mk:investigate`); `tests/fix-skill-contract.test.sh:24` (fix→investigate disambiguation assertion) | 0 | 2 | **no** | No dedicated investigate test/eval file anywhere in repo (checked `.claude/skills/investigate/{bin,scripts}`, hooks tests, routing evals) |
| build-fix | 2 — `routing-cases.jsonl` id `m-buildfix-boundary-en` (expected `mk:build-fix`); `tests/fix-skill-contract.test.sh:25` (fix→build-fix disambiguation) | 0 | 2 | **no** | `packages/mewkit/src/core/__tests__/resolve-capabilities.test.ts:82-88` uses `mk:build-fix` as a fixture for a generic tie-break algorithm test, not a build-fix behavior/contract test — excluded |
| cook | 16 — `.claude/skills/cook/scripts/test-scripts.sh` (10 `run_test` gate-1/gate-2 cases + 6 declarative SKILL.md contract checks, full file) | 0 | 16 | yes | CI step "Cook gate contract tests" |
| memory | 88 — `src/__tests__/memory/*.test.ts` (14 files, `it(` counts: backwards-compat 5, cost-log-atomicity 2, immediate-capture-atomicity 4, immediate-capture-routing 5, memory-cli 6, memory-prune 6, memory-schema 6, memory-validate 7, no-injection 3, producer-consumer-characterization 14, render-views 5, seed-from-md 7, skill-prose-structure 2, topic-file-migration 7, verdict-gate 9) + CI step "Smoke-test memory CLI" (`memory validate`, `memory render-views` — 2 more) | 0 | 90 | yes | Runs via root `npm test` (`vitest run`) — CI-executed |
| plan-creator | 8 — `tests/fixtures/plan-creator/validate-fixtures.sh` (8 named fixtures × expected verdict: legacy-v1-5, modernized-v1-6, partial-v1-6, interrupted-sweep-v1-6, handoff-invalid-enum, deep-plan, tdd-plan, deep-tdd-plan) + 1 — `packages/mewkit/src/core/__tests__/priority-skill-profiles.test.ts:91-99` ("keeps Plan Creator's full hard/deep workflow bundle available before Gate 1") | 0 | 9 | yes | CI step "Validate plan-creator compatibility fixtures" |
| validate-plan | 0 | 0 | 0 | **no** | `packages/mewkit/src/visual-plan/__tests__/validate-plan.test.ts` is a false positive — it validates the unrelated `visual-plan` HTML-artifact subsystem (dangling refs, coverage, unsafe HTML), not the `mk:validate-plan` 8-dimension plan-quality skill. `.claude/skills/validate-plan/` contains only `SKILL.md`, no eval/test asset. |
| ship | 24 — `.claude/hooks/__tests__/gate2-ship-boundary.test.cjs` (24 `test(...)` cases: missing-verdict block, FAIL-dimension block, docs-only N/A, mixed-commit block, security-BLOCK, two-verdicts-fail-closed, etc.) | 0 | 24 | yes | CI step "Hook regression tests" (`node --test .claude/hooks/__tests__/*.test.cjs`); `.claude/skills/ship/references/eval-suites.md` is a template for downstream *target-project* eval suites, not meowkit's own — not counted |
| document-release | 1 — `routing-cases.jsonl` id `d-docs-en` (expected `mk:document-release`) | 0 | 1 | **no** | No other test/eval file references document-release outside `website/` (docs pages, not tests) |
| workflow-orchestrator | 0 | 0 | 0 | **no** | Only hit is `packages/mewkit/src/migrate/__tests__/portability-policy.test.ts:399-429`, which fabricates a synthetic `SKILL.md` body named "workflow-orchestrator" purely to test the generic portability classifier — does not exercise the real skill's behavior/contract |
| resolving-merge-conflicts | 0 | 0 | 0 | **no** | Zero references in any `*.test.*`, `*.jsonl`, `.py`, or CI step repo-wide |
| brainstorming | 0 | 10 — `.claude/skills/brainstorming/eval/scenario-manifest.cjs` (10 named scenarios: activation-routing, quick-no-artifact, bare-ambiguity, product-redirect, plan-redirect, scope-decomposition, anti-bias-pivot, same-architecture-rejection, deep-scoring-tie, handoff-completeness) via `run-scenarios.cjs` | 10 | yes | `generate-eval-results.cjs` marks it "Opt-in scenario runner … not run in PR CI" — Track M, correctly not gating CI |
| web-to-markdown | 33 — pytest-collected (`test_safe_url.py` 28 cases incl. parametrize: invalid-url-shapes, sensitive-hostnames×4, private/special-addresses×9, DNS-failure paths, redirect-safety×3, etc.; `test_e2e_offline.py` 5 cases: poisoned-content-stop, no-leak-on-stop, playwright-probe-parity, persist-off-skip, quarantine-export) | 0 | 33 | yes | CI step "Test web-to-markdown URL SSRF guard"; `test_smoke_real_urls.py` (3 more `def test_`) exists but hits live network — not in CI, not counted |
| wiki-research | 27 — `packages/mewkit/src/wiki/infrastructure/__tests__/fetcher-adapter.test.ts` (7 `it(`) + `scanner-adapter.test.ts` (16 `it(`) + `packages/mewkit/src/wiki/application/__tests__/research-quarantine.test.ts` (4 `it(`) | 0 | 27 | yes | CI step "Wiki-research security corpus" (explicit `npx vitest run` of these 3 files) |

## GAPS (6 of 14 under 3)

1. **investigate** — 2/3. Missing 1. Cheapest fix: add one more explicit `mk:investigate` case to `scale-routing/eval/routing-cases.jsonl` (e.g. a non-boundary "system investigation" prompt), or add 1-2 `assert_match` lines to a new `tests/investigate-skill-contract.test.sh` pinning a documented behavior (e.g. RCA-method-selection routing) analogous to `fix-skill-contract.test.sh`.
2. **build-fix** — 2/3. Missing 1. Same cheapest fix pattern: 1 more routing-cases.jsonl case (e.g. Python vs TS build-error prompt) or 1 `assert_match` contract line in a new `tests/build-fix-skill-contract.test.sh`.
3. **validate-plan** — 0/3. No eval asset exists. Cheapest fix: a `tests/fixtures/validate-plan/` mirroring `plan-creator`'s pattern — 3 fixture plans (one deliberately failing 1 of the 8 dimensions each, e.g. missing acceptance criteria / missing risks / missing security section) validated by a small deterministic script that greps for the 8 section headers and checks pass/fail routing. Model-in-loop scenario alternative: 3 canary plans graded by the skill's own dimension checklist.
4. **document-release** — 1/3. Missing 2. Cheapest fix: 2 more routing-cases.jsonl rows (e.g. changelog-only prompt, breaking-change-detected prompt) or a `tests/document-release-skill-contract.test.sh` pinning 2-3 documented behaviors from `references/step2-per-file-audit.md` / `references/step4-risky-changes.md`.
5. **workflow-orchestrator** — 0/3. No real eval asset (only a synthetic same-name fixture in an unrelated test). Cheapest fix: 3 `assert_match`-style contract checks against `.claude/skills/workflow-orchestrator/SKILL.md` / `references/workflow-phases.md`, e.g. pin "auto-invoke on complex-feature intent", "defers to mk:cook on explicit invocation" (mirrors `orchestration-rules.md` Orchestrator Entry Point Rule), and "never runs both orchestrators in one session".
6. **resolving-merge-conflicts** — 0/3. Zero coverage anywhere. Cheapest fix: 3 deterministic fixture cases (clean conflict resolves both sides, conflict requiring human judgment escalates, malformed conflict markers rejected) as a `tests/resolving-merge-conflicts-contract.test.sh`, or 3 `.jsonl` routing/scenario rows if model-in-loop is preferred given the skill is judgment-heavy.

## Unresolved questions

- None — all 14 skills traced to file:line evidence or confirmed absent by exhaustive grep.

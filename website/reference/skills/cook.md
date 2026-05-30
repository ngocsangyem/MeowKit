---
title: "mk:cook"
description: "End-to-end feature pipeline — plan, test, build, review, ship. TDD is opt-in via --tdd."
---

# mk:cook

## What This Skill Does

Primary entry point for building features. Given a description or plan path, orchestrates the full 7-phase pipeline. TDD is opt-in via `--tdd`. For green-field product builds, use `mk:autobuild` instead.

## When to Use

- Building a feature, fix, or refactor scoped to a single task
- Executing an existing implementation plan
- Rapid iteration with `--fast` mode (skips research)
- Parallel multi-feature builds with `--parallel`
- **NOT for:** green-field product builds (use `mk:autobuild`), workflow orchestration (use `mk:workflow-orchestrator`)

## Core Capabilities

- **7-phase pipeline:** Orient → Plan → Test → Build → Simplify → Verify → Review → Ship → Reflect
- **TDD mode:** Opt-in via `--tdd` — writes failing tests before implementation, enforces RED-GREEN-REFACTOR
- **Smart intent detection:** Auto-routes to the correct mode based on input patterns (plan path, "fast", "parallel", "auto")
- **Workflow modes:** interactive (default), auto, fast, parallel, no-test, code — with modifier flags `--verify`, `--strict`, `--no-strict`
- **Required subagents:** Scout (Phase 0), plan-creator + researcher (Phase 1), tester (Phase 2, TDD only), developer (Phase 3), mk:simplify + mk:verify (post-build), reviewer (Phase 4), shipper via mk:ship (Phase 5 — shipper invokes git-manager internally), documenter + memory capture (Phase 6)
- **Scout-First Contract (Phase 0):** before any clarifying question or plan generation, a 3–6 bullet codebase-context summary is surfaced to the user (project type/language/framework, relevant modules, current patterns, in-flight plans, public APIs/schemas). Skipped on `plan.md` / `phase-*.md` input.
- **Exact-Requirements Contract (Phase 1):** `mk:plan-creator` MUST answer 5 dimensions in concrete sentences — expected output, acceptance criteria, scope boundary, non-negotiable constraints, touchpoints — before returning a plan. Clarifying-question options MUST cite scout findings (file paths). Skipped on plan-path input.
- **Regression Recovery Options (Gate 2):** when the reviewer surfaces a regression in EXISTING behavior (verdict includes `Side Effects Detected: Yes`), cook STOPs the iteration loop and presents 2–4 typed options to the user (revert / keep + update dependents / compatibility shim / accept the regression). User selection recorded as a `## User Decision Addendum` block on the verdict file. `validate-gate-2.sh` blocks Gate 2 until the addendum is present.
- **Simplify + Verify:** Mandatory post-build steps — reduce complexity, then run unified build+lint+test+coverage before review
- **Workflow evidence index:** populates ONE `tasks/plans/<plan>/reports/evidence/workflow-evidence.json` from existing Phase 0-6 outputs (risk flags, the 5 exact requirements, verification, verdict path, approvals). It is traceability only — mirrors `validate-gate-1.sh`/`validate-gate-2.sh`, **never approves**, carries no score, and adds no new gate. Must be complete before Gate 2 is presented

## Usage

```bash
/mk:cook add user authentication with JWT       # Natural language
/mk:cook tasks/plans/260501-auth/plan.md        # From existing plan
/mk:cook build payment processor --tdd          # Strict TDD
/mk:cook add login form --fast                  # Skip research
/mk:cook implement checkout --parallel           # Parallel agents
/mk:cook refactor payment module --auto          # Auto-fix (Gate 2 still human)
/mk:cook update readme --no-test                # Skip Phase 2
/mk:cook "feature" --verify                      # Light browser check after review
/mk:cook "feature" --strict                      # Full evaluator after review
/mk:cook "feature" --interactive                 # Full interactive (default)
```

## Example Prompt

```
Build a JWT-based authentication system for the API — login, registration, token refresh, and role-based access control. Run in TDD mode with full review gates.
```

**Flags:** `--interactive` (default) | `--fast` | `--parallel` | `--auto` | `--no-test` | `--tdd` | `--verify` | `--strict` | `--no-strict`

**Modifier flags:** `--verify` `[LIGHT]` (light browser/artifact check, advisory — no back-edge to Phase 3) | `--strict` `[HEAVY]` (full evaluator pass, FAIL blocks ship and routes back to Phase 3) | `--no-strict` (suppress auto-strict from scale-routing). `--strict` supersedes `--verify`. Concrete cost depends on the inner harness, model tier, and target surface; treat `[LIGHT]` vs `[HEAVY]` as relative ordering only.

## TDD mode (`--tdd` flag)

When `--tdd` is detected, the skill writes `on` to `.claude/session-state/tdd-mode` BEFORE any other workflow step. This sentinel is read by `pre-implement.sh`, `tdd-detect.sh`, and downstream agents. `MEOWKIT_TDD=1` env var is highest-precedence opt-in. Without `--tdd`, Phase 2 is optional — the developer may implement directly per the plan.

## Workflow modes

| Mode | Research | TDD | Gate 2 | Progression |
|---|---|---|---|---|
| interactive (default) | Yes | RED-strict | Human approval | One at a time |
| auto | Yes | RED-strict | Human approval | Continuous (auto-fix, not auto-approve) |
| fast | Skip | Plan-level | Human approval | One at a time |
| parallel | Optional | RED-strict | Human approval | Parallel groups |
| no-test | Yes | Skip | Human approval | One at a time |
| code | Skip | RED-strict | Human approval | Per plan |

**TDD column key:** `RED-strict` = failing tests in Phase 2 before any implementation (only enforced when `--tdd` / `MEOWKIT_TDD=1`; otherwise Phase 2 is optional). `Plan-level` = tests reflect plan intent, no RED gate. `Skip` = no Phase 2.

Gate 2: human approval mandatory in all modes — see `.claude/rules/gate-rules.md` for the full contract.

## Smart intent detection

| Input Pattern | Mode |
|---|---|
| Path to `plan.md` / `phase-*.md` | code — execute existing plan |
| "fast", "quick" | fast — skip research |
| "trust me", "auto" | auto — auto-fix, gates enforced |
| 3+ features or "parallel" | parallel — multi-agent |
| "no test", "skip test" | no-test — skip Phase 2 |
| Default | interactive — full workflow with user approval at each gate |
| `--verify` | (modifier) — light browser check after review (Phase 4.5) |
| `--strict` | (modifier) — full evaluator after review (Phase 4.5) |
| `--no-strict` | (modifier) — suppress auto-strict from scale-routing |

## Required subagents

| Phase | Subagent | Notes |
|---|---|---|
| 0 Orient | `mk:scout` | Codebase mapping |
| 1 Plan | `mk:plan-creator`, `researcher` | Research + planning |
| 2 Test | `tester` via `mk:testing` | TDD: MUST spawn. Default: optional |
| 3 Build | `developer` | Implementation |
| 3.5 Simplify | `developer` via `mk:simplify` | MANDATORY after Build GREEN |
| 3.6 Verify | `mk:verify` | MANDATORY — build+lint+test+coverage before review |
| 4 Review | `reviewer` via `mk:review` | MUST spawn — Gate 2 |
| 4.5 Verify | `agent-browser` or `evaluator` via `mk:evaluate` | Only with `--verify` or `--strict` |
| 5 Ship | `git-manager` via `mk:ship` | MUST spawn |
| 6 Reflect | `documenter`, `mk:memory session-capture` | MUST spawn |

## Simplify + Verify (mandatory after Build)

After Phase 3 GREEN: run `mk:simplify` to reduce complexity before review. Then run `mk:verify` for unified build→lint→type-check→test→coverage. If verify FAILS: send back to developer, then re-run before Phase 4. Do not skip.

## Anti-rationalization

| Thought | Reality |
|---|---|
| "This is too simple to plan" | Simple tasks have hidden complexity. Plan takes 30 seconds. |
| "I already know how to do this" | Knowing ≠ planning. Write it down. |
| "Let me just start coding" | Undisciplined action wastes tokens. Plan first. |
| "Tests can come after" | TDD mode: no. Default mode: yes. Choose mode explicitly. |

## Gotchas

- Skipping `mk:simplify` before review — mandatory between Phase 3 and Phase 4
- Auto mode can auto-fix but never auto-approve Gate 2
- Context loss between phases — update plan.md Agent State after each phase
- Parallel mode deadlocks — map dependency graph before spawning
- Code mode on stale plans — warn if plan >14 days old
- Fast mode shallow coverage — skipping research means plan-level tests only
- Missing model tier declaration — always declare in Phase 0
- Forgetting memory read/write — Phase 0 reads `.claude/memory/`, Phase 6 appends
- `--strict` cost surprise — auto-triggered by scale-routing `level=high`. Use `--no-strict` to suppress
- Skipping Gate 1 on "simple" features — features that seem simple grow during implementation. Always create a plan file; cancel it if truly trivial
- Subagent patterns using Agent() not Task() — Task() enables tracking, blocking, and progress. Always use Task() for phases 2-6
- `--strict` vs `--verify` confusion — `--verify` = light browser check (advisory). `--strict` = full evaluator with rubrics (FAIL blocks ship). `--strict` supersedes `--verify`

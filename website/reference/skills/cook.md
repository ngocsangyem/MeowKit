---
title: "mk:cook"
description: "End-to-end feature pipeline — plan, test, build, review, ship. TDD is opt-in via --tdd."
---

# mk:cook

Primary entry point for building features. Given a description or plan path, orchestrates the full 7-phase pipeline. TDD is opt-in via `--tdd`. For green-field product builds, use `mk:harness` instead.

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
```

**Modifier flags:** `--verify` (light browser check ~$1, advisory) | `--strict` (full evaluator ~$2-5, FAIL blocks ship) | `--no-strict` (suppress auto-strict from scale-routing). `--strict` supersedes `--verify`.

## TDD mode (`--tdd` flag)

When `--tdd` is detected, the skill writes `on` to `.claude/session-state/tdd-mode` BEFORE any other workflow step. This sentinel is read by `pre-implement.sh`, `tdd-detect.sh`, and downstream agents. `MEOWKIT_TDD=1` env var is highest-precedence opt-in. Without `--tdd`, Phase 2 is optional — the developer may implement directly per the plan.

## Workflow modes

| Mode | Research | TDD | Gate 2 | Progression |
|---|---|---|---|---|
| interactive (default) | Yes | Yes | Human approval | One at a time |
| auto | Yes | Yes | Human approval | Continuous (auto-fix, not auto-approve) |
| fast | Skip | Plan-level | Human approval | One at a time |
| parallel | Optional | Yes | Human approval | Parallel groups |
| no-test | Yes | Skip | Human approval | One at a time |
| code | Skip | Yes | Human approval | Per plan |

Gate 2 requires human approval in ALL modes. No exceptions. Auto mode auto-fixes issues but never auto-approves shipping.

## Smart intent detection

| Input Pattern | Mode |
|---|---|
| Path to `plan.md` / `phase-*.md` | code — execute existing plan |
| "fast", "quick" | fast — skip research |
| "trust me", "auto" | auto — auto-fix, gates enforced |
| 3+ features or "parallel" | parallel — multi-agent |
| "no test", "skip test" | no-test — skip Phase 2 |

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

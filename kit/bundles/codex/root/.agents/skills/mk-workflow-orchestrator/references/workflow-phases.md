<!-- Aligned to AGENTS.md 7-phase model (B2-C6 fix) -->
<!-- Canonical source: this file (no separate workflow.yaml ships in this bundle) -->
<!-- Workflow phase sequence: 0:Orient > 1:Plan > 2:Test > 3:Build > 3.5:Simplify > 3.6:Verify > 4:Review > 5:Ship > 6:Reflect -->

# 7-Phase Workflow Detail

## Collaborative Planning (Deep Tasks Only)

For **Deep complexity** tasks, Phase 1 uses multi-perspective deliberation:

- 3 agents (Builder, Breaker, User) analyze independently
- Cross-review and debate proposals
- PM converges on optimal plan

> **TDD opt-in (post-migration):** Phase 2 is OPTIONAL by default. Pass `--tdd` or `export MEOWKIT_TDD=1` to require RED-phase tests before Phase 3. In default mode, Phase 2 is skipped unless the orchestrator explicitly invokes the tester for plan-coverage reasons.

| Phase | Name                    | Lead Agent           | Deliverable                                           | Checkpoint       |
| ----- | ----------------------- | -------------------- | ----------------------------------------------------- | ---------------- |
| 0     | Orient                  | orchestrator         | Model tier, execution mode, context, **TDD mode**     | Auto             |
| 1     | Plan                    | planner → architect  | Requirements, technical design                        | **Agree w/ user**|
| 2     | Test (RED if `--tdd`)   | tester               | Failing tests in TDD mode; tests on-request otherwise | Auto / Skipped   |
| 3     | Build                   | developer            | Implementation (GREEN in TDD mode)                    | Auto             |
| 3.5   | Simplify                | mk-simplify          | Simplified code with behavior preserved                | Auto             |
| 3.6   | Verify                  | mk-verify            | Clean build, lint, typecheck, test, and coverage       | Auto             |
| 4     | Review                  | reviewer + security  | Quality/security audit, verdict                       | **Read verdict** |
| 5     | Ship                    | shipper + git-manager| Commit, PR, deploy                                    | Auto             |
| 6     | Reflect                 | analyst + documenter + mk-memory | Cost/pattern analysis, docs sync, gotcha/decision if non-derivable | Auto             |

## Phase Transition Rules

```
Phase 0 → Phase 1: AUTO-CONTINUE
Phase 1 → Phase 2: present the plan and continue once the user agrees it
Phase 2 → Phase 3:
  - In TDD mode: AUTO-CONTINUE (if tests fail as expected)
  - In default mode: Phase 2 may be skipped entirely; Phase 1 → Phase 3 directly
Phase 3 → Phase 3.5 → Phase 3.6 → Phase 4: AUTO-CONTINUE
Phase 4 → Phase 5: read the review verdict; ship only on an explicit request
Phase 5 → Phase 6: AUTO-CONTINUE
Phase 6 → DONE: AUTO-COMPLETE
```

Invalid transitions:
- Skip Phase 1 (no plan) — always invalid
- Phase 5 with failing tests (if tests exist)
- Phase 3 without Phase 2 — invalid ONLY when `MEOWKIT_TDD=1` / `--tdd` is set; permitted in default mode

## User Checkpoints (Only 2)

**The plan** (after Phase 1, before building):
- Plan file exists at `tasks/plans/YYMMDD-name/plan.md`
- All required sections populated (Problem, Success Criteria, Technical Approach)
- The user has seen it and agreed it

**The review verdict** (after Phase 4 — Review, before shipping):
- Verdict file exists at `tasks/reviews/YYMMDD-name-verdict.md`
- No FAIL dimensions (all 5 must be PASS or WARN)
- Every WARN item seen by the user
- No BLOCK items from security scan

No hook checks either checkpoint: nothing blocks an edit without the plan and nothing
blocks a commit without the verdict. Both exist because building from a wrong plan, or
shipping an unread verdict, costs more than the conversation does. The one enforced
ship-time control is `.codex/hooks/pre-ship.cjs` (lint, related tests, type-check).

Format:
```markdown
Phase [N]: [Name] - Approval Needed

## [Friendly Summary]

[Deliverables list]
Progress: [X]% ([N]/7 phases)
Options: approve / reject: <reason> / modify: <changes> / stop
```

## AUTO-CONTINUE Behavior

```
Phase 0 (auto) → Phase 1 [plan agreed] → Phase 2 (auto) → Phase 3 (auto) → Phase 4 [verdict read] → Phase 5 (auto) → Phase 6 (auto) → DONE
```

Auto-Stop: Tests pass when should fail (Phase 2), tests fail after implementation (Phase 3), coverage <80% (Phase 4), token limit reached.

Token awareness: 75% (150K) warn, 85% (170K) suggest handoff, 90% (180K) force handoff.

## Critical Rules — TDD

```
Phase 2 (RED):  Write tests FIRST → Run → MUST FAIL
Phase 3 (GREEN): Write minimal code → Run → MUST PASS
Phase 4 (REVIEW): Audit → Run → MUST STILL PASS
```

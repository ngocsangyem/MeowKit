<!-- Aligned to CLAUDE.md 7-phase model (B2-C6 fix) -->

# 7-Phase Workflow Detail

## Collaborative Planning (Deep Tasks Only)

For **Deep complexity** tasks, Phase 1 uses multi-perspective deliberation:

- 3 agents (Builder, Breaker, User) analyze independently
- Cross-review and debate proposals
- PM converges on optimal plan

| Phase | Name            | Lead Agent           | Deliverable                          | Gate             |
| ----- | --------------- | -------------------- | ------------------------------------ | ---------------- |
| 0     | Orient          | orchestrator         | Model tier, execution mode, context  | Auto             |
| 1     | Plan            | planner → architect  | Requirements, technical design       | **GATE 1**       |
| 2     | Test (RED)      | tester               | Failing tests (TDD RED)              | Auto             |
| 3     | Build (GREEN)   | developer            | Implementation (TDD GREEN)           | Auto             |
| 4     | Review          | reviewer + security  | Quality/security audit, verdict      | **GATE 2**       |
| 5     | Ship            | shipper + git-manager| Commit, PR, deploy                   | Auto             |
| 6     | Reflect         | analyst + documenter | Memory capture, docs sync            | Auto             |

## Phase Transition Rules

```
Phase 0 → Phase 1: AUTO-CONTINUE
Phase 1 → Phase 2: GATE 1 — HUMAN APPROVAL REQUIRED
Phase 2 → Phase 3: AUTO-CONTINUE (if tests fail as expected)
Phase 3 → Phase 4: AUTO-CONTINUE (optional review gate in interactive mode)
Phase 4 → Phase 5: GATE 2 — HUMAN APPROVAL REQUIRED (NO EXCEPTIONS)
Phase 5 → Phase 6: AUTO-CONTINUE
Phase 6 → DONE: AUTO-COMPLETE
```

Invalid transitions: Skip Phase 1→3 (no tests), Phase 3 without Phase 2 (no TDD), Phase 5 with failing tests.

## Approval Gates (Only 2)

**Gate 1** (after Phase 1 — Plan):
- Plan file exists at `tasks/plans/YYMMDD-name/plan.md`
- All required sections populated (Problem, Success Criteria, Technical Approach)
- Human has explicitly approved

**Gate 2** (after Phase 4 — Review):
- Verdict file exists at `tasks/reviews/YYMMDD-name-verdict.md`
- No FAIL dimensions (all 5 must be PASS or WARN)
- All WARN items acknowledged by human
- No BLOCK items from security scan
- Human has explicitly approved

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
Phase 0 (auto) → Phase 1 GATE 1 → Phase 2 (auto) → Phase 3 (auto) → Phase 4 GATE 2 → Phase 5 (auto) → Phase 6 (auto) → DONE
```

Auto-Stop: Tests pass when should fail (Phase 2), tests fail after implementation (Phase 3), coverage <80% (Phase 4), token limit reached.

Token awareness: 75% (150K) warn, 85% (170K) suggest handoff, 90% (180K) force handoff.

## Critical Rules — TDD

```
Phase 2 (RED):  Write tests FIRST → Run → MUST FAIL
Phase 3 (GREEN): Write minimal code → Run → MUST PASS
Phase 4 (REVIEW): Audit → Run → MUST STILL PASS
```

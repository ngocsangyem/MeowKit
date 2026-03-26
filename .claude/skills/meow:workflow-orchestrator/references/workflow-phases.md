<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->

# 5-Phase Workflow Detail

## Collaborative Planning (Deep Tasks Only)

For **Deep complexity** tasks, Phase 1 uses multi-perspective deliberation:

- 3 agents (Builder, Breaker, User) analyze independently
- Cross-review and debate proposals
- PM converges on optimal plan

| Phase | Name                | Lead Agent            | Deliverable                        | Gate         |
| ----- | ------------------- | --------------------- | ---------------------------------- | ------------ |
| 1     | Understand + Design | planner → architect   | Requirements, technical design     | **APPROVAL** |
| 2     | Test (RED)          | tester + developer    | Failing tests (TDD RED)            | Auto         |
| 3     | Build (GREEN)       | developer             | Implementation (TDD GREEN)         | **APPROVAL** |
| 4     | Refactor + Review   | developer + security  | Clean code, quality/security check | Auto\*       |
| 5     | Finalize            | tester + orchestrator | Coverage >=80%, docs, notification | Auto         |

## Phase Transition Rules

```
Phase 1 → Phase 2: APPROVAL REQUIRED
Phase 2 → Phase 3: AUTO-CONTINUE (if tests fail as expected)
Phase 3 → Phase 4: APPROVAL REQUIRED
Phase 4 → Phase 5: AUTO-CONTINUE (if tests pass, no critical issues)
Phase 5 → DONE: AUTO-COMPLETE
```

Invalid transitions: Skip Phase 1→3 (no tests), Phase 3 without Phase 2 (no TDD), Phase 5 with failing tests.

## Approval Gates (Only 2)

Format:

```markdown
Phase [N]: [Name] - Approval Needed

## [Friendly Summary]

[Deliverables list]
Progress: [X]% ([N]/5 phases)
Options: approve / reject: <reason> / modify: <changes> / stop
```

## AUTO-CONTINUE Behavior

```
START → Phase 1 APPROVAL → Phase 2 (auto) → Phase 3 APPROVAL → Phase 4 (auto) → Phase 5 (auto) → DONE
```

Auto-Stop: Tests pass when should fail (Phase 2), tests fail after refactor (Phase 4), coverage <80% (Phase 5), token limit reached.

Token awareness: 75% (150K) warn, 85% (170K) suggest handoff, 90% (180K) force handoff.

## Token Budget Per Phase

```toon
token_budget[5]{phase,max_tokens,format}:
  1,2000,TOON tables + minimal prose
  2,1500,Test code only - no explanations
  3,2500,Implementation code - minimal comments
  4,1000,Refactor summary + review findings in TOON
  5,500,Status only
```

## Critical Rules — TDD

```
Phase 2 (RED):  Write tests FIRST → Run → MUST FAIL
Phase 3 (GREEN): Write minimal code → Run → MUST PASS
Phase 4 (REFACTOR): Clean up → Run → MUST STILL PASS
```

---
source: original
applies_to: [Phase 1 entry, Gate 2]
loaded_by: mk:agent-detector Step 0b (Agile context only)
trust_level: HIGH
---

# Agile Story Gates — DoR + DoD + Traceability

**Core rule:** Stories satisfy a DoR before plan creation, a DoD before ship. Both advisory; neither blocks.

## 1 — Definition of Ready (Phase 1 entry)

**Triggers:** `mk:plan-creator` invoked AND plan frontmatter has `jira_tickets: [...]`.

Five checks per ticket:

1. AC text present (`mk:jira-issue get KEY` → Description or `customfield_acceptance_criteria` per `mk:jira-fields`)
2. Non-zero story-point estimate
3. Sprint linkage if `sprint_id:` in frontmatter
4. Recent (≤14d) `mk:jira-evaluator` report at `tasks/reports/jira-evaluate-*-KEY.md`
5. No open `is blocked by` link to non-Done ticket (`mk:jira-relationships`)

Output advisory:

```
DoR PROJ-123:  ✓ AC  ✗ estimate  ⚠ evaluator 22d old  ✓ no blockers
→ Proceed? Or address gaps first?
```

**NEVER hard-block. INSTEAD:** surface gaps; human decides.

## 2 — Definition of Done (Gate 2 PASS extension)

**Triggers:** Gate 2 verdict written PASS/WARN.

Three opt-in actions via AskUserQuestion. Every step Jira-offline-safe:

1. **Verdict→Jira comment.** "Post verdict to PROJ-123? [Y/n/edit]" → `mk:jira-collaborate add comment` (Summary + Risks). Set `posted_to_jira: true`. Offline → `deferred`, never block
2. **Status transition.** "Transition PROJ-123 to Done? [Y/n/skip]" → `mk:jira-lifecycle transition`. Offline → `transitioned_to_done: deferred`
3. **Business AC checkbox.** Source: (a) Jira AC field; (b) **fallback to plan.md `## Acceptance Criteria`** if Jira read fails or empty. Y/n per item before Phase 5

**INSTEAD of auto-posting:** ALWAYS prompt. Human owns the public projection.

## 3 — Traceability

`tasks/plans/*/plan.md` MAY include `jira_tickets: [...]`. When present:

- Verdict file inherits the field
- `mk:project-manager` reads it for sprint progress
- `mk:sprint-contract` references it in per-story header

ABSENCE = non-Agile mode; rule silently skips all checks.

## Integrations

- `mk:plan-creator` Phase 1 entry → 1
- `mk:ship` Gate 2 PASS → 2 (LOCKED owner; covers `mk:cook`→`mk:ship` chain)
- `mk:project-manager`, `mk:sprint-contract` → 3

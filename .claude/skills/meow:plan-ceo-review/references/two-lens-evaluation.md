# Two-Lens Evaluation (Layer 3)

Run as Step 0.5 — AFTER mode selection, BEFORE Section 1. Two independent sub-evaluations that gate the deep review.

---

## Lens A: Intent Alignment

Does this plan solve the RIGHT problem?

### Check Questions
1. Does the plan solve the stated problem (not a different, adjacent problem)?
2. Are success criteria measurable and binary (pass/fail, not "improved")?
3. Does scope match ambition (not under-scoped for a big problem, not over-scoped for a small one)?
4. Does the problem statement describe a real user need with evidence (not "we should have X")?

### Grade: PASS / WARN / FAIL

**PASS anchor:** Plan targets "users lose work when session expires" → implements auto-save + session extension. Clear problem → direct solution → success criteria = "zero data loss on session timeout."

**WARN anchor:** Plan targets "improve onboarding" → implements 3 changes but success criteria say "better NPS score" (not binary). Problem is real but criteria are fuzzy.

**FAIL anchor:** Plan targets "improve UX" → implements 12 unrelated features (dark mode, animations, redesign). Vague problem → shotgun solution → no way to verify "done."

---

## Lens B: Execution Credibility

Can a skilled engineer ACTUALLY deliver this?

### Check Questions
1. Is the timeline realistic for the scope? (Gut check: does file count × complexity fit in estimated sessions?)
2. Are technical choices justified (not assumed)? ("Use PostgreSQL" needs "because [reason]", not just stated)
3. Is task decomposition granular enough? Per development-rules.md: files under 200 lines, tasks touching 5+ files should be split.
4. Are dependencies mapped (what blocks what)? Can Phase 2 start before Phase 1 finishes?

### Grade: PASS / WARN / FAIL

**PASS anchor:** 3 phases, each modifying 2-3 files, clear dependency chain (Phase 1 → 2 → 3), estimated 2-3 sessions. Technical choices documented with rationale.

**WARN anchor:** 4 phases, reasonable scope, but Phase 3 has a task "implement API integration" touching 6 files with no subtask breakdown. Likely deliverable but risky.

**FAIL anchor:** "Phase 1: Build entire payment system" — single task, 15+ files, no breakdown, no time estimate, no dependency mapping. Cannot assess if this is 2 hours or 2 weeks.

---

## Verdict Logic

| Lens A | Lens B | Overall Verdict |
|--------|--------|-----------------|
| PASS | PASS | **APPROVED** |
| PASS | WARN | **APPROVED with notes** (execution risk flagged) |
| WARN | PASS | **APPROVED with notes** (intent clarity flagged) |
| WARN | WARN | **APPROVED with notes** (both flagged for human attention) |
| FAIL | any | **NEEDS REVISION** (intent misaligned) |
| any | FAIL | **NEEDS REVISION** (not buildable as scoped) |

**Rule: Any FAIL → NEEDS REVISION.** No exceptions. WARN is noted but doesn't block.

When verdict is NEEDS REVISION, present specific failures with suggestions:
> "Lens B: FAIL — Phase 2 has a single task touching 12 files. Split into 3-4 subtasks with clear file ownership before proceeding."

---

## Relationship to validate-plan

| Dimension | validate-plan | Two-Lens Eval |
|-----------|--------------|---------------|
| Scope clarity | ✅ Binary check | ✅ Strategic fit |
| Success criteria | ✅ Exists check | ✅ Measurable + binary check |
| Dependencies | ✅ Listed check | ✅ Buildability assessment |
| Architecture | ✅ Exists check | ❌ (handled by Section 1) |
| Risk assessment | ✅ Exists check | ❌ (handled by pre-screen) |

**If validate-plan already ran:** CEO-review skips overlapping checks (scope, criteria) and references validate-plan's findings: "validate-plan scored scope 8/10 — proceeding with that assessment."

**If validate-plan did NOT run:** CEO-review covers both intent + credibility from scratch.

---

## Integration

Step 0.5 sits between mode selection and Section 1:

```
Step 0: Mode selection (EXPANSION/SELECTIVE/HOLD/REDUCTION)
Step 0.5: Two-lens evaluation ← THIS
  → If NEEDS REVISION: stop, return findings, user decides
  → If APPROVED (with or without notes): proceed to Section 1
Section 1: Architecture Review
...
Section 11: Design/UX
```

Two-lens findings carry forward into the deep review. If Lens B flagged "task granularity," Section 1 should verify the architecture supports the proposed split.

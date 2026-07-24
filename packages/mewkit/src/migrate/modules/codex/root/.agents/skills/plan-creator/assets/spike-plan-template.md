---
title: "<short investigation title>"
description: "Time-boxed investigation. Findings doc, not deliverable code."
status: pending
priority: P2
spike: true
timebox: "<duration — e.g., 2d, 4h>"
findings_doc: "tasks/plans/{slug}/findings.md"
story_points: 0
jira_tickets: []
sprint_id: null
tags: [spike, investigation]
created: "<ISO ts>"
createdBy: "mk:plan-creator"
source: skill
---

# <Investigation Title>

## Overview

Investigate <X> and produce findings on <Y>. Output is a markdown document at `{findings_doc}`. NO test phase, NO ship phase. The spike is "complete" when the findings doc answers the questions below and a human reviewer accepts it.

**Time-box:** `{timebox}`. If exceeded, Phase 5 hard prompt fires: "Timebox elapsed; what's the state? [Convert to delivery story | Close as research-only | Defer]".

## Compatibility (per `agile-feedback-cycle.md` 2)

- Run via `mk:cook` or `mk:plan-creator --fast`
- **NEVER** run via `mk:autobuild` FULL — harness gate (Phase 2 red → Phase 3 green → Phase 4 review) breaks because spikes skip Phase 2 and Phase 5

## Questions to Answer

List the binary questions the findings doc must answer:

- Q1: <question>
- Q2: <question>
- Q3: <question>

Each Qn becomes a section in `{findings_doc}` with a documented answer + supporting evidence (code refs, links, screenshots).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Investigate | Pending |
| 2 | Document Findings | Pending |

### Phase 1 — Investigate

**Effort:** within `{timebox}`

**Mechanism:**

1. Read existing code, docs, tickets relevant to the question
2. Prototype throwaway code IF needed to test hypotheses (do NOT commit prototype to main)
3. Capture observations as you go in scratch notes — these become 3 evidence in the findings doc
4. If timebox exceeded mid-investigation: STOP, escalate via prompt — "Timebox elapsed mid-investigation. Continue (extend timebox)? Close with partial findings? Abandon?"

### Phase 2 — Document Findings

**Effort:** ≤ 25% of timebox

**Mechanism:**

1. Write `{findings_doc}` with one section per question (Q1, Q2, Q3)
2. Each section: Answer, Evidence, Caveats
3. Add a `## Recommendation` section: "Convert to delivery story | Research-only — no follow-up | Defer to next quarter"
4. Submit findings doc for review (informal — peer or self-review acceptable)

## Acceptance Criteria

- [ ] `{findings_doc}` exists at the documented path
- [ ] Every question (Q1..Qn) has a documented answer with evidence
- [ ] Recommendation section is present
- [ ] Findings doc reviewed and accepted by ≥1 human

## Closure Prompt (auto-fires at Phase 2 complete)

```
Convert findings to delivery story?
  [Yes — extract AC into a new plan]
  [No  — close as research-only]
  [Defer — re-evaluate next sprint]
```

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Spike drifts past timebox | Phase 1 mechanism enforces timebox check; Phase 5 prompt fires automatically |
| Findings doc never written | Phase 2 has explicit AC; the spike is not "done" without it |
| Throwaway prototype gets accidentally committed | Code from spike phase 1 lands in `.spike-scratch/` and is .gitignored |
| Questions are vague | Each Qn must be answerable with evidence — vague Qs fail review |

## Out of Scope

- Production code — that comes from a follow-on delivery story
- Refactor — spikes inform future refactors but don't perform them
- Schema changes — out of scope; flag as a follow-on if discovered

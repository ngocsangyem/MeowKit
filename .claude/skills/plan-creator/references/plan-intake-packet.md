# Plan Intake Packet

External-artifact adapter for plan-creator. Consolidates 2+ pre-existing upstream
artifacts into ONE packet before planning starts, so the draft step reads one
traceable brief instead of N scattered reports.

## Purpose

When a user invokes plan-creator, upstream analysis often already exists:
`mk:office-hours` design docs, `mk:brainstorming` reports, `mk:planning-engine`
assessments, `mk:confluence-spec-analyst` spec reports, `mk:intake` triage output,
`mk:jira-analyst` findings, scout summaries, or spec documents the user supplies
directly. Without a packet, that context arrives as a raw list of file paths and
the planner re-derives (or silently drops) what those artifacts already settled.

The packet is an ADAPTER for artifacts that exist BEFORE plan-creator runs. It is
explicitly NOT for artifacts plan-creator generates itself — step-01 research
reports and step-02 scout output are consumed directly by step-03, never routed
through the packet. One pre-existing ticket with no other sources is single-ticket
triage — that is `mk:intake`'s job, not this packet's.

## Activation

- **≥ 2 external artifact paths** referenced in the invocation / task description
  → build the packet (step-00-5).
- **0–1 sources** → skip entirely. No packet, no behavior change.

An "external artifact" is a readable file path supplied by the user or an upstream
skill — not a file plan-creator's own steps will generate during this run.

## Schema

Six blocks, in this order. Target the whole packet at UNDER 120 lines.

```markdown
# Plan Intake Packet: {slug}

## Request
- Raw request: {verbatim or tightly condensed user ask}
- Desired output: {what the user expects to exist at the end}
- Constraints: {stack, deadlines, compatibility — from: <path> each}
- Non-goals: {explicit exclusions found in sources}

## Routing
- Recommended mode: {fast | hard | deep | parallel | two} (via mk:scale-routing)
- Conflict: {if plan-creator's own heuristic disagrees with mk:scale-routing,
  record BOTH signals here — do not silently pick one}

## Requirements
- Functional: {bullets, each with from: <path> or [ASSUMPTION]}
- Non-functional: {bullets, same rule}
- Acceptance criteria: {binary checks found in sources}
- User-confirmed decisions: {decisions a human already made upstream — LOCKED;
  red-team may challenge but must escalate, never silently cut}

## Evidence
- Sources: {one line per artifact: path + 1-line role}
- Unknowns: {questions the sources leave open}

## Scope Shape
- Likely files/areas: {from sources only — do not scout here}
- Risk areas: {flagged in sources}
- Phase granularity hint: {e.g. "2-3 phases", from source complexity signals}

## Handoff
- Suggested plan-creator mode: {matches Routing unless conflict noted}
- Follow-up questions: {for step-06 validation interview}
- Assumptions allowed: {what the planner may assume without asking}
```

## Quality Rules

- Every load-bearing claim carries `from: <path>` (packet source, report, spec)
  or the tag `[ASSUMPTION]`. A claim with neither is not admissible.
- Packet stays **under 120 lines**. Consolidate, don't concatenate.
- The packet is a BRIEF, not a plan:
  - NO detailed implementation plan or step-by-step code instructions.
  - NO phase files — phase decomposition is step-03's job.
  - NO validation changes — `validate-plan.py` does not know about packets.
  - NO brainstorming — if the approach is unsettled, route to `mk:brainstorming`
    BEFORE planning; the packet only records what sources already settled.
  - NO ticket complexity scoring — that is `mk:intake` / `mk:planning-engine`.
- Read large sources with `offset`/`limit` (files > 500 lines) per Tool Output
  Limits; summarize into the packet, never paste raw content.

## Output Location

- **Draft (step-00-5):** `.claude/session-state/plan-creator-intake-packet.md`
- **Final (step-03):** moved to `{plan_dir}/research/plan-intake-packet.md` and
  cited by the plan like any research report (`from: research/plan-intake-packet.md`).

## Not This Skill's Job

| Task | Owner |
|------|-------|
| Single ticket/PRD triage, completeness scoring, RCA | `mk:intake` |
| Ticket complexity + dependency mapping against the codebase | `mk:planning-engine` |
| Exploring solution approaches, trade-off analysis | `mk:brainstorming` |
| Plan structural validation | `mk:plan validate` (validate-plan.py) |
| Rendering plans to HTML | `mk:visual-plan` |

If a request fits one of these rows, the packet does not absorb it — hand off.
The packet only consolidates artifacts those skills (or the user) already produced.

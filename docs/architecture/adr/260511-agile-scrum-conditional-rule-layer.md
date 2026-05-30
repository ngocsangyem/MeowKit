# ADR: Agile/Scrum Conditional Rule Layer

**Date:** 2026-05-11
**Status:** Accepted
**Deciders:** ngocsangyem (user), Claude (agent)
**Plan:** `plans/260510-2333-agile-scrum-rule-layer-design/`

## Context

MeowKit lacked an explicit Agile/Scrum governance layer. Seven verified gaps surfaced during Phase 1 research: Definition of Ready, Definition of Done with Jira sync, sprint commitment immutability, sprint-goal persistence, story↔plan↔contract↔verdict traceability, retro→action ceremony, and spike vs story distinction.

Adding a conventional Agile framework would have meant a parallel pipeline (a new `mk:agile-coach` agent, sprint-management skill, dedicated gate). That conflicts with two locked toolkit principles: rules-not-automation and zero context cost for non-Agile sessions.

## Decision

Add **3 conditional rules** in `.claude/rules-conditional/agile-*.md` loaded by `mk:agent-detector` Step 0b ONLY when an Agile context is detected. Total budget ≤6 KB target (delivered ~7.4 KB; trade-off accepted to preserve mechanical specificity). No new agents, no new hooks, no new gates. All integration is done by extending existing skills (`mk:plan-creator`, `mk:sprint-contract`, `mk:retro`, `mk:jira-agile`, `mk:ship`, `project-manager` agent).

The 3 rules cover:

- `agile-story-gates.md` — DoR (Phase 1 entry) + DoD (Gate 2 PASS) + traceability
- `agile-sprint-commitment.md` — sprint-goal persistence + amendment ceremony + sprint-close hygiene
- `agile-feedback-cycle.md` — retro action-item ceremony + spike governance

Sprint-LEVEL state lives at `tasks/contracts/sprint-state-{date}-sprint-{N}.md` — distinct from per-story sprint-CONTRACT files.

## Alternatives Rejected

- **Always-on Agile rules:** rejected — bloats context for non-Agile sessions. The conditional pattern (Phase-zero precedent in `phase-contracts.md` etc.) was already proven in the toolkit
- **New `agile-coach` / `scrum-master` agent:** rejected — duplicates planner/orchestrator/PM responsibilities; adds another scoring layer to `mk:agent-detector`
- **New Gate 3 for sprint commitment:** rejected — gates are the discipline core; adding a third gate triples human approval friction. Sprint commitment is a softer ceremony, suited to advisory prompts
- **Bidirectional Jira sync:** rejected — Jira receives projections (verdict comment, status transition) only. Plan-as-source-of-truth is preserved. Bidirectional sync would entangle two truth surfaces

## Consequences

### Zero context cost for non-Agile sessions

Pre-flight check + 4-condition OR-logic detection in `mk:agent-detector` Step 0b. Non-Agile sessions skip the rule load silently.

### `mk:ship` carries a frontmatter-read on every invocation

The DoD prompts are gated by `verdict.jira_tickets:` non-empty — but `mk:ship` already reads the verdict file to check PASS/WARN/FAIL, so the marginal cost is one grep. Acceptable.

### Sprint-state contract introduces a NEW file class in `tasks/contracts/`

Path discipline: leading `sprint-state-` prefix prevents glob collision with the existing `check-contract-signed.sh` glob (`tasks/contracts/*-{slug}-sprint-*.md`). Verified safe — sprint-state files have no slug between leading `*` and `-sprint-`.

### Concurrent-write safety requires `flock`

`mk:jira-agile sprint add|remove` and `mk:sprint-contract sprint-goal set` MUST acquire `flock` on the sprint-state file before any read-modify-write cycle. YAML frontmatter append is non-atomic across shells. Documented in both rule body and consuming skills.

### Spike plans are INCOMPATIBLE with `mk:autobuild` FULL

Autobuild FULL requires Phase 2 (test red) → Phase 3 (build green) → Phase 4 (review) sequence with sprint-contract gate. Spikes skip Phase 2 and Phase 5. Run via `mk:cook` or `mk:plan-creator --fast`. Documented in `autobuild-runbook.md` and rejected at `mk:plan-creator` step-00.

### Pruning-plan dependency

This plan was `blockedBy: 260509-1443-meowkit-rules-context-pruning` Phase 2 (which establishes `.claude/rules-conditional/`). The directory was co-created in this implementation as the pruning plan had not yet physically deployed it on filesystem. `mk:agent-detector` Step 0b PRE-FLIGHT check defends against future drift.

## Mechanism summary (cross-link)

| Trigger | Loaded rule | Owner skill / hook | Action emitted |
|---|---|---|---|
| `mk:plan-creator` Phase 1 entry, plan has `jira_tickets:` | `agile-story-gates.md` 1 | `mk:plan-creator` SKILL.md | DoR advisory checklist (never blocks) |
| Gate 2 PASS, verdict has `jira_tickets:` | `agile-story-gates.md` 2 | `mk:ship` SKILL.md | 3 opt-in DoD prompts |
| `mk:sprint-contract sprint-goal` invoked | `agile-sprint-commitment.md` 1 | `mk:sprint-contract` SKILL.md | Read/write sprint-state goal |
| `mk:jira-agile sprint add/remove` post-start | `agile-sprint-commitment.md` 2 | `mk:jira-agile` SKILL.md | flock + amendment append + reason prompt |
| `mk:jira-agile sprint close` | `agile-sprint-commitment.md` 3 | `mk:jira-agile` SKILL.md | Per-ticket disposition + closure summary |
| `mk:retro` step 5 (Agile context) | `agile-feedback-cycle.md` 1 | `mk:retro` SKILL.md | Per-action AskUserQuestion ceremony |
| `mk:plan-creator --spike` invocation | `agile-feedback-cycle.md` 2 | `mk:plan-creator` step-00 | Spike template + harness-FULL incompatibility check |

## Out of Scope

- WIP limits (team policy concern)
- Async standup cadence (needs cron)
- PO acceptance ceremony (human social)
- Velocity hygiene (skill-level concern)
- Bidirectional Jira sync
- Confluence-spec-presence DoR check (deferred to v2 based on demand)
- Sprint-state auto-archive (deferred until contracts dir hits measurable size)

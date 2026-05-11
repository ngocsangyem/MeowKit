---
source: original
applies_to: [mk:retro post-narrative, mk:plan-creator --spike]
loaded_by: mk:agent-detector Step 0b (Agile context only)
trust_level: MED
---

# Agile Feedback Cycle — Retro→Action + Spike Governance

**Core rule:** Retro insights become tracked work or get a documented "no action" decision. Spikes are time-boxed investigations, not deliverables.

## 1 — Retro action-item ceremony

**Triggers:** `mk:retro` completes step 4 (narrative written).

1. Parse narrative for `## 3 Things to Improve` and `## 3 Habits for Next Week` (per `mk:retro/references/narrative-output.md`). Best-effort keyword match
2. ≥1 item → per-item AskUserQuestion. 0 items → freeform: "List action items, one per line. Empty = no action."
3. Per-item options: `Create Jira story now` | `Add to plan TODO` | `No-action` | `Defer`
4. `Create Jira story now` → `mk:jira-issue create` body pre-filled — REQUIRES user review
5. `No-action` → append to `.claude/memory/retros/{date}-decisions.md` (distinct from existing retro pattern files)
6. Retro is not "complete" until every action has a disposition

**NEVER auto-create Jira stories. INSTEAD:** surface, propose, human edits and submits. Preserves reports-not-automation.

## 2 — Spike governance

**Triggers:** `mk:plan-creator --spike` flag OR plan frontmatter `spike: true`.

**Compatibility:** Spike plans are INCOMPATIBLE with `mk:harness` FULL (Phase 2/Phase 5 skip breaks the harness gate). Run via `mk:cook` or `mk:plan-creator --fast`, NEVER `mk:harness` FULL.

1. Frontmatter MUST include `spike: true`, `timebox: <duration>` (e.g. `"2d"`), `findings_doc:` (default `tasks/plans/{slug}/findings.md`)
2. Estimate cap (advisory): warn if `story_points > 5`
3. Plan template:
   - Goal: "Investigate X and produce findings on Y"
   - AC: "Doc at `{findings_doc}` answers Q1, Q2, Q3"
   - NO test phase, NO ship phase — Phase 5 = "Findings doc written and reviewed"
4. At completion: "Convert findings to delivery story? [Yes — extract AC | No — research-only | Defer]"

Enforce spike timeboxes as Phase 5 hard prompts: "you said 2d; 2d has passed; what's the state?"

## Integrations

- `mk:retro` post-narrative step 4.5 → 1 (Agile-context-only; inert when rule not loaded)
- `mk:plan-creator --spike` → 2 step-00 mode-detection branch + spike template

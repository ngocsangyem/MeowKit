---
source: original
applies_to: [Phase 0 orient, mk:sprint-contract sprint-goal, mk:jira-agile sprint add/remove/close]
loaded_by: mk:agent-detector Step 0b (Agile context only)
trust_level: HIGH
---

# Agile Sprint Commitment — Goal + Immutability + Hygiene

**Core rule:** A running sprint has a written goal and an explicit committed ticket set. Mid-sprint additions are logged as amendments — never silent.

## 1 — Sprint goal persistence

**Triggers:** `mk:sprint-contract sprint-goal` invoked OR `mk:planning-engine` produces a goal candidate the user accepts.

1. Goal lives in `tasks/contracts/sprint-state-{date}-sprint-{N}.md` `sprint_goal:` (template: `mk:sprint-contract/assets/sprint-state-template.md`). One-line, ≤120 chars
2. `mk:agent-detector` Step 0b reads newest active sprint-state, surfaces `sprint_goal:` in orient banner
3. `mk:plan-creator` Phase 1 advisory: "Does this plan serve sprint goal '{goal}'?"

**NEVER persist sprint goal in `.claude/memory/`** (memory churns). **INSTEAD:** file-based contract; survives sessions; auditable in git.

## 2 — Commitment immutability + amendment ceremony

**Triggers:** `mk:jira-agile sprint add KEY` or `sprint remove KEY` AFTER sprint started (status: `active`).

- **Harness FULL:** `mk:sprint-contract amend` — generator+evaluator both re-sign. Existing canonical ceremony, no change
- **Non-harness LEAN/MINIMAL:** Append to sprint-state `amendments:`. AskUserQuestion: "Reason for mid-sprint scope change?" — required free-text. Append IS the commitment

**Concurrent-write safety:** consuming skill MUST `flock` the sprint-state file before any read-modify-write. YAML append is non-atomic across shells.

Log transparently, then proceed.

## 3 — Sprint close hygiene

**Triggers:** `mk:jira-agile sprint close` invoked.

1. Read sprint-state `committed_tickets:`
2. Query each via `mk:jira-issue get KEY`
3. Per non-terminal ticket (not Done/Cancelled/Won't-Do): "PROJ-X is in {status}. Carry over? Drop? Mark not delivered?"
4. Write closure: `status: closed`, `closed_at`, `delivered: [...]`, `carried_over: [...]`

**NEVER close silently when commitments are unmet. INSTEAD:** prompt — feeds retro and velocity calibration.

## Integrations

- `mk:agent-detector` Step 0b → reads newest sprint-state, surfaces goal
- `mk:sprint-contract sprint-goal` → 1
- `mk:jira-agile sprint add|remove` → 2; `sprint close` → 3

## Validator scope

`validate-contract.sh` validates per-story sprint-CONTRACT files only. Sprint-STATE files have no validator — YAML parsed inline. Do not invoke `validate-contract.sh` on a sprint-state path; it FAILS.

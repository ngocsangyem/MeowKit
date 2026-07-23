---
name: "rule-context-budget-rules"
description: "rule-context-budget-rules"
---

# Context Budget Rules

A phase × tier read-budget so any inner harness loads the smallest right context per
phase — just-in-time, not all-at-once. This rule is the **Context selection** responsibility
made explicit; it complements the context-ordering guidance in `agent-conduct.md` (B3, B6)
rather than restating it.

These budgets are **advisory** — a ceiling to plan reads against, never a hard gate. They
are pure text, readable by any inner harness with no hook.

## How to Read the Matrix

- **Rows** = the seven workflow phases (Orient, Plan, Test, Build, Review, Ship, Reflect).
- **Columns** = task tier (low / standard / complex), as classified at Orient.
- **Each cell** = the minimum read-set to load + an advisory token ceiling for that cell.
- Load the read-set, stay under the ceiling, and escalate only on a Retrieval trigger below.

Read-set abbreviations: **task** = task/plan spec · **reg** = registry/index · **mem** =
curated memory stores · **mod** = directly-affected module files · **conv** = local
conventions · **AC** = acceptance criteria · **sig** = target signatures/contracts ·
**diff** = the change diff · **rev** = review rubric + safety rules · **ship** = verdict +
release notes + deploy notes · **dec** = decisions/learnings.

## Phase × Tier Read-Budget

| Phase   | low                    | standard                      | complex                          |
| ------- | ---------------------- | ----------------------------- | -------------------------------- |
| Orient  | task (≤2k)             | task + reg (≤5k)              | task + reg + mem (≤10k)          |
| Plan    | task (≤3k)             | task + mod + conv (≤12k)      | task + mod + conv + dec (≤25k)   |
| Test    | AC (≤2k)               | AC + sig (≤8k)               | AC + sig + mod (≤18k)            |
| Build   | mod + conv (≤6k)       | mod + conv + sig (≤15k)      | phase-file + mod + conv (≤30k)   |
| Review  | diff (≤4k)             | diff + rev (≤12k)            | diff + rev + mod (≤25k)          |
| Ship    | diff (≤3k)             | ship (≤8k)                   | ship + diff (≤15k)              |
| Reflect | dec (≤2k)              | dec + mem (≤6k)              | dec + mem + diff (≤12k)         |

Ceilings are per-phase working budgets, not session totals. Prefer sub-task isolation for
broad investigations so their reads do not accumulate in the driving context.

## Retrieval Triggers

Escalate beyond the cell's read-set ONLY when one of these holds — each names what to pull
in and why:

- **Schema / data-model change** → read the affected schema + its migration + every caller
  of the changed shape. Silent shape drift breaks downstream readers.
- **Public contract change** (endpoint, SDK signature, response envelope) → read the contract
  definition + at least one consumer. Contract breaks are invisible in the diff alone.
- **Security-sensitive surface** (auth, permissions, credentials, audit) → read the relevant
  safety rules + the existing guard being touched, regardless of tier.
- **Cross-cutting refactor** (touches > 2 production files or > 5 callers) → read the call
  sites before editing; scope-blind edits cascade.
- **Failed verification** → read the failing output + the implicated module before retrying;
  do not re-attempt on the same context.
- **Resume after reset** → read the active phase file + plan status first, then the cell's
  read-set. Resumption needs the status, not the whole history.

When a trigger fires, pull in the named context for that step only — then return to the cell
budget. Do not promote the whole task to a higher tier for one read.

## Provenance

"Context selection" is one responsibility in the vendor-neutral substrate taxonomy
(repo-harness synthesis, Runtime-Substrate-rooted). This rule is the toolkit's concrete
read-budget for that responsibility; the substrate view (`inventory --substrate`) maps
artifacts onto it.
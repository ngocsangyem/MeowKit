---
phase: 3
title: "Gate-free, model-fit instructions on three runtimes"
status: done
priority: P1
effort: "9d"
dependencies: [2]
---

# Phase 3: Gate-free, model-fit instructions on three runtimes

## Context Links

- [Verification findings](research/verification-findings.md)
- [Runtime-docs triage](research/runtime-docs-triage.md) — implementation notes per phase, read first
- [Scope map](research/scout-scope-map.md)
- [Bundle provenance](research/researcher-01-bundle-provenance-and-sync.md)
- [Intake packet](research/plan-intake-packet.md)
- Component audit and model findings: `docs/research/meowkit-evolution-2611/05-skill-agent-rule-hook-audit.md`, `03-foundation-model-research.md`

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** 9d
- **Depends on:** Phase 2
- **Description:** Rewrite rules, agents and every gate reference in skills and docs so the text matches the gate-free kit and passes eight fixed audit criteria, on Claude Code first and then on the Codex and Cursor bundles. Lands as four pull requests: 3a rules, validators and manifests; 3b gate text in Claude Code agents and skills; 3c bundle ports; 3d model-fit criteria on rules and agents.

## Key Insights

- Gate lines: `gate-rules.md` 15, `meowkit-core.md` 4, `CLAUDE.md` 8; 13 of 42 agent definitions plus 2 index files; 126 files in 37 skills, led by `cook` 93, `plan-creator` 77, `autobuild` 57, `review` 37 (from: research/scout-scope-map.md).
- Bundles are separate hand-written copies: 123 Codex and 112 Cursor files carry gate lines; Codex has `AGENTS.md` and no markdown rules; Cursor has `AGENTS.md` and 5 `.mdc` files (from: research/researcher-01-bundle-provenance-and-sync.md).
- Rules sit at 25,420 B of a 25,600 B ceiling; retiring `gate-rules.md` frees 7,642 B (from: research/scout-scope-map.md).
- `gate-rules.md` is required by `validate/structure.rs` `ALWAYS_ON_RULES`, pinned by `scripts/rule-survival-oracle.cjs`, listed in two `.meowkit` manifests and named in about 20 golden recordings (from: research/verification-findings.md).
- Prescriptive always-on text is the one scaffolding class with evidence of cost without benefit on current models; operational checks are not (from: research/plan-intake-packet.md).
- 36 agents set `memory:`, which grants write tools to 21 that do not declare them; 12 agents pin one model id against the tier rule (from: research/plan-intake-packet.md).

## Requirements

### Functional
1. Audit criteria. A1, A2 and A5 apply to every edited file (3a–3c); A3, A4, A6, A7 and A8 apply to rules and agents only, in their own pull request (3d):
   - A1 no instruction to obtain or wait for an approval gate
   - A2 no enforcement claim without a named mechanism
   - A3 emphatic absolutes only on security and data-safety rules; elsewhere a plain statement with its reason
   - A4 no passage duplicated across always-on files
   - A5 no stale path, verb or file reference
   - A6 no host-specific tool name in text shipped to another runtime; no model-family name as a condition
   - A7 agent declared tools equal effective tools; `model:` follows one documented rule
   - A8 always-on bytes do not grow
2. `gate-rules.md` is retired; what remains true (ship check, human approval for irreversible actions through the host prompt) moves into `meowkit-core.md`.
3. Workflow text in `cook`, `plan-creator`, `review`, `ship`, `fix`, `autobuild` and the other 31 skills describes planning and review as practices, with no gate.
4. Each `.claude/` change is ported to the matching Codex and Cursor file.
5. README, `CLAUDE.md` and `docs/core/` describe the kit as it is, sourced from a per-runtime enforcement matrix (control × runtime × enforced, advisory or absent); the checker rejects an enforcement claim that is not in the matrix. The matrix also lists the states in which installed hooks do not run (session started in a subdirectory, untrusted or unreviewed Codex hooks, sparse worktree without `.claude`) and what `privacy-block` does not see (`@`-attached files).
6. Gate paragraphs are removed by a mapping script run over all three trees and diff-checked; text is reworded by hand only where deletion breaks the surrounding instructions.
7. Changelog and upgrade notes name the removed verbs and state that approval is no longer enforced.

### Non-Functional
- A before/after table of static metrics is recorded; a small headless smoke run is recorded when approved.

## Architecture

```
criteria A1–A8 → scripts/check-instruction-criteria.cjs (A1, A2 phrases, A5, A8 mechanical)
.claude/ rewrite → diff per file → hand-port to kit/bundles/codex and kit/bundles/cursor
measure: bytes always-on, gate-phrase count, emphatic-token count, per runtime, before and after
```

## Related Code Files

### Files to Create
- `scripts/check-instruction-criteria.cjs`
- `scripts/remove-gate-text.cjs`
- `docs/core/enforcement-matrix.md`
- `docs/maintainer/instruction-audit-criteria.md`

### Files to Modify
- `.claude/rules/meowkit-core.md`, `.claude/rules/development-rules.md`, `CLAUDE.md`, `README.md`
- `.claude/agents/*.md` (13 definitions and 2 index files with gate lines; 21 for tool grants; 12 for model pin)
- `crates/mewkit-core/src/validate/structure.rs`, `scripts/rule-survival-oracle.cjs`, `.meowkit/pack-manifest.json`, `.meowkit/harness-inventory.json`
- `.claude/skills/{cook,plan-creator,autobuild,review,evaluate,workflow-orchestrator,help,agent-detector,orchestrate,fix,ship,advise,sprint-contract,validate-plan}/**` and 23 further skills
- `kit/bundles/codex/root/AGENTS.md`, `kit/bundles/cursor/root/AGENTS.md`, bundle agents and skills

### Files to Read (Context)
- `scripts/check-always-on-budget.cjs`, `scripts/check-rule-survival.cjs`, `scripts/check-skill-cross-refs.sh`

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Delete | `.claude/rules/gate-rules.md` | Gates removed | `structure.rs` `ALWAYS_ON_RULES`, `rule-survival-oracle.cjs`, 2 manifests, about 20 recordings |
| Modify | `.claude/rules/meowkit-core.md` | Workflow, compaction list, ship check text | ceiling test |
| Modify | `.claude/rules/development-rules.md` | One gate line; criteria A3 | ceiling test |
| Modify | `CLAUDE.md`, `README.md` | Identity and workflow text | docs tests |
| Modify | `.claude/agents/{evaluator,reviewer,planner,advisor,project-manager,shipper,security,developer}.md` + 5, 2 index files | Gate lines | `validate --agents` |
| Modify | `.claude/agents/*.md` (21) | Tool grants match declaration | `validate --agents` |
| Modify | `.claude/skills/cook/**`, `plan-creator/**`, `autobuild/**`, `review/**` | 264 gate lines | skill contract tests |
| Modify | 33 further skills (126 files total) | Remaining gate lines | `check-skill-cross-refs.sh` |
| Modify | `kit/bundles/codex/root/**` (123 files) | Port | `validate --target codex` |
| Modify | `kit/bundles/cursor/root/**` (112 files) | Port | bundle structural checks |
| Create | `scripts/check-instruction-criteria.cjs` | Mechanical criteria | new CI lane |
| Modify | `deletions.json` | Retire `gate-rules.md` | upgrade test |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| No gate instruction in shipped text | none | criteria script over three trees | High |
| Bundle text parity with source | denied-token check only | gate-phrase count equal to zero in bundles | High |

### Interface Checklist

- Skill names, agent names and frontmatter `description` fields stay unless criterion A1 or A5 requires a change.

### Dependency Map

- Rules first, then agents, then skills, then bundles, then docs.
- The second plan (skill body audit) starts from this phase's criteria document.

## Implementation Steps

1. Write `docs/maintainer/instruction-audit-criteria.md` and `scripts/check-instruction-criteria.cjs`; record the before table for the three trees.
2. Retire `gate-rules.md`; rewrite `meowkit-core.md` and `development-rules.md`; update the compaction list, `ALWAYS_ON_RULES`, the rule-survival oracle, both manifests and `deletions.json`; hand-edit the recordings that name the file.
3. Rewrite the 13 agents and 2 index files with gate lines; in 3d make declared and effective tools agree and correct the tier rule text to match the model pins (pins stay).
4. Run `scripts/remove-gate-text.cjs` over `.claude/`; hand-fix `cook`, `plan-creator`, `autobuild`, `review` and the other 33 skills where deletion breaks the text.
5. Run the same mapping over the Codex bundle, then the Cursor bundle; hand-fix; rewrite both `AGENTS.md`.
6. Write `docs/core/enforcement-matrix.md`; rewrite README, `CLAUDE.md`, `docs/core/` from it; add changelog and upgrade notes.
7. Lower the ceiling test to the new size; run the criteria script, `mewkit validate`, `validate --agents`, `validate --target codex`, `npm test`.
8. Record the after table; when approved, run the headless smoke set before and after and record both.

## Todo List

- [x] Criteria document, checker script, mapping script, before table
- [x] [HIGH] Retire `gate-rules.md`; rewrite the two remaining rule files
- [x] Rewrite 13 agents and 2 index files; tool grants and model pins
- [x] Rewrite gate text in four core skills
- [x] Rewrite gate text in 33 further skills
- [x] [HIGH] Port to Codex bundle, then Cursor bundle
- [x] Enforcement matrix; README, `CLAUDE.md`, `docs/core/`; changelog and upgrade notes
- [x] Ceiling, validators and tests green; after table

## Success Criteria

1. `node scripts/check-instruction-criteria.cjs .claude kit/bundles` exits 0.
2. `ls .claude/rules/gate-rules.md` reports missing; `wc -c .claude/rules/*.md` total is below 19,000 B.
3. `mewkit validate`, `mewkit validate --agents`, `mewkit validate --target codex <dir>` exit 0.
4. `docs/maintainer/instruction-audit-criteria.md` contains the before and after tables for three runtimes.
5. `npm test` exits 0.
6. The criteria script confirms the blocked-pattern table in `security-rules.md` and the numbered rules in `injection-rules.md` are unchanged.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Rewrites change behaviour beyond gate removal | M | M | Criteria fix what may change; body audit is out of scope |
| Bundle port misses files | H | M | Checker runs over all three trees |
| Removing emphasis lowers compliance on weaker models | M | M | Keep absolutes on security rules; smoke run on one weaker model when approved |
| Agents lose memory they use | L | M | Drop `memory:` only where no stored memory exists; ask first |
| Retiring the rule file breaks validators and recordings | H | M | All consumers listed; edits land in one commit with `DIVERGENCES.md` rows |
| [RED TEAM] About 380 files are not reviewable as one diff | H | H | Four pull requests; mapping script; estimate 9d |
| [RED TEAM] Docs claim an approval or a ship check a runtime does not have | M | H | Enforcement matrix is the only source for such claims |
| [RED TEAM] Model-fit rewrites change behaviour under a gate-removal label | M | M | Separate pull request 3d, rules and agents only |

## Security Considerations

- `security-rules.md` and `injection-rules.md` keep their rules; only enforcement wording changes where no mechanism exists.
- Approval for push, merge and force is left to the host permission prompt where the host is set to ask; the enforcement matrix marks it advisory.

## Verification Log

Full detail: [verification-findings.md](research/verification-findings.md). Checked 2026-11-15T09:53:08+07:00.
- Fact Checker: 15 verified.
- Flow Tracer: UNVERIFIED (count depends on case sensitivity) — 15 of 44 agent files carry gate lines; recounted as 13 of 42 definitions.
- Scope Auditor: FAILED (not found) — `gate-rules.md` consumers in structure.rs, rule-survival-oracle.cjs and two manifests; now listed.
- Contract Verifier: 9 verified.

## Next Steps

- Second plan: body audit of 128 skills on three runtimes using these criteria.
- Validated 2026-11-15: the enforcement matrix lists the ship check as enforced on three runtimes with changed-file scope and the completion check as opt-in; sprint contracts stay as an autobuild document with no hook check.

## Validation Log

Whole-Plan Consistency Sweep — 2026-11-15T11:48:08+07:00: 12 deltas checked, 0 reconciled, 0 unresolved. Answers: [validation-log.md](validation-log.md).

---
phase: 2
title: "Always-on rules and AGENTS.md"
status: done
priority: P1
effort: "2d"
dependencies: [1]
---

# Phase 2: Always-on rules and AGENTS.md

## Context Links

- [Baseline and vendor sources](research/baseline-and-vendor-sources.md) — §3 rows Fable 5.2, Opus 5, OpenAI guidance
- `.claude/rules/*.md` (18,244 B), `kit/bundles/codex/root/AGENTS.md` (7,745 B), `kit/bundles/cursor/root/AGENTS.md` (4,688 B) + `.cursor/rules/runtime-invariants.mdc` (1,668 B, `alwaysApply: true`)
- `docs/research/meowkit-evolution-2611/05-skill-agent-rule-hook-audit.md` §4 and decision D-1
- Prior plan follow-up: "guidance text for the model when two workflows disagree" (`docs/plans/261115-remove-gates-audit-runtimes-coexistence/phase-05-coexistence-report-in-doctor.md` Next Steps)

## Overview

- **Priority:** P1
- **Status:** Done (worktree, branch `integration/model-fit-audit`)
- **Effort:** 2d
- **Depends on:** Phase 1
- **Description:** Rewrite the text every session loads on each runtime so that absolutes carry scope and reason, standing delegate and re-verify lines go, caution that no longer has a reason goes, and the three runtimes say the same thing in each host's terms. One pull request; bytes may only shrink.

## Key Insights

- Always-on text is the one place where cost is paid every turn; vendor guidance says prescriptive scaffolding written for earlier models raises cost or no longer acts, and that "never" is read as absolute (from: research/baseline-and-vendor-sources.md §3).
- Emphatic tokens in rules: `development-rules.md` 16, `injection-rules.md` 9, `agent-conduct.md` 6, `security-rules.md` 2, `meowkit-core.md` 1. The two security files are pinned and keep theirs; the other 23 are the target (measured 2026-11-15).
- `core-behaviors.md` "Anti-Rationalization" and "Verify, Don't Assume" overlap with what Opus 5 does unprompted; Opus 5 guidance says explicit re-check instructions add cost without gain. This is JUDGEMENT; keep the behaviour, cut the restatement.
- Codex `AGENTS.md` carries a "Delegation & subagents" section; Fable 5.2 guidance asks to review standing delegation lines first when delegation runs high.
- The coexistence follow-up (what the model does when another toolkit's workflow contradicts MeowKit's) has no home yet; one short paragraph fits here.

## Requirements

### Functional
1. Every MUST/NEVER/ALWAYS outside the pinned security text either becomes a plain sentence with its reason, or stays and gains its scope and exception (Fable 5.2 "be explicit about exceptions").
2. Standing instructions to delegate or to re-verify are removed or given a condition (when it is worth it, when it is not).
3. No passage repeats across always-on files of one runtime (A4); the Claude Code compaction block stays in `meowkit-core.md` only for the shipped kit.
4. One paragraph, on all three runtimes, says what to do when another installed toolkit's instructions conflict: the user's words win, then the project's own files, then the kit; name the conflict to the user.
5. Codex and Cursor always-on text uses host terms (`$mk-x`, `/mk-x`, the host's subagent wording) and points to host-correct paths.

### Non-Functional
- Claude Code rules ≤ 18,244 B after (no growth from today); Codex `AGENTS.md` and the Cursor always-on set each ≤ the Phase 1 baseline.
- `scripts/rule-survival-oracle.cjs` and `check-rule-survival.cjs` stay green (update needles only where a sentence they pin was reworded, with the reason in the commit message).

## Architecture

```
.claude/rules/*.md (edit) ──diff──▶ kit/bundles/codex/root/AGENTS.md (port, host terms)
                         └──diff──▶ kit/bundles/cursor/root/AGENTS.md + runtime-invariants.mdc
checker A3/A4/A8/A9/A10 + rule-survival oracle + always-on budget → green
```

## Related Code Files

### Files to Create
- None

### Files to Modify
- `.claude/rules/development-rules.md`, `agent-conduct.md`, `core-behaviors.md`, `meowkit-core.md`
- `kit/bundles/codex/root/AGENTS.md`, `kit/bundles/cursor/root/AGENTS.md`, `kit/bundles/cursor/root/.cursor/rules/runtime-invariants.mdc`
- `CLAUDE.md` (maintainer checkout; compaction block and stale paths from audit C-01 if still present)
- `scripts/check-always-on-budget.cjs`, `scripts/check-instruction-criteria.cjs` ceilings — lower to the new sizes

### Files to Read (Context)
- `scripts/rule-survival-oracle.cjs` — which sentences are pinned
- `docs/core/enforcement-matrix.md` — every enforcement statement must match it

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | `.claude/rules/development-rules.md` | 16 absolutes | ceiling test, survival oracle |
| Modify | `.claude/rules/agent-conduct.md` | 6 absolutes; status block wording | oracle (A1 block pinned) |
| Modify | `.claude/rules/core-behaviors.md` | restated self-checks | ceiling test |
| Modify | `.claude/rules/meowkit-core.md` | coexistence paragraph | ceiling test |
| Modify | `kit/bundles/codex/root/AGENTS.md` | port, delegation section | `validate --target codex` |
| Modify | `kit/bundles/cursor/root/AGENTS.md`, `runtime-invariants.mdc` | port | bundle structural checks |
| Modify | `scripts/check-always-on-budget.cjs` | lower ceiling | `tests/always-on-budget-ceilings.test.ts` |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Safety text survives compression | `check-rule-survival.cjs` | none | — |
| Same rule meaning on three runtimes | none | parity list in Phase 7 | Medium |

### Interface Checklist

- File names of the six rule files stay (validators and `ALWAYS_ON_RULES` list them).
- A1 status block keeps its four statuses and field names (agents and skills parse them).

### Dependency Map

- Phase 6 skill text must not contradict the reworded rules; it runs after this phase.

## Implementation Steps

1. For each non-pinned absolute in the four rule files, decide keep-with-scope or plain-with-reason; write the change.
2. Remove or condition standing delegate and re-verify lines; cut the anti-rationalization restatement where `core-behaviors.md` already says it.
3. Add the coexistence paragraph to `meowkit-core.md`.
4. Port each change to Codex `AGENTS.md` and Cursor `AGENTS.md`/`runtime-invariants.mdc` in host terms.
5. Lower the ceilings to the new sizes; run checker, oracle, budget test, `mewkit validate`, `validate --target codex`.

## Todo List

- [x] Absolutes rewritten in four Claude Code rule files
- [x] Standing delegate/re-verify lines removed or conditioned
- [x] Coexistence paragraph on three runtimes
- [x] Codex and Cursor always-on text ported in host terms
- [x] Ceilings lowered; checks green

## Success Criteria

1. `node scripts/check-instruction-criteria.cjs` exits 0; `--metrics` shows always-on bytes ≤ baseline on all three trees and emphatic tokens in the four non-pinned rule files ≤ 8 in total.
2. `node scripts/check-rule-survival.cjs` and `node scripts/check-always-on-budget.cjs .` exit 0.
3. `grep -c "conflict" .claude/rules/meowkit-core.md kit/bundles/*/root/AGENTS.md` ≥ 1 in each.
4. `mewkit validate` and `npx vitest run tests/always-on-budget-ceilings.test.ts` exit 0.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Smaller models follow softened rules less | M | M | Keep absolutes with scope on data-safety lines; optional smoke on one small model per host (ask first) |
| Oracle needles pin reworded sentences | M | L | Update needles in the same commit, reason in message |
| Coexistence paragraph read as permission to ignore kit rules | L | M | State that security rules still apply whichever toolkit asks |

## Security Considerations

- `security-rules.md` and `injection-rules.md` are not edited; the checker hash proves it.

## Outcome (2026-11-15)

- Always-on bytes: Claude Code 18,244 → 18,191; Codex 7,745 → 7,676; Cursor 6,356 → 6,289. Ceilings in `check-always-on-budget.cjs` and `check-instruction-criteria.cjs` set to these sizes (0 headroom).
- Emphatic tokens in the four non-pinned rule files: 23 → 2 (`NEVER` on force-push and on pushing to main).
- Coexistence paragraph on all three runtimes; root `CLAUDE.md` compaction block replaced by a pointer to `meowkit-core.md`.
- Survival oracle: development-rules needles moved to the plain wording, one per former absolute; core-behaviors bodies for confusion and verification now pinned.
- Review fixes applied: push-to-main kept as a scoped prohibition; "take the default" limited to details the spec leaves open; "one check is enough" limited to re-running a passed check on unchanged code; review and security audit always go to their agent; Codex memory keeps "never a bare file edit"; Cursor keeps `/agent-name` and `/mk-<skill>`.
- Found, not fixed: `node scripts/check-dangling-rule-refs.cjs .` fails on `main` on `docs/plans/261115-remove-gates-audit-runtimes-coexistence/research/researcher-02-cli-gate-surface-and-doctor.md:31` (old rule path), unrelated to this phase.

## Next Steps

- Phase 6 aligns skill text with these rules; Phase 7 adds the rule-parity row.

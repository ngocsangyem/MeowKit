# Instruction audit criteria

The criteria every rule, agent, skill and bundle instruction file is held to now that MeowKit
has no plan-approval or review-approval gate. The mechanical subset is checked by
`node scripts/check-instruction-criteria.cjs .claude kit/bundles`; the rest is reviewed by hand
against this page. A second audit of skill bodies starts from these criteria.

## Criteria

| Id | Criterion | Applies to | Checked by |
|---|---|---|---|
| A1 | No instruction to obtain or wait for an approval gate (`Gate 1`, `Gate 2`, `HARD GATE`, approval receipts, `gate-rules.md`). Planning and review are described as practices the agent does, not stops it waits at. | every edited file | script |
| A2 | No enforcement claim without a named mechanism. "Enforced by `X`" must name a file that exists; "no bypass" and "hook-enforced" need the hook named. What is enforced on which runtime comes from `docs/core/enforcement-matrix.md`. | every edited file | script (partly), review |
| A3 | Emphatic absolutes (MUST, NEVER, ALWAYS, CAPITALS) only on security and data-safety rules; elsewhere a plain statement with its reason. | rules, agents | review; count reported |
| A4 | No passage duplicated across always-on files. | rules, agents | review |
| A5 | No stale path, verb or file reference: no removed verb (`plan approve`, `validate --gates`, `verdict-gate`) and no deleted gate file. | every edited file | script |
| A6 | No host-specific tool name in text shipped to another runtime; no model-family name used as a condition. | rules, agents | review |
| A7 | An agent's declared tools equal its effective tools; `model:` follows one documented rule. | agents | review, `mewkit validate --agents` |
| A8 | Always-on bytes do not grow (Claude Code rules; each bundle's `AGENTS.md`). | rules, `AGENTS.md` | script |

The blocked-pattern table in `security-rules.md` and the numbered rules in `injection-rules.md`
are pinned by hash: the script fails if either changes. Their own wording ("bypass gates") is
exempt from A1.

## What replaces the gates

- **Planning.** For a change of more than two files or a few hours, write the plan and agree
  it with the user before building. Nothing blocks an edit without one.
- **Review.** Review the diff before shipping and record the verdict. Nothing blocks a commit
  on the verdict.
- **Ship check.** On a commit, push, merge or `gh pr create|merge`, a hook runs lint, the tests
  related to the changed files and a type-check, and refuses the command when one fails. It is
  the one ship-time control, on all three runtimes.
- **Irreversible actions.** Push, merge and force are approved through the host's own
  permission prompt when the host is set to ask; MeowKit does not add a gate of its own.

## Before and after

Measured with `node scripts/check-instruction-criteria.cjs --metrics` over every `.md` and
`.mdc` file in each tree. Always-on bytes are the rule files on Claude Code and `AGENTS.md` on
the bundles.

### Before (2026-11-15, gates removed from hooks and CLI, text not yet rewritten)

| Tree | Text files | Always-on bytes | Gate phrases | Emphatic tokens |
|---|---|---|---|---|
| .claude | 914 | 25420 | 512 | 640 |
| kit/bundles/codex/root | 809 | 7756 | 342 | 478 |
| kit/bundles/cursor/root | 855 | 4702 | 333 | 485 |

### After (2026-11-15, gate text rewritten in all three trees)

| Tree | Text files | Always-on bytes | Gate phrases | Emphatic tokens |
|---|---|---|---|---|
| .claude | 911 | 18244 | 0 | 627 |
| kit/bundles/codex/root | 849 | 7745 | 0 | 515 |
| kit/bundles/cursor/root | 853 | 4688 | 0 | 482 |

The always-on ceilings in `scripts/check-instruction-criteria.cjs` and
`scripts/check-always-on-budget.cjs` were lowered to these sizes (Claude Code rules 18500 B, a
little headroom for the canonical-source pointer and one short rule line). The headless smoke set
was not run: live model runs were declined for this change.

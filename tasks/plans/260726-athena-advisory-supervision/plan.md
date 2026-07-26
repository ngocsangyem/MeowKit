---
title: "Athena advisory supervision (--advice)"
status: in-progress
priority: P1
created: 2026-07-26
approval:
  approved_by: nnsang24@gmail.com
  date: 2026-07-26
  plan_hash: c04ee175ef309b4fbbf6446c206d14e83e0091dc4938e7c0b6d3997b4e7444b6
---

# Athena advisory supervision

## Goal

Add `athena`, a one-shot, evidence-first, advisory-only supervision agent invoked
ONLY at declared checkpoints when the user passes `--advice`. Ship it as a single
vertical slice on `mk:fix`, with authored-bundle parity on the Codex and Cursor
planes, and durable checkpoint receipts through the existing task-record
`evidenceRefs` slot.

Full plan (phases, research grounding, red-team findings, locked decisions) lives
in the sibling repository at
`../claude-tool/plans/260726-1402-meowkit-athena-advisory-supervision/`.
This file is the meowkit-local Gate 1 record for the source edits that plan requires.

## Scope — this approval covers

| Area | Files |
|---|---|
| Shared contract | `.claude/rules-conditional/advice-supervision-rules.md` (new), `.claude/rules/gate-rules.md` (reviewer standing-item trigger paths) |
| Governance | `docs/governance/dead-weight-audit-registry.md` (WATCH row), `.meowkit/harness-inventory.json` (registry entry for the new rule + agent) |
| Claude plane | `.claude/agents/athena.md` (new), `.claude/agents/AGENTS_INDEX.md` (regenerated), `.claude/skills/fix/SKILL.md`, `.claude/skills/fix/references/workflow-standard.md`, `.claude/skills/fix/references/workflow-deep.md` |
| Inventory | `packages/mewkit/src/core/build-inventory.ts` — athena agent-contract classification branch beside `advisor` |
| Codex bundle | `packages/mewkit/src/migrate/modules/codex/root/.codex/agents/athena.toml` (new), codex `mk-fix` skill wrapper, `codex/compliance/capability-coverage.json` |
| Cursor bundle | `packages/mewkit/src/migrate/modules/cursor/root/.cursor/agents/athena.md` (new), cursor `mk-fix` skill wrapper, `cursor/catalog/agent-packs.json`, `cursor/compliance/native-surface-matrix.json` |
| Receipts | `.claude/rules-conditional/advice-supervision-rules.md` receipt section; read-first on `packages/mewkit/src/core/trace-analysis.ts`; no `task-record.ts` schema change |
| Capability | capability registry entry for an `advice-supervision` intent, per-provider state |

## Out of scope (this approval)

- Wrapping `mk:cook`, `mk:ship`, or `mk:autobuild` — gated behind supervised-vs-control
  measurement, which is a separate approval.
- Any change to `mk:advise` or the `advisor` agent.
- Any change to `task-record.ts` `schemaVersion`.
- Any change to executor model selection.

## Constraints (must NOT change)

- Gate Authority Invariant: counsel is evidence, never approval. No new gate.
- `mk:fix`'s existing 3-failed-attempts human STOP fires on its own schedule.
- No model names or ids in generic skill bodies or the shared rule.
- Provider support states are reported honestly; `unverified` until a live run proves otherwise.

## Acceptance criteria

- [ ] Without `--advice`, zero athena invocations; with it, call count equals the number of
      declared checkpoint triggers that fired (max 3 per run).
- [ ] Athena has no file-mutation tools on the Claude plane and `readonly: true` on Cursor;
      on Codex the ban is stated as behavioral-only.
- [ ] `npx mewkit validate` green; `mewkit validate --agents` green; AGENTS_INDEX regenerated,
      not hand-edited.
- [ ] `npm run build && npm run lint && npm run typecheck && npm test` green on Node 24.
- [ ] Every provider reports exactly one of supported / fallback / unavailable / unverified,
      each backed by a dated note.
- [ ] Dead-weight registry row present in the same change as the new components.

## Verification

```
npx mewkit validate
npx mewkit validate --agents
npm run build && npm run lint && npm run typecheck && npm test
```

## Risk and rollback

- Risk: the advisory lane drifts into a fifth gate. Mitigation: prohibitions section names
  the invariant; `harness-rules.md` Rule 10 gate list is untouched.
- Risk: checkpoint triggers fire too broadly and burn tokens. Mitigation: three declared
  triggers, at most one call each, proven by the flag-off / flag-on slice test.
- Rollback: the feature is opt-in behind a flag. Removing the flag documentation, the agent
  files, and the wrapper blocks restores prior behavior; no schema or contract migration
  is involved.

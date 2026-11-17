---
phase: 3
title: "Agents: pins, tools, prompts"
status: done
priority: P1
effort: "3d"
dependencies: [1]
---

# Phase 3: Agents: pins, tools, prompts

## Context Links

- [Baseline and vendor sources](research/baseline-and-vendor-sources.md) — N1, N2, §3 rows Opus 5, Fable 5.2, Codex models, Cursor subagents
- `.claude/agents/*.md` (42 definitions), `kit/bundles/codex/root/.codex/agents/*.toml` (41), `kit/bundles/cursor/root/.cursor/agents/*.md` (41)
- `.claude/skills/agent-detector/references/model-selection-rules.md:36-39` (tier → model table)
- `docs/maintainer/model-pins.md` (written in Phase 1)
- `docs/research/meowkit-evolution-2611/05-skill-agent-rule-hook-audit.md` §5 and decision D-5

## Overview

- **Priority:** P1
- **Status:** Done (branch `integration/model-fit-audit`)
- **Effort:** 3d
- **Depends on:** Phase 1
- **Description:** Make each agent's model, tools and prompt fit its host: no retired model id, read-only agents read-only on every host, descriptions that say when delegation is worth it, and prompts without restated self-checks. One pull request across three trees.

## Decision: pin mapping (user, 2026-11-15)

Every bundle pin derives from the agent's Claude Code tier; one rule, no per-agent exceptions.

| Claude Code tier | Claude Code `model` | Codex `model` | Cursor `model` |
|---|---|---|---|
| haiku | `haiku` | `gpt-6-luna` | `composer-2.5[fast=true]` |
| sonnet | `sonnet` | `gpt-6.1-sol` | `composer-2.5[fast=true]` |
| opus (COMPLEX) | `opus` (was `claude-opus-5`) | `gpt-6-astra` | `claude-opus-5[effort=high]` |
| fable | `fable` | `gpt-6-astra` | `claude-fable-5` |

Sources: Codex models page and Cursor models page, opened 2026-11-15 (rows in `docs/maintainer/model-pins.md`). Caveat recorded for the release notes: Enterprise/Edu admins must enable `gpt-6-luna` before Codex can use it. Cursor point releases (Sonnet 5.5, Opus 5.5, Fable 5.2) are added only once their id form is confirmed on a Cursor page.

## Key Insights

- Codex: 13 agents pin `gpt-5.4-mini` (retired 2026-08-31) and 28 pin `gpt-5.6-sol`/`gpt-5.6-terra`, absent from the current Codex list (from: research/baseline-and-vendor-sources.md N1). A retired pin fails or falls back silently, so this is MECHANICAL.
- Claude Code pins `claude-opus-5` on 12 agents while the tier table names the same id; aliases (`sonnet`, `haiku`, `fable`) follow the newest model, the full id does not. Whether to move COMPLEX to an alias or to `claude-opus-5-5` is a user decision (cost vs reproducibility, audit D-5).
- Read-only intent: Cursor sets `readonly: true` on 10 agents; Codex sets `sandbox_mode = "read-only"` on 0, so `explore`, `athena` and the other read-only roles can write on Codex (measured 2026-11-15).
- Six Claude Code agents and six Codex agents say "use proactively"; Opus 5 and Fable 5.2 already delegate readily, and vendor guidance asks for stated delegation criteria instead (§3).
- Emphatic tokens: 32 in Claude Code agents, 30 in Codex TOML, 10 in Cursor agents.

## Requirements

### Functional
1. Every bundle agent `model` is a row in `model-pins.md`; the mapping (tier → id per runtime) is the user's choice, recorded with date and source.
2. Agents whose role is read-only are read-only on every host: Claude Code `disallowedTools: Write, Edit` (or no grant), Cursor `readonly: true`, Codex `sandbox_mode = "read-only"`.
3. Descriptions state when to delegate and when not ("for a wide multi-file search; not for a lookup a few tool calls settle"), replacing bare "use proactively".
4. Prompts drop restated re-verify and anti-laziness lines; keep input contract, output contract and the A1 status block.
5. Claude Code tier text in `model-selection-rules.md` equals the pins after the change (A7).

### Non-Functional
- Agent names, file names and the A1 status block shape stay; `mewkit validate --agents` and `validate --target codex` stay green.

## Architecture

```
model-pins.md (user-chosen mapping) → A13 checks every agent model
role table (read-only | writes) → per-host field: disallowedTools | readonly | sandbox_mode
.claude/agents/*.md edit → port to .codex/agents/*.toml and .cursor/agents/*.md
```

## Related Code Files

### Files to Create
- None

### Files to Modify
- `kit/bundles/codex/root/.codex/agents/*.toml` — `model`, `sandbox_mode`, `description`, `developer_instructions`
- `kit/bundles/cursor/root/.cursor/agents/*.md` — `model`, `description`, body
- `.claude/agents/*.md` — `model` (if the user picks a new mapping), `description`, body
- `.claude/skills/agent-detector/references/model-selection-rules.md` — tier table
- `docs/maintainer/model-pins.md` — chosen mapping

### Files to Read (Context)
- `crates/mewkit-core/src/validate/target_codex_agents.rs` — what Codex agent validation checks
- `crates/mewkit-adapters/` — whether the adapter rewrites `model` at install

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | `.codex/agents/*.toml` (41) | retired pins, read-only, prompts | `validate --target codex`, adapter goldens |
| Modify | `.cursor/agents/*.md` (41) | pins, descriptions | bundle checks |
| Modify | `.claude/agents/*.md` (42) | descriptions, prompts, pins if chosen | `validate --agents` |
| Modify | `model-selection-rules.md` | tier table | none |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Model id is current | none | A13 against `model-pins.md` | High |
| Read-only agents cannot write on Codex | none | check: role table vs `sandbox_mode` | High |
| Adapter output for agents | adapter goldens | hand-edit with `DIVERGENCES.md` row if output changes | Medium |

### Interface Checklist

- Agent `name` values (Codex identifies an agent by `name`, not file name).
- Codex TOML keys stay within the documented set (`name`, `description`, `developer_instructions`, `model`, `model_reasoning_effort`, `sandbox_mode`).

### Dependency Map

- Needs `model-pins.md` from Phase 1 and the user's mapping answer before edits start.

## Implementation Steps

1. Present the pin mapping options to the user (per runtime: alias/`inherit` vs current id) and record the answer in `model-pins.md`.
2. Build the role table (read-only vs writes) from the Claude Code definitions; apply the per-host read-only field.
3. Rewrite descriptions with delegation criteria; drop restated self-checks in bodies.
4. Update pins on all three trees and the tier table; port each Claude Code edit to the two bundles.
5. Run `mewkit validate --agents`, `validate --target codex`, checker A7/A9/A13, `cargo test --workspace --locked`; hand-edit any adapter golden with a `DIVERGENCES.md` row.

## Todo List

- [x] Pin mapping chosen by the user and recorded
- [x] Read-only role applied on Codex, Cursor and Claude Code
- [x] Descriptions carry delegation criteria
- [x] Restated self-checks removed from prompts
- [x] Pins and tier table updated; validators green

## Success Criteria

1. `grep -h '^model = ' kit/bundles/codex/root/.codex/agents/*.toml | grep -c gpt-5.4-mini` prints 0.
2. Checker A13 passes on all three trees.
3. Each agent in the read-only role has the host's read-only field (checker row or `rg` count equal to the role count on each tree).
4. `mewkit validate --agents` and `mewkit validate --target codex kit/bundles/codex/root` exit 0.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| New pins raise cost (smaller → larger model) | M | M | User picks mapping; tier counts stay; table shows cost class per row |
| `sandbox_mode = "read-only"` blocks an agent that writes reports | M | M | Role table lists every agent that writes a file (reviewer verdicts, PM reports) as writes |
| Alias moves to a model that behaves differently | L | M | Pin table dated; recheck at each release |

## Security Considerations

- Read-only on Codex closes a real write path for agents told they are read-only.

## Outcome (2026-11-15)

- Pins: Codex 41 agents (15 `gpt-6-luna`, 12 `gpt-6.1-sol`, 14 `gpt-6-astra`); Cursor 13 changed (now 27 `composer-2.5[fast=true]`, 12 `claude-opus-5[effort=high]`, 2 `claude-fable-5`); Claude Code 12 COMPLEX agents `claude-opus-5` → `opus`; tier table updated. A13 findings 41 → 0.
- Read-only role (no write tools, analysis job): `athena`, `brainstormer`, `explore`. Codex now sets `sandbox_mode = "read-only"` on all three; Cursor already had `readonly: true`; on Claude Code none has Write/Edit.
- "Use proactively" replaced in 9 descriptions and one Cursor body line with when to delegate and when to skip.
- No agent had a standing re-verify line; the Anti-Rationalization sections in evaluator, orchestrator, reviewer and tester are role contracts with reasons and stay.
- Not done: a mechanical check that read-only roles carry the host field (no role field exists to derive it from); verified by count instead.
- Decided 2026-11-15 (user: "Make them writable"): the 7 Cursor agents that write reports or plans on Claude Code (planner, reviewer, researcher, evaluator, jira-analyst, jira-estimator, jira-evaluator) now set `readonly: false`; planner and reviewer bodies no longer cite `readonly: true`. Cursor read-only set = athena, brainstormer, explore.

## Next Steps

- Phase 6 skill bodies stop naming agent syntax per host; Phase 7 measures pins and parity.

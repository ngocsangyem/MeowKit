---
title: "Every MeowKit skill, rule, hook and agent reads right to current models on Claude Code, Codex and Cursor"
type: refactor
status: done
priority: high
effort: xl
created: 261115
model: refactor-model
blockedBy: []
blocks: []
---

# Every MeowKit skill, rule, hook and agent reads right to current models on Claude Code, Codex and Cursor

## Goal

On all three runtimes, every shipped instruction file passes a published model-fit checklist whose mechanical part runs in CI, every hook message meant for the model reaches it in that host's form, and before/after numbers show the change.

## Context

- PR #53 removed the gates and rewrote gate text; it deferred the skill-body audit to this plan (from: `docs/plans/261115-remove-gates-audit-runtimes-coexistence/phase-03-gate-free-model-fit-instructions.md`).
- Vendor guidance for current models asks for plain instructions with reasons, no standing delegate/verify lines, tight trigger descriptions and progressive disclosure (from: research/baseline-and-vendor-sources.md §3).
- Re-measured: host-foreign syntax in 8 bundle skills, 407 bundle files call skills `mk:x`, Codex agent pins are retired ids, four observers print to a channel the model does not see (from: research/baseline-and-vendor-sources.md §1–2).
- The research audit graded only 9 of 128 skills as mechanically wrong; the rest is judgement without outcome data (from: `docs/research/meowkit-evolution-2611/05-skill-agent-rule-hook-audit.md` §6).

## Scope

- **In:** instruction text, frontmatter and hook messages in `.claude/`, `kit/bundles/codex/root/`, `kit/bundles/cursor/root/`; the criteria checker and a bundle parity check; model pins.
- **Out:** deleting or merging skills or agents, renaming Claude Code skill `name:` values, published JSON shapes (`gate1`/`gate2`), guard decisions, new hosts, an eval runner, live model runs unless approved.

## Phases

| # | Phase | Status | Effort | Depends On |
|---|-------|--------|--------|------------|
| 1 | [Criteria v2 and mechanical checks](phase-01-criteria-v2-and-mechanical-checks.md) | Done (24cf9b32) | 3d | — |
| 2 | [Always-on rules and AGENTS.md](phase-02-always-on-rules-and-agents-md.md) | Done | 2d | 1 |
| 3 | [Agents: pins, tools, prompts](phase-03-agents-pins-tools-prompts.md) | Done | 3d | 1 |
| 4 | [Hook feedback reaches the model](phase-04-hook-feedback-reaches-the-model.md) | Done (2b5d87ee) | 3d | 1 |
| 5 | [Skill descriptions and listing budget](phase-05-skill-descriptions-and-listing-budget.md) | Done (95c9d4d1) | 2.5d | 1 |
| 6 | [Skill bodies by cluster, three trees per PR](phase-06-skill-bodies-by-cluster.md) | Done | 10d | 2, 5 |
| 7 | [Bundle parity, after-measurement, close-out](phase-07-bundle-parity-measurement-close-out.md) | Done (PR pending) | 2d | 3, 4, 6 |

## Acceptance Criteria

- [x] `node scripts/check-instruction-criteria.cjs` exits 0 with criteria A1–A14 active on `.claude`, `kit/bundles/codex/root`, `kit/bundles/cursor/root`.
- [x] `docs/maintainer/instruction-audit-criteria.md` holds a before and an after table with every metric in Phase 1, per runtime.
- [x] No bundle file contains `subagent_type`, `TodoWrite`, `AskUserQuestion`, `.claude/` or a `mk:` skill reference (checker A9/A10). The one `subagent_type` left is a field of Cursor's hook payload, read by `subagent-lifecycle.cjs`.
- [x] Every Codex and Cursor agent `model` is in `docs/maintainer/model-pins.md`; no retired id remains.
- [x] Each of the four observers either returns host-visible feedback (replay case asserts it) or is retired with its consumers.
- [x] `npm test`, `npx vitest run tests/guards`, `cargo test --workspace --locked`, `mewkit validate` exit 0.
- [x] `test -d docs/plans/261115-model-fit-audit-three-runtimes && ! test -e tasks/plans/261115-model-fit-audit-three-runtimes`.

## Constraints

- Do NOT change `privacy-block`, the blocked-pattern table in `security-rules.md` or the numbered rules in `injection-rules.md` (hash-pinned).
- Always-on bytes may only shrink: Claude Code rules ≤ 18,500 B; each bundle's always-on set ≤ its Phase 1 baseline.
- Do NOT regenerate frozen golden recordings; hand-edit with a reason in `crates/mewkit-cli/tests/golden/DIVERGENCES.md`.
- Code comments and file names cite no plan phase or criterion code.
- Leave `tasks/` and `.meowkit/` without work artefacts; this plan moves to `docs/plans/` at the end.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Softer wording lowers compliance on smaller models (Haiku, Luna, Composer) | M | M | Absolutes stay on security and data-safety; optional smoke set on one small model per host when approved |
| Description rewrites change which skill triggers | M | H | Keep `NOT for` lines; routing fixture of labelled prompts checked offline against keywords; no skill hidden without OK |
| Three hand-kept trees drift during a 10-day sweep | H | M | Each cluster PR edits all three trees; Phase 7 parity check in CI |
| Model pins guessed from vendor pages go stale again | M | M | One pin table with source and date; checker reads it |

## Autonomy Boundaries

- **Always:** wording that passes the criteria; order of clusters; fixture names.
- **Ask first (each blocks its phase until answered):** model pin mapping per runtime (P3); listing targets and hidden-skill alignment (P5); `build-verify` visible or retired (P4); port or keep host-only skills (P6); live or paid model runs; deleting a skill, agent or hook handler; changing a `doctor --json` or adapter JSON shape.
- **Never:** see `.claude/rules/security-rules.md` and `injection-rules.md`.

## Agent State

Approved by the user 2026-11-15. All seven phases done on local branch `integration/model-fit-audit` (not pushed); every acceptance criterion verified 2026-11-17. Open: the integration PR to `main` (needs the user's go-ahead), 70 outline-drift entries in `scripts/bundle-parity-allow.json` to port, and the live routing and with/without evals (not run, need approval).

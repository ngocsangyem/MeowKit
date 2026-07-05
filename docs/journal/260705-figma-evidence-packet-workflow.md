# Journal — Figma Evidence Packet & Prototype-Flow Workflow

**Date:** 2026-07-05
**Plan:** `plans/260705-1358-meowkit-figma-evidence-packet-workflow/`
**ADR:** `docs/architecture/adr/260705-figma-evidence-packet.md`

## What shipped

A stable Figma-to-code evidence handoff wired through three existing skills — no new
user-facing skill (deferred behind a promotion gate):

- `mk:figma` — new `figma-evidence-packet.md` (versioned `figma-evidence-packet/v1`) +
  `prototype-flow-artifacts.md`; Mode 2 wording softened off "production-ready"; +3 gotchas;
  version 1.1.0→1.2.0.
- `mk:plan-creator` — new `design-evidence-consumption.md` (adjudication precedence,
  flow→validation-matrix, phase blocking); additive optional `blocked_on:` phase field with
  a WARN-only `validate-plan.py` check; step-03 + intake wiring; 1.6.2→1.6.3.
- `mk:visual-plan` — new offline `prototype-flow-template.html` explorer + reference;
  1.0.0→1.1.0.
- 4 synthetic eval fixtures (static / responsive / interaction-heavy / spec-conflict) as the
  schema oracle + checklist E8–E11.

## Decisions worth remembering

- **Prototype-flow extraction is not available via the Figma MCP.** A tool-contract spike
  found `get_metadata` = structure, `get_design_context` = code+screenshot, `get_motion_context`
  = keyframe **animation** (not navigation). None exposes reaction/navigation edges. So flow
  defaults to `user_supplied`; the explorer still renders user-supplied/inferred graphs, so
  Phase 5 shipped rather than being cut. Recorded in the plan's `research/prototype-flow-spike.md`
  and in `figma/references/official-docs-evidence.md`.
- **Blocking uses an additive `blocked_on:` field, not a new status.** The phase `status:`
  enum in `validate-plan.py` is fixed; adding a status value would break the parser. The
  validator check is WARN-only and cannot ever gate — verified by reading the errors-vs-warnings
  exit wiring.
- **Single-owner RACI enforced in prose.** figma records evidence and never decides;
  plan-creator adjudicates and never calls Figma MCP; visual-plan renders and never decides.
  The canonical precedence order lives in exactly one file.
- **Flow explorer is XSS-safe by construction** — every JSON string reaches the DOM via
  `textContent`; zero CDN; sentinel `vp-flow-explorer` + a self-check.

## Verification reality

The 4 fixture evals are **manual by design** (no automated runner). Deterministically verified
this session: schema consistency (fixture oracles == packet reference keys, 0 drift), validator
behavior, template JS/JSON validity + XSS-safety, line caps, zero plan-taxonomy refs in
`.claude/`, and `mewkit validate` introducing **no new failures** (3 fails pre-exist on clean
HEAD). Behavioral fresh-agent eval runs remain a documented manual step (`research/eval-run-260705.md`).

## Gotcha that bit

Edited a fixture during the final ownership audit **after** running `build-plugin`, leaving
`plugin/` stale for one file — caught by code review. Lesson: run `build-plugin` LAST, after
all `.claude/` edits settle. Never hand-edit `plugin/`.

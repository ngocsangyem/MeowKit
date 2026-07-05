# ADR: Figma Evidence Packet, Prototype-Flow Artifacts, and Rendered-Evidence Handoff

**Date:** 2026-07-05
**Status:** Accepted (phase 1)
**Deciders:** ngocsangyem (user), Claude (agent)
**Plan:** `plans/260705-1358-meowkit-figma-evidence-packet-workflow/`
**Full ADR:** `plans/reports/260705-1147-meowkit-figma-ui-architecture-adr.md`

## Context

Reliable Figma-to-code needs Figma design intent reconciled with rendered browser
evidence. A prior proposal added a new user-facing coordinator skill (`mk:ui-from-figma`).
A council review found the missing primitive is not another skill but a **stable evidence
handoff contract** — and that a new door before that contract is stable risks a pleasant
command wrapping an ambiguous, duplicated, or stale workflow. A follow-up review added a
second gap: a screen can render pixel-correct while its navigation/flow is wrong.

## Decision

Add a versioned **Figma Evidence Packet** and wire it through existing skills — no new
skill in phase 1.

- `mk:figma` is the single owner of Figma interpretation: emits a `figma-evidence-packet/v1`
  (provenance, node IDs, tokens, states, validation contract, risks) and, when interactions
  exist or a user supplies a flow, hybrid prototype-flow artifacts (`prototype-flow.json`
  + report). It records evidence only — no planning decisions.
- `mk:plan-creator` consumes the packet through its existing intake mechanism (never calls
  Figma MCP, never re-parses raw Figma): derives viewport/state acceptance criteria and a
  critical-action validation matrix, adjudicates flow conflicts by a fixed precedence, and
  blocks only affected phases via a new additive optional `blocked_on:` phase-frontmatter
  field (the `status:` enum is unchanged).
- `mk:visual-plan` optionally renders a separate, offline `prototype-flow.html` flow explorer
  from the JSON when `--html` is requested; `plan.html` is unaffected.
- `mk:agent-browser` gathers exploratory rendered evidence; `mk:playwright-cli` /
  `mk:qa-manual` provide deterministic proof. Every capability has exactly one accountable
  owner.

Raw screenshots/DOM/traces are referenced as artifact paths under
`tasks/plans/<active-plan>/research/` (or `tasks/reports/` for standalone), never pasted
into working context.

## Alternatives Rejected

- **New `mk:ui-from-figma` coordinator now** — deferred behind a promotion gate; premature
  UX wrapper around an unproven contract. Promote only after fixture evals show repeated
  discovery/handoff failures.
- **plan-creator analyzes raw Figma** — rejected; duplicates interpretation, violates the
  single-owner boundary.
- **Generic design-source adapter layer** — deferred until ≥2 validated non-Figma sources.
- **A new phase `status:` value for blocking** — rejected; the validator's status enum is
  fixed. Blocking is expressed via the additive `blocked_on:` field instead.

## Consequences

- Lower maintenance than a new skill; clear handoff boundaries; traceable, versionable
  evidence; inferred flow becomes reviewable instead of hidden.
- The user-facing route is less obvious than a dedicated command (accepted trade-off).
- `mk:figma` Mode 2 no longer claims standalone "production-ready" output — production
  claims require the packet → plan → browser → deterministic-checks handoff.
- Prototype-flow extraction is feasibility-limited: a tool-contract spike found the Figma
  MCP exposes no generic reaction/navigation metadata, so flow defaults to
  `unavailable | user_supplied`; the explorer still renders user-supplied/inferred graphs.

## Fitness / Promotion Baseline

Four synthetic fixtures (static, responsive, interaction-heavy, spec-conflict) under
`.claude/skills/figma/evals/fixtures/` are the eval basis. A future `mk:ui-from-figma` is
promoted only if evals show repeated wrong-skill invocation or handoff misses.

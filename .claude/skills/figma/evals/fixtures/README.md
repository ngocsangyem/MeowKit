# Figma Evidence Packet — Eval Fixtures

Synthetic, internal fixtures for the Figma Evidence Packet + prototype-flow workflow.
Reproducible, permission-safe, no customer data, no external changing Figma files.

Each fixture directory contains:

- `design-snapshot.md` — frame descriptions, node IDs, tokens, states. Stands in for a
  live Figma file when no MCP/Figma access is available.
- `reference.png` — exported baseline. **Placeholder in v1** (a 1×1 PNG). Visual-parity
  assertions are weak until a real baseline (or controlled Figma mirror) replaces it.
- `expected-packet.yaml` — the Figma Evidence Packet fields `mk:figma` must emit for this
  fixture. This file is the **schema oracle**: the packet reference and later phases must
  match these field sets.
- `expected-plan-assertions.md` — what a plan built from the packet must contain
  (viewport/state acceptance criteria, validation-matrix items, phase `blocked_on:` entries).

## Fixtures

| Fixture | Scenario | Prototype flow | Purpose |
|---|---|---|---|
| `static-card` | static card/list screen | none | baseline packet, single viewport, default state only |
| `responsive-grid` | responsive dashboard grid | none | viewport matrix (desktop/tablet/mobile) |
| `interaction-modal` | menu/modal/form states | extracted + inferred | flow artifacts, critical-action validation matrix |
| `spec-conflict` | prototype vs route vs spec | conflict | decision-ledger row + phase-level `blocked_on:` |

## Path convention

All artifact paths use the MeowKit `tasks/` convention:

- active plan → `tasks/plans/<active-plan>/research/`
- standalone → `tasks/reports/`

## Running

Manual evals — no automated runner. See `../../references/eval-checklist.md` scenarios
E8–E11. For each: give the fixture's `design-snapshot.md` to a fresh agent with `mk:figma`
loaded, have it emit a packet, then diff against `expected-packet.yaml`; feed the packet to
`mk:plan-creator` and diff the plan against `expected-plan-assertions.md`.

# Expected Plan Assertions — responsive-grid

What a plan built by `mk:plan-creator` from this fixture's packet MUST contain. Binary
checks. Built FROM the packet path — no Figma MCP call.

## Assertions

- [ ] Plan cites packet fields in Key Insights (responsive grid, StatCard reuse).
- [ ] Zero Figma MCP tool calls during planning (packet-only).
- [ ] Acceptance criteria include ALL THREE viewports: desktop (1440), tablet (834),
      mobile (390), each with the `default` state.
- [ ] Grid column/gutter behavior per viewport is an explicit AC (4/2/1 columns).
- [ ] No prototype-flow phase, no validation-matrix items (`critical_actions_count: 0`).
- [ ] No `blocked_on:` on any phase.
- [ ] Delta-chip sign conveyed by text/icon + color (a11y note carried from packet).

## Validation matrix

- Empty — no critical actions. Viewport coverage is expressed as viewport ACs, not
  flow-derived validation items.

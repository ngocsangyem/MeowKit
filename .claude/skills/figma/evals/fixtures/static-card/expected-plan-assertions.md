# Expected Plan Assertions — static-card

What a plan built by `mk:plan-creator` from this fixture's packet MUST contain. Binary
checks. The plan is built FROM the packet path — no Figma MCP call.

## Assertions

- [ ] Plan cites packet fields in Key Insights (hierarchy, tokens) — references the packet
      path, does not paste raw Figma JSON.
- [ ] Zero Figma MCP tool calls during planning (packet-only).
- [ ] Acceptance criteria include the `default` state at the `desktop` viewport.
- [ ] No viewport ACs for tablet/mobile (packet lists desktop only) — no invented viewports.
- [ ] No prototype-flow phase, no validation-matrix items (packet `critical_actions_count: 0`).
- [ ] No `blocked_on:` on any phase (no high-risk flow ambiguity).
- [ ] `missing_states` risk (no hover/focus) surfaced as a note or WARN, not silently filled.

## Validation matrix

- Empty — no critical actions.

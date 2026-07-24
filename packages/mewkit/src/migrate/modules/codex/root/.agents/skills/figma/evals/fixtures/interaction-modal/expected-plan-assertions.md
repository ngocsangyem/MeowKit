# Expected Plan Assertions — interaction-modal

What a plan built by `mk:plan-creator` from this fixture's packet + flow artifacts MUST
contain. Binary checks. Built FROM the packet — no Figma MCP call.

## Assertions

- [ ] Plan cites packet + `prototype-flow.json` path in Key Insights.
- [ ] Zero Figma MCP tool calls during planning (packet-only).
- [ ] State ACs cover every explicit state: default, hover, focus, disabled, loading, error,
      open (modal). No invented states.
- [ ] `Invite → open modal` (extracted, low/medium risk) may proceed without a block.
- [ ] `Submit → success` is a **critical action** (server mutation) → generates a
      validation-matrix item AND is marked `blocked_on:` on the invite-flow phase (outcome
      not wired in prototype = high-risk ambiguity).
- [ ] Exactly the invite-flow phase carries `blocked_on:`; other phases (e.g. static
      members table) are NOT blocked.
- [ ] Gate 1 can still approve the plan (ambiguity is explicit) — block is phase-scoped.
- [ ] Browser-evidence task routed to `mk:agent-browser`; deterministic checks to
      `mk:playwright-cli` / `mk:qa-manual` (not merged into one owner).

## Validation matrix (critical actions only)

| id | action | viewport | state | expected | owner |
|----|--------|----------|-------|----------|-------|
| V1 | Invite submit | desktop | loading→success | modal shows loading, then success outcome (once resolved) | playwright-cli |
| V2 | Email validation | desktop | error | invalid email blocks submit, shows error state | playwright-cli |

- Trivial visual transitions (hover) do NOT get mandatory validation items.

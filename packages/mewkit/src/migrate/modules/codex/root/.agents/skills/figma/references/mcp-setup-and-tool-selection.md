# MCP Setup and Tool Selection

How to set up the Figma MCP server, verify connectivity, choose the right tool, and fall back when MCP
is unavailable. Support file — load during the prerequisite check or when the tool choice is unclear.

## Contents

- [Setup (user-approved only)](#setup-user-approved-only)
- [Connectivity check](#connectivity-check)
- [Tool decision flow](#tool-decision-flow)
- [MCP tool naming](#mcp-tool-naming)
- [Rate limits](#rate-limits)
- [Fallback chain](#fallback-chain)

## Setup (user-approved only)

Installing or configuring an MCP server changes the user's environment — never auto-run it.

- Surface the command to the user; let them run it: `codex mcp add figma`.
- Do not configure servers, tokens, or credentials on the user's behalf.

## Connectivity check

Before any operation, verify the Figma MCP server responds using its cheapest read tool.

- UNCERTAIN: the exact probe tool varies by Figma MCP server version. Verify against the live server's
  tool list at implementation time and use its lightest read call. Do NOT invent a tool name (e.g.
  "list recent files") that the server may not expose.
- If the probe errors or times out → treat MCP as unavailable and use the fallback chain.

## Tool decision flow

1. `get_design_context` — default for reading a node's structure, styles, and layout.
2. `get_metadata` — when `get_design_context` is truncated or oversized; then fetch needed children individually.
3. `get_screenshot` — for visual ground truth / parity comparison (request `scale: 2` for retina).
4. Variable / design-system search tools (e.g. `search_design_system`) — for token and design-system work.

## MCP tool naming

When multiple MCP servers are connected, use fully-qualified tool names to avoid "tool not found":
`ServerName:tool_name` (for example, `Figma:get_design_context`). Confirm the server name against the
live server list before qualifying.

## Rate limits

- Batch ≤15 nodes per `get_design_context` call; ~20+ reliably triggers 429 (observed heuristic, not an
  official limit).
- On 429: exponential backoff 1s → 2s → 4s.

## Fallback chain

MCP absent or unresponsive:

1. Ask the user to export the target frame/screen as a PNG from Figma.
2. Analyze the PNG via `mk:multimodal` (or Codex Read for simple cases).
3. Note reduced fidelity: exact spacing/variables are unavailable from a raster image; treat values as approximate.

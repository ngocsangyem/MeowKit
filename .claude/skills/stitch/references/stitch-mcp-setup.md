# Stitch MCP Server Setup

Optional: connect Stitch as an MCP server for native design context in Claude Code.
The `mk:stitch` skill works without MCP (via the `npx tsx` scripts). MCP is opt-in.

Connect with an API key. The server package name below was not verified here; if it does not resolve, use the Stitch MCP server your host or Stitch's own docs name.

## API-key setup

### 1. Get API Key

1. Sign in at https://stitch.withgoogle.com
2. Go to Settings → API Keys
3. Click "Generate New Key"
4. Copy the `sk_...` key

### 2. Add to your MCP config (`.mcp.json` at the project root on Claude Code)

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_API_KEY": "${STITCH_API_KEY}"
      }
    }
  }
}
```

Use `${STITCH_API_KEY}` (env-var reference) — never paste the raw key into config.
With the env-var reference the file holds no secret. A file with a raw key in it must not be committed.

### 3. Verify

Restart the host. Stitch tools should appear:
- `create_project` — Create new design project
- `generate_screen` — Generate UI from prompt
- `export_html` — Export as HTML/Tailwind
- `export_image` — Export screenshot

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `AUTH_FAILED` on startup | Verify the API key |
| Tools not appearing | Restart the host after config change |
| Timeout on generation | Stitch is processing; wait 10–30s for complex designs |
| `RATE_LIMITED` errors | Daily quota exceeded; wait until midnight UTC |

## MCP Config Location

For Claude Code CLI (per-project): `.mcp.json` in the project root.

For Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS).

The kit's `mcp.json.example` has a template for common MCP servers.

# Stitch MCP Server Setup

Optional: connect Stitch as an MCP server for native design context in Codex.
The `mk:stitch` skill works without MCP (via the `npx tsx` scripts). MCP is opt-in.

Three options for connecting.

## Option A: API Key (Recommended)

Simplest setup. No Google Cloud dependency.

### 1. Get API Key

1. Sign in at https://stitch.withgoogle.com
2. Go to Settings → API Keys
3. Click "Generate New Key"
4. Copy the `sk_...` key

### 2. Add to `.codex/.mcp.json`

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
`.codex/.mcp.json` is covered by the kit's `.gitignore`; do not commit it.

### 3. Verify

Restart Codex. Stitch tools should appear:
- `create_project` — Create new design project
- `generate_screen` — Generate UI from prompt
- `export_html` — Export as HTML/Tailwind
- `export_image` — Export screenshot

## Option B: Google Cloud

Uses gcloud credentials. Zero API key management.

### 1. Setup gcloud

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud beta services mcp enable stitch.googleapis.com
```

### 2. Add to `.codex/.mcp.json`

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["-y", "stitch-mcp"],
      "env": {
        "GOOGLE_CLOUD_PROJECT": "your-gcp-project-id"
      }
    }
  }
}
```

## Option C: Auto-Installer (Interactive)

```bash
npx stitch-mcp-auto
# Opens browser at http://localhost:8086
# Follow wizard to configure
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `AUTH_FAILED` on startup | Verify API key or re-run `gcloud auth login` |
| Tools not appearing | Restart Codex after config change |
| Timeout on generation | Stitch is processing; wait 10–30s for complex designs |
| `RATE_LIMITED` errors | Daily quota exceeded; wait until midnight UTC |

## MCP Config Location

For Codex CLI (per-project): `.codex/.mcp.json` in the project root.

For Codex Desktop: `~/Library/Application Support/Codex/codex_desktop_config.json` (macOS).

The kit's `mcp.json.example` has a template for common MCP servers.

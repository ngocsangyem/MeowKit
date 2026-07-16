# Stitch Setup

Get an API key from `https://stitch.withgoogle.com` → Settings → API Keys and set:

```env
STITCH_API_KEY=<your-stitch-api-key>
STITCH_PROJECT_ID=<optional-default-project-id>
STITCH_QUOTA_LIMIT=400
```

The env hook loads `.claude/.env`; never hardcode the key. Install the local scripts with
`cd .claude/skills/stitch/scripts && npm install`. `tsx` comes from `scripts/package.json`.

For native Stitch design context in a host runtime, load
[stitch-mcp-setup.md](stitch-mcp-setup.md).

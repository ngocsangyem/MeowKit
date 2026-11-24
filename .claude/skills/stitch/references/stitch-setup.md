# Stitch Setup

Get an API key from `https://stitch.withgoogle.com` → Settings → API Keys and set:

```env
STITCH_API_KEY=<your-stitch-api-key>
STITCH_PROJECT_ID=<optional-default-project-id>
STITCH_QUOTA_LIMIT=400
```

Put them in the project's `.meowkit/.env`, or in `~/.meowkit/.env` for every project; a shell export wins over both. `stitch-api-call.ts` reads those files itself. `stitch-quota.ts` reads only the shell, so export `STITCH_QUOTA_LIMIT` if you change the limit. Never hardcode the key. Install the local scripts with
`cd scripts && npm install`. `tsx` comes from `scripts/package.json`.

For native Stitch design context in a host runtime, load
[stitch-mcp-setup.md](stitch-mcp-setup.md).

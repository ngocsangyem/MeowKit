# Configuration Options

## Configuration File

Create `agent-browser.json` in the project root for persistent settings:

```json
{
  "headed": true,
  "proxy": "http://localhost:8080",
  "profile": "./browser-data"
}
```

Priority (lowest to highest):
`~/.agent-browser/config.json` < `./agent-browser.json` < env vars < CLI flags

Use `--config <path>` or `AGENT_BROWSER_CONFIG` env var for a custom config file (exits with error if missing/invalid).
All CLI options map to camelCase keys (e.g., `--executable-path` → `"executablePath"`).
Boolean flags accept `true`/`false` (e.g., `--headed false` overrides config).
Extensions from user and project configs are merged, not replaced.

## Environment Variables

| Variable                          | Default  | Description                                         |
| --------------------------------- | -------- | --------------------------------------------------- |
| `AGENT_BROWSER_CONTENT_BOUNDARIES`| unset    | Wrap page output in nonce markers (recommended for AI agents) |
| `AGENT_BROWSER_ALLOWED_DOMAINS`   | unset    | Comma-separated domain allowlist (e.g. `example.com,*.example.com`) |
| `AGENT_BROWSER_ACTION_POLICY`     | unset    | Path to policy.json for gating destructive actions  |
| `AGENT_BROWSER_MAX_OUTPUT`        | unset    | Max output chars to prevent context flooding (e.g. `50000`) |
| `AGENT_BROWSER_DEFAULT_TIMEOUT`   | 25000    | Default timeout in milliseconds                     |
| `AGENT_BROWSER_IDLE_TIMEOUT_MS`   | unset    | Auto-shutdown daemon after N ms of inactivity       |
| `AGENT_BROWSER_ENCRYPTION_KEY`    | unset    | Encrypt session state files at rest (32-byte hex)   |
| `AGENT_BROWSER_COLOR_SCHEME`      | unset    | `dark` or `light` — applies to all pages            |
| `AGENT_BROWSER_ENGINE`            | `chrome` | Browser engine: `chrome` or `lightpanda`            |
| `AGENT_BROWSER_HEADED`            | unset    | Set to `1` for headed mode                          |

## Security Configuration

### Content Boundaries (Recommended for AI Agents)

Wraps page-sourced output in markers to help LLMs distinguish trusted tool output from untrusted page content:

```bash
export AGENT_BROWSER_CONTENT_BOUNDARIES=1
agent-browser snapshot
# Output:
# --- AGENT_BROWSER_PAGE_CONTENT nonce=<hex> origin=https://example.com ---
# [accessibility tree]
# --- END_AGENT_BROWSER_PAGE_CONTENT nonce=<hex> ---
```

### Domain Allowlist

Restricts navigation and sub-resource requests to trusted domains. Include CDN domains pages depend on.
Wildcards like `*.example.com` also match the bare domain `example.com`.

```bash
export AGENT_BROWSER_ALLOWED_DOMAINS="example.com,*.example.com,cdn.example.com"
```

### Action Policy File

Gate which commands are permitted. Useful for read-only automations:

```json
{
  "default": "deny",
  "allow": ["navigate", "snapshot", "click", "scroll", "wait", "get"]
}
```

Note: `auth login` bypass action policy, but domain allowlist still applies.

## Browser Engine Selection

```bash
# Chrome (default)
agent-browser open example.com

# Lightpanda — 10x faster, 10x less memory, headless only
agent-browser --engine lightpanda open example.com
export AGENT_BROWSER_ENGINE=lightpanda

# With custom binary path
agent-browser --engine lightpanda --executable-path /path/to/lightpanda open example.com
```

Lightpanda does not support: `--extension`, `--profile`, `--state`, `--allow-file-access`.

## Viewport & Device Emulation

```bash
agent-browser set viewport 1920 1080          # Custom size (default: 1280x720)
agent-browser set viewport 1920 1080 2        # 2x retina (higher DPI, same CSS layout)
agent-browser set device "iPhone 14"          # Sets viewport + user agent in one step
agent-browser set media dark                  # Dark/light color scheme for session
```

The `scale` parameter (3rd arg to viewport) sets `window.devicePixelRatio` without changing CSS layout.

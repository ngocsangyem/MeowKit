# Auth Resolution Chain

One resolution chain, shared by CLI and MCP-stdio. MCP-HTTP and MCP-SSE use bearer tokens at the transport layer; tool handlers may still pull per-request values from this chain.

## Contents

- [Resolution chain (first hit wins)](#resolution-chain-first-hit-wins)
- [Config file shape](#config-file-shape)
- [`login` and `logout`](#login-and-logout)
- [Redaction](#redaction)
- [Precedence rules](#precedence-rules)
- [MCP-HTTP / MCP-SSE context](#mcp-http-mcp-sse-context)
- [Anti-patterns](#anti-patterns)
- [Gotchas](#gotchas)


Load this reference during Phase 4 (Challenge) and reference in Phase 5 (Transformation Spec) when credentials decisions land.

## Resolution chain (first hit wins)

1. **Explicit flag** — `--api-key <v>`, `--token <v>`. Never logged, never echoed to stdout
2. **Process env var** — convention: `<TOOL>_<KEY>` (e.g. `ACME_API_KEY`)
3. **dotenv files**, in order:
   - `.env.local` (git-ignored, highest priority)
   - `.env.<NODE_ENV>` (e.g. `.env.production`)
   - `.env`
   Search starts at CWD and walks up to the nearest package root or repo root. Do not walk past the repo root.
4. **User config JSON:**
   - Linux/macOS: `$XDG_CONFIG_HOME/<tool>/config.json` or `~/.config/<tool>/config.json`
   - Windows: `%APPDATA%\<tool>\config.json`
5. **Project config JSON:** `./.<tool>rc.json` or `./<tool>.config.json` in CWD
6. **OS keychain** via `keytar` — stored by the `login` command:
   - macOS Keychain, Windows Credential Vault, libsecret on Linux
   - Service name: `<tool>`, account = profile name

Every resolved value must record its layer for `doctor` output (without revealing the value).

## Config file shape

```json
{
  "$schema": "https://<tool>.dev/schema/config.json",
  "profiles": {
    "default": {
      "apiKey": "env:ACME_API_KEY",
      "baseUrl": "https://api.acme.dev",
      "timeoutMs": 30000
    },
    "staging": {
      "apiKey": "keychain:acme/staging",
      "baseUrl": "https://staging.api.acme.dev"
    }
  },
  "activeProfile": "default"
}
```

Indirection tokens:

- `env:NAME` — read from process env
- `keychain:<service>/<account>` — read from OS keychain
- `file:/absolute/path` — read file contents (mounted secrets)
- plain string — literal value

## `login` and `logout`

```
<tool> login  [--profile <name>]
<tool> logout [--profile <name>]
```

`login` prompts interactively, writes to OS keychain, updates `activeProfile`. Never writes the value to a plaintext config file unless the user passes `--save-plaintext` (explicit, discouraged, warn loudly).

## Redaction

- Log redactor masks entropy strings, `*key*`, `*token*`, `Authorization:` headers
- `doctor` JSON output:

```json
{
  "apiKey":  { "resolved": true, "source": "keychain:acme/default" },
  "baseUrl": { "resolved": true, "source": "config:~/.config/acme/config.json", "value": "https://api.acme.dev" }
}
```

Sensitive entries have `resolved` + `source` but **never** `value`. Non-sensitive config keys may include `value`.

## Precedence rules

- A value at a higher layer **fully overrides** lower layers (no per-field merging for scalars)
- Structured config objects merge shallowly — later layers replace keys they define
- `--profile <name>` selects the profile before resolution runs; env-only values still win over profile values

## MCP-HTTP / MCP-SSE context

Transport auth handler builds `ctx.auth` per request. Inside tool handlers:

```ts
const resolved = await resolveAuth({ token: ctx.auth.token, profile: ctx.auth.profile });
```

`resolveAuth` uses the same chain, but **layer 1** becomes the transport-supplied token (not a CLI flag). **Layer 6** (keychain) is **disabled** in non-local deployments — keychain access from a Worker or container is a misconfiguration.

## Anti-patterns

- Storing API keys in plain JSON config by default
- Logging full request or response bodies
- `postinstall` scripts that touch the keychain (breaks unattended installs)
- Baking secret values into Docker images (they live forever in image history)
- Reading `.env` from unbounded parent directories (scope to package or repo root)

## Gotchas

- **Redaction regexes are easy to get wrong.** Test with real keys — a redactor that matches `apiKey=` but misses `api-key:` leaks on half your logs. Ship a `doctor --test-redaction` subcommand so users can verify coverage.
- **Keychain is OS-specific and fails silently in CI.** Always short-circuit keychain access when `CI=true` or `NO_KEYCHAIN=1`; the CLI should resolve only from env in those contexts.
- **Profiles multiply the testing surface.** Pick one: single-profile simple, or multi-profile with explicit `--profile` selection on every mutating command. Half-supported profiles are worse than either extreme.
- **`--save-plaintext` needs a confirmation prompt, not just a flag.** Silent plaintext writes are how secrets end up in `git diff`.
- **Rotate with two active tokens.** During rotation, accept both `MCP_TOKEN` and `MCP_TOKEN_PREV`. Single-token rotation causes downtime and users will just leak the old token to force it to work.
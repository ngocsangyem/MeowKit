# mk:confluence — Install & Auth

One-time setup for the Confluence skill family. Cloud only.

## Required env vars

Add three lines to `.claude/.env` (chmod 0600 recommended):

```
MEOW_CONFLUENCE_SITE_URL=https://your-tenant.atlassian.net
MEOW_CONFLUENCE_EMAIL=your-email@example.com
MEOW_CONFLUENCE_API_TOKEN=your-api-token
```

Get an API token at https://id.atlassian.com/manage-profile/security/api-tokens (Atlassian Cloud login required).

The wrapper translates these to `CONFLUENCE_*` at exec time and refuses to load credentials from `.claude/settings.local.json` even if present (security override of upstream default behavior).

## Install

`.claude/scripts/bin/setup-workflow` auto-installs from `.agents/skills/confluence/scripts/requirements.txt`:

- `confluence-assistant-skills==0.2.0` — distribution package; ships the `confluence-as` binary
- `assistant-skills-lib==1.0.1` — transitive infra dep

Verify: `ls .agents/skills/.venv/bin/ | grep confluence-as`

## Binary name

The CLI binary is `confluence-as`. Both upstream READMEs (`confluence-as` and `Confluence-Assistant-Skills`) document it as `confluence` — they are wrong. Empirical install (260510) is the ground truth. Re-verify on every version bump.

## Cloud-only constraint

The wrapper exits 3 if `MEOW_CONFLUENCE_SITE_URL` does not end in `.atlassian.net`. Server / Data Center deployments are out of scope.

**Escape hatch for Server/DC users:** install the MCP Atlassian server (`@sooperset/mcp-atlassian`) and call its Confluence tools directly via your host-runtime MCP config. The `mk:confluence-*` skills do NOT auto-fallback.

## Wrapper exit codes

| Code | Meaning |
| ---- | ------- |
| 0    | Success |
| 1    | Sanitizer rejection (CQL) |
| 2    | Plaintext credential fallback detected — move to `.claude/.env` |
| 3    | Non-Cloud URL — Server/DC not supported |
| 127  | `confluence-as` binary not installed — run `.claude/scripts/bin/setup-workflow` |
| 4-7  | confluence-as runtime errors (network, auth, validation, server) |
| 130  | SIGINT |

## Stdout filter mode

The wrapper has an optional `MEOW_CONFLUENCE_STDOUT_FILTER` knob:

- `off` (default) — pass through raw output
- `trim-tail` — strip the trailing line and validate JSON; use only after `smoke-live.sh` confirms the upstream `print_success` writes to stdout (not stderr)

Run `bash .agents/skills/confluence/scripts/smoke-live.sh` once to determine which mode applies for your installed version.

## Gotchas

- `confluence-as` package on PyPI does NOT exist — install `confluence-assistant-skills` instead.
- Both upstream READMEs name the binary `confluence`; the actual binary is `confluence-as`.
- ADF roundtrip in confluence-as is lossy on panel / expand / mention / emoji / media / decision / task-list nodes.
- POST is in retry `allowed_methods` upstream (`confluence_client.py:135-144`) — create ops on flaky network may produce duplicates. Verify before retrying.
- `--quiet` global flag is declared but unimplemented upstream (`main.py:44-74`) — don't rely on it.
- `_escape_cql_string` is a private function in upstream's `search_cmds.py`, not exported. Use `cql-sanitize.sh` for any user-derived CQL.

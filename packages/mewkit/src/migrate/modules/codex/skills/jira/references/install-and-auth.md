# mk:jira — Install & Auth

This file is the canonical setup reference for `mk:jira` and the 16 `mk:jira-*` leaves.

## Canonical install

```
.claude/scripts/bin/setup-workflow
```

This triggers `packages/cli/src/core/dependency-installer.ts` to read every per-skill `requirements.txt` (discovered by `skills-dependencies.ts:findRequirementsFiles()`) and `pip install` into `.agents/skills/.venv`. The jira-as binary lands at:

```
.agents/skills/.venv/bin/jira-as
```

## Manual fallback

```
.agents/skills/.venv/bin/pip install jira-as 'jira-as[keyring]'
```

Use only if `.claude/scripts/bin/setup-workflow` is unavailable. The wrapper resolves to the venv-local binary; do NOT rely on global PATH.

## Authentication — three required env vars

In `.claude/.env` (gitignored):

| Var | Purpose |
|---|---|
| `MEOW_JIRA_API_TOKEN` | Atlassian Cloud API token. Get from https://id.atlassian.com/manage-profile/security/api-tokens |
| `MEOW_JIRA_EMAIL` | Atlassian account email |
| `MEOW_JIRA_SITE_URL` | e.g. `https://your-company.atlassian.net` |

The wrapper `.agents/skills/jira/scripts/jira-as.sh` translates these to jira-as's native `JIRA_API_TOKEN`, `JIRA_EMAIL`, `JIRA_SITE_URL` and exports `JIRA_OUTPUT=json` as the default.

The legacy `MEOW_*` prefix (vs. modern `MEOWKIT_*`) is a deliberate exception per migration directive.

## Hook validation

A `SessionStart` hook (`.codex/hooks/jira-env-loader.sh`) validates `.claude/.env` presence and the 3 keys. It does NOT export anything — each hook runs in its own subprocess, so propagation is impossible. The wrapper handles per-call sourcing/export.

Status messages:
- `[mk:jira] env OK` — all 3 keys present
- `[mk:jira] <KEY> missing in .claude/.env` — specific key absent
- `[mk:jira] .claude/.env missing — see .claude/.env.example for setup`

## `JIRA_PROFILE` clarification

The upstream `JIRA-Assistant-Skills` README mentions a `JIRA_PROFILE` env var. That is a concern of the broader Assistant Skills plugin layer (multi-account profile selection) and is NOT consumed by `jira-as` itself or by `mk:jira`. Ignore it. Single-tenant only here.

## Exit codes (jira-as → user message map)

| Code | Class | User-actionable message |
|---|---|---|
| 0 | OK | (silent success) |
| 1 | Validation | "jira-as: invalid arguments — see `jira-as <group> <verb> --help`" |
| 2 | Auth | "jira-as: authentication failed — re-check `MEOW_JIRA_API_TOKEN` in .claude/.env" |
| 3 | Permission | "jira-as: permission denied — your account lacks the required Jira permission for this op" |
| 4 | Not found | "jira-as: resource not found — confirm issue key / project key / board ID exists" |
| 5 | Rate limit | "jira-as: rate limited by Atlassian — back off and retry" |
| 6 | Conflict | "jira-as: conflict — concurrent edit or stale state; refresh and retry" |
| 7 | Server | "jira-as: Atlassian server error — try again, then escalate to Atlassian Status if persistent" |
| 130 | Interrupt | "jira-as: interrupted (Ctrl+C)" |

## DC PAT / mTLS — Tier 2 escape hatch (documented only)

- DC PAT: untested with `jira-as`. Try at your own risk.
- mTLS: NOT supported by `jira-as` directly. If your org requires mTLS (e.g. behind a corporate proxy), use the Atlassian MCP integration directly per the upstream README — there is no auto-fallback shim in mk:jira.

## Wrapper smoke test

```
bash the project environment/.agents/skills/jira/scripts/jira-as.sh --version
```

Expected: prints version, exits 0. With env missing, errors with `:?` parameter-expansion hint pointing at `.claude/.env.example`.

## Troubleshooting

- **`jira-as not installed at <path>`** — run `.claude/scripts/bin/setup-workflow` (or use the manual fallback).
- **`MEOW_JIRA_API_TOKEN missing`** — copy `.claude/.env.example` to `.claude/.env` and fill the three vars.
- **Wrapper works but hook says "missing"** — hook validates presence-only via grep; an empty value passes the grep but fails at the `:?` expansion. Set actual values.

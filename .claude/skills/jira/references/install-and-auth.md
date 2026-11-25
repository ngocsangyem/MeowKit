# mk:jira — Install & Auth

This file is the canonical setup reference for `mk:jira` and the 16 `mk:jira-*` leaves.

## Canonical install

```
mewkit skill env jira
```

This reads THIS skill's `scripts/requirements.txt` and nothing else, and installs into this skill's own environment. The jira-as binary lands at:

```
.meowkit/envs/jira/bin/jira-as
```

## Manual fallback

```
.meowkit/envs/jira/bin/pip install 'jira-as==2.1.0' 'jira-as[keyring]==2.1.0'
```

Use only if `mewkit skill env jira` is unavailable. The wrapper resolves to the venv-local binary; do NOT rely on global PATH.

## Authentication — three required env vars

In `.meowkit/.env` (gitignored), or in `~/.meowkit/.env` to share them across projects. Keep all three in the same file: the wrapper refuses (exit 78) when they come from different files, naming both, so a project file that sets only a site URL cannot receive the user-wide token. A shell export wins over every file and is not part of that check; otherwise the first file that sets the keys — project `.meowkit/.env`, then the older runtime-folder env file, then `~/.meowkit/.env` — supplies them:

| Var | Purpose |
|---|---|
| `MEOW_JIRA_API_TOKEN` | Atlassian Cloud API token. Get from https://id.atlassian.com/manage-profile/security/api-tokens |
| `MEOW_JIRA_EMAIL` | Atlassian account email |
| `MEOW_JIRA_SITE_URL` | e.g. `https://your-company.atlassian.net` |

The wrapper `scripts/jira-as.sh` translates these to jira-as's native `JIRA_API_TOKEN`, `JIRA_EMAIL`, `JIRA_SITE_URL` and exports `JIRA_OUTPUT=json` as the default.

## Hook validation

A `SessionStart` hook (`jira-env-loader.cjs`) checks the 3 keys across the shell, `.meowkit/.env`, the env file an older install kept in the runtime folder, and `~/.meowkit/.env`. It does NOT export anything — each hook runs in its own subprocess, so propagation is impossible. The wrapper reads the same files on each call, as `KEY=VALUE` lines it never executes, and exports the keys.

Status messages:
- `[mk:jira] env OK` — all 3 keys present
- `[mk:jira] <KEY> missing in <files>` — specific key absent from every file it found
- `[mk:jira] .meowkit/.env missing — see .meowkit/.env.example for setup` — no env file found and the keys are not exported


## Exit codes (jira-as → user message map)

| Code | Class | User-actionable message |
|---|---|---|
| 0 | OK | (silent success) |
| 1 | Validation | "jira-as: invalid arguments — see `jira-as <group> <verb> --help`" |
| 2 | Auth | "jira-as: authentication failed — re-check `MEOW_JIRA_API_TOKEN` in .meowkit/.env" |
| 3 | Permission | "jira-as: permission denied — your account lacks the required Jira permission for this op" |
| 4 | Not found | "jira-as: resource not found — confirm issue key / project key / board ID exists" |
| 5 | Rate limit | "jira-as: rate limited by Atlassian — back off and retry" |
| 6 | Conflict | "jira-as: conflict — concurrent edit or stale state; refresh and retry" |
| 7 | Server | "jira-as: Atlassian server error — try again, then escalate to Atlassian Status if persistent" |
| 130 | Interrupt | "jira-as: interrupted (Ctrl+C)" |
| 78 | Wrapper config | "[jira] MEOW_JIRA_* keys come from two env files — put site URL, email and token in one file" |

## DC PAT / mTLS — Tier 2 escape hatch (documented only)

- DC PAT: untested with `jira-as`. Try at your own risk.
- mTLS: NOT supported by `jira-as` directly. If your org requires mTLS (e.g. behind a corporate proxy), use the Atlassian MCP integration directly per the upstream README — there is no auto-fallback shim in mk:jira.

## Wrapper smoke test

```
bash scripts/jira-as.sh --version
```

Expected: prints version, exits 0. With env missing, errors with `:?` parameter-expansion hint pointing at `.meowkit/.env.example`.

## Troubleshooting

- **`jira-as not installed at <path>`** — run `mewkit skill env jira` (or use the manual fallback).
- **`MEOW_JIRA_API_TOKEN missing`** — copy `.meowkit/.env.example` to `.meowkit/.env` and fill the three vars.
- **Wrapper works but hook says "missing"** — hook validates presence-only via grep; an empty value passes the grep but fails at the `:?` expansion. Set actual values.

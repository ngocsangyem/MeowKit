<!--
  Shared partial — included by workflow docs that require Jira access.
  Host page provides the surrounding H2 (e.g. "## Prerequisites").
  Source of truth: meowkit/.claude/skills/jira/references/install-and-auth.md
-->

Install the `jira-as` CLI (used by every `mk:jira-*` leaf):

```bash
npx mewkit setup
```

This installs `jira-as` into `.claude/skills/.venv/bin/jira-as`. No global install needed.

Then populate `.claude/.env` (gitignored) with three vars:

| Var | Purpose |
|---|---|
| `MEOW_JIRA_API_TOKEN` | Atlassian Cloud API token — get one at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `MEOW_JIRA_EMAIL` | Atlassian account email |
| `MEOW_JIRA_SITE_URL` | e.g. `https://your-company.atlassian.net` |

Verify with the SessionStart hook output: `[mk:jira] env OK` means all three keys are loaded.

::: details Escape hatch — Atlassian MCP (mTLS, multi-profile, or non-jira-as workflows)

If `jira-as` is unusable (e.g. mTLS-required tenants, multi-profile setups), the leaves accept Atlassian MCP as a fallback transport:

```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
```

The router does NOT auto-fallback — you invoke the leaf with the MCP transport explicitly. See [`mk:jira` reference](/reference/skills/jira) for details.
:::

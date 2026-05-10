---
description: "Interactive setup wizard for mk:confluence-* skills (env vars + Cloud-only validation)."
---

# /mk:confluence-setup

Walk the user through Confluence Cloud credential setup for the `mk:confluence-*` skills.

## Steps

1. Verify `npx mewkit setup` ran and `confluence-as` binary exists at `.claude/skills/.venv/bin/confluence-as`. If not, instruct: `npx mewkit setup`.

2. Ensure `.claude/.env` exists. If absent: create empty file, then `chmod 0600 .claude/.env`.

3. Check whether `MEOW_CONFLUENCE_*` vars are already populated:
   ```bash
   grep -c '^MEOW_CONFLUENCE_' .claude/.env || true
   ```
   If present (count >= 3): ask user whether to overwrite. If overwriting, comment out the old lines (do not delete; user may want to recover).

4. Prompt user for the three values via `AskUserQuestion`:
   - **Site URL** — must end in `.atlassian.net`. Validate with regex.
   - **Email** — Atlassian account email.
   - **API token** — instruction text: "Generate one at https://id.atlassian.com/manage-profile/security/api-tokens then paste here. The token will not be displayed in chat."

5. Append to `.claude/.env` via `>>` Bash redirection (do NOT echo back — keeps token out of transcript):
   ```
   MEOW_CONFLUENCE_SITE_URL=...
   MEOW_CONFLUENCE_EMAIL=...
   MEOW_CONFLUENCE_API_TOKEN=...
   ```

6. Re-run `chmod 0600 .claude/.env`.

7. Validate by running:
   ```bash
   bash .claude/skills/confluence/scripts/confluence-as.sh space list 2>&1 | head -20
   ```
   Expect non-error JSON output. If the wrapper exits 2/3/127: surface the error and offer to retry.

8. Optional channel-detection smoke (recommended once per install):
   ```bash
   bash .claude/skills/confluence/scripts/smoke-live.sh
   ```
   Tells the user whether to set `MEOW_CONFLUENCE_STDOUT_FILTER=trim-tail`.

9. On success print: "Confluence skills ready. Try: 'analyze spec for page <page-id>' to invoke mk:confluence-spec-analyst once it ships, or 'show me page <page-id>' for mk:confluence-page."

## Notes

- Does NOT write credentials to `.claude/settings.local.json` (the wrapper rejects that path).
- Token never echoed in transcript — use Bash heredoc / `>>` redirection so the token value never appears in chat output.
- Cloud-only — refuse Server/DC URLs at step 4.

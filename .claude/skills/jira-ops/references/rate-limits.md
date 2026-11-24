# Rate Limit Handling

Atlassian publishes the current limits and their enforcement: [Atlassian Rate Limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/). They change, so this file quotes no numbers.

## On HTTP 429

- `jira-as` retries with exponential backoff and honours `Retry-After`. If it still fails, the wrapper exits with code 5 (rate limited; see the exit-code table in `../jira/references/install-and-auth.md`): wait for the interval in `Retry-After`, then retry once.
- Do not loop faster. Narrow the work instead: one JQL search beats fetching issues one by one, and one update with several fields beats several updates.

## When the cache helps

Metadata (projects, fields, users) rarely changes, so warm it once before a run that reads it repeatedly, and clear it when it looks stale:

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh ops cache-warm --project PROJ
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh ops cache-clear --dry-run
```

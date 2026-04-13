# JQL Patterns — 15 Core Templates

Replace placeholders (ALL_CAPS) with actual values.

## My Work

```jql
assignee = currentUser() AND status != Done ORDER BY priority DESC
assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC
```

## Bug Triage

```jql
type = Bug AND status = Open AND priority in (Critical, Blocker) ORDER BY created DESC
type = Bug AND created >= -7d AND resolution = Unresolved ORDER BY priority DESC
type = Bug AND assignee is EMPTY AND status = Open ORDER BY priority DESC, created DESC
```

## Sprint Planning

```jql
project = PROJECT_KEY AND sprint in openSprints() AND status != Done
project = PROJECT_KEY AND sprint is EMPTY AND status = "To Do" ORDER BY priority ASC
project = PROJECT_KEY AND type = Story AND sprint in openSprints() AND "Story Points" is EMPTY
```

## Overdue / Stale

```jql
due < now() AND status != Done ORDER BY due ASC
updated < -30d AND status != Done AND assignee = currentUser()
updated < -14d AND status = "In Progress" ORDER BY updated ASC
```

## Search by Field

```jql
"Story Points" > 5 AND sprint in openSprints() AND status = "To Do"
fixVersion = VERSION_NAME AND status != Done ORDER BY priority DESC
status CHANGED TO "In Progress" AFTER -24h ORDER BY updated DESC
comment ~ "SEARCH_TERM" AND updated >= -30d ORDER BY updated DESC
```

## Tips

- `currentUser()` resolves to the authenticated user via Atlassian MCP
- `openSprints()` returns the currently active sprint(s)
- Custom field IDs: use `references/field-discovery.md` to find the right ID
- Chain conditions with `AND`, `OR`, use parentheses for grouping
- For advanced patterns, see [Jira JQL documentation](https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jira-query-language-jql/)

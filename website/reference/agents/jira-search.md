---
title: jira-search
description: Jira search and filter agent — runs JQL queries, validates syntax, builds queries from natural language, and manages saved filters.
---

# jira-search

The jira-search agent finds Jira issues using JQL queries. It validates query syntax, builds JQL from plain-language descriptions, manages saved filters, and exports results — all with mandatory JQL sanitization that prevents injection vulnerabilities when handling user-supplied search terms.

## Cognitive Framing

> *"Every user-supplied term must be sanitized before it enters a JQL query. No exceptions."*

The jira-search agent is a domain-specific agent for finding and filtering issues. Its most important discipline is JQL sanitization — every user-supplied term passes through the `jql-sanitize.sh` script before entering a query, preventing JQL injection attacks that could expose other teams' tickets.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | haiku |
| **Color** | green |
| **Safety** | 4-tier (search → filter create → bulk-update → filter delete) |
| **Never does** | Single-issue CRUD (jira-issue), bulk write operations (jira-bulk), skip JQL sanitization |

## When to Use

- When you need to **find issues by criteria** — status, assignee, sprint, labels, date ranges.
- When you need to **validate JQL syntax** before running a complex query.
- When you want to **build JQL from a plain-language description** — "tickets assigned to me, in progress."
- When you need to **manage saved filters** — create, update, share, or delete.
- When you need to **export search results** to CSV.

## Key Capabilities

- **JQL query execution** — runs JQL queries with result capping (`--max-results`) and field projection via `jq`.
- **JQL sanitization** — all user-supplied terms pass through `jql-sanitize.sh` before query construction. Prevents JQL injection.
- **Natural language to JQL** — converts plain-language descriptions to JQL using `search build --description`.
- **JQL validation** — validates query syntax before execution using `search validate`.
- **Filter management** — creates, updates, shares, and deletes saved Jira filters.
- **Result export** — exports query results to CSV format.

## Behavioral Checklist

- [x] Sanitizes ALL user-supplied terms via `jql-sanitize.sh` before embedding in JQL — mandatory
- [x] Caps result counts on every search call with `--max-results`
- [x] Projects output fields for readability via `jq`
- [x] Validates JQL syntax before executing complex queries
- [x] Runs `--dry-run` before bulk-update operations
- [x] Requires confirmation before destructive filter operations (delete)
- [x] Never constructs JQL by string concatenation with raw user input

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Find all open bugs in project PROJ" | Sanitizes terms, runs `search query "project = PROJ AND type = Bug AND status != Done"` |
| "Show my in-progress tickets" | Runs `assignee = currentUser() AND status = 'In Progress'` |
| "Build a query for tech debt tickets" | Uses `search build --description` to generate JQL from natural language |
| "Export last week's resolved issues" | Runs query with date filter and exports to CSV |
| "Save this search as a filter" | Creates a named saved filter with the JQL query |

## Pro Tips

### Always Sanitize User Input

JQL injection is a real vulnerability class. If a user says "search for issues about DROP TABLE", the raw term could manipulate query logic. The `jql-sanitize.sh` script strips JQL operators, functions, and special characters, then quote-wraps the result. Never skip this step, even for seemingly harmless terms.

### Cap Results to Prevent Overload

Always use `--max-results` on search queries. An unbounded query against a large Jira instance can return thousands of issues, overwhelming the output and consuming excessive API quota. Start with 20 results and increase only if needed.

## Key Takeaway

The jira-search agent provides safe, injection-resistant JQL querying with built-in sanitization that prevents a class of vulnerabilities other tools miss. Its natural-language-to-JQL capability makes complex queries accessible without requiring JQL expertise.

## Related Agents

- **[jira-issue](/reference/agents/jira-issue)** — handles single-issue CRUD after search identifies the target
- **[jira-bulk](/reference/agents/jira-bulk)** — handles bulk operations on search results (10+ issues)
- **[jira-fields](/reference/agents/jira-fields)** — discovers field names and IDs used in JQL queries

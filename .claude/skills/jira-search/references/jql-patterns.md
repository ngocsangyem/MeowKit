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

- `currentUser()` resolves to the authenticated user (configured via `MEOW_JIRA_EMAIL` in `.meowkit/.env`; the wrapper exports it to `JIRA_EMAIL` per call)
- `openSprints()` returns the currently active sprint(s)
- Custom field IDs: use `mk:jira-fields` (`.claude/skills/jira-fields/references/field-discovery.md`) to find the right ID
- Chain conditions with `AND`, `OR`, use parentheses for grouping
- For advanced patterns, see [Jira JQL documentation](https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jira-query-language-jql/)

## More examples by scenario

### Personal Queries

**My open issues:**
```jql
assignee = currentUser() AND status != Done
```

**Issues I reported:**
```jql
reporter = currentUser()
```

**Issues I'm watching:**
```jql
watcher = currentUser()
```

**Issues I commented on:**
```jql
comment ~ currentUser()
```

### Time-Based Queries

**Created today:**
```jql
created >= startOfDay()
```

**Updated in last 7 days:**
```jql
updated >= -7d
```

**Resolved this week:**
```jql
resolved >= startOfWeek() AND resolved <= endOfWeek()
```

**Overdue:**
```jql
duedate < now() AND status != Done
```

### Project & Status Queries

**All open issues in project:**
```jql
project = PROJ AND status in (Open, "In Progress", Reopened)
```

**Issues in multiple projects:**
```jql
project in (PROJ1, PROJ2, PROJ3)
```

**Recently resolved:**
```jql
status changed to Resolved during (startOfWeek(), endOfWeek())
```

### Priority & Type Queries

**Critical bugs:**
```jql
type = Bug AND priority in (Highest, High) AND status != Done
```

**All stories:**
```jql
type = Story ORDER BY priority DESC
```

### Assignment Queries

**Unassigned issues:**
```jql
project = PROJ AND assignee is EMPTY
```

**Assigned to team:**
```jql
assignee in membersOf("developers")
```

**Recently reassigned:**
```jql
assignee changed during (-7d, now())
```

### Label & Component Queries

**Specific label:**
```jql
labels = production
```

**Multiple labels:**
```jql
labels in (bug, urgent, hotfix)
```

**Specific component:**
```jql
component = Backend
```

### Text Search Queries

**Summary contains:**
```jql
summary ~ "login"
```

**Description or summary:**
```jql
text ~ "database error"
```

**Specific error message:**
```jql
description ~ "NullPointerException"
```

### Complex Queries

**High priority unassigned bugs:**
```jql
type = Bug AND priority = High AND assignee is EMPTY AND status != Done
```

**Stale issues (not updated in 30 days):**
```jql
updated <= -30d AND status != Done
```

**Issues missing estimates:**
```jql
project = PROJ AND "Story Points" is EMPTY AND type = Story
```

**Blocked issues:**
```jql
status = Blocked OR labels = blocked
```

### Sprint & Agile Queries

**Current sprint:**
```jql
sprint in openSprints()
```

**Specific sprint:**
```jql
sprint = "Sprint 23"
```

**Backlog items:**
```jql
sprint is EMPTY AND status != Done
```

### Version Queries

**Fix version:**
```jql
fixVersion = "1.0"
```

**Unreleased:**
```jql
fixVersion in unreleasedVersions()
```

**Released versions:**
```jql
fixVersion in releasedVersions()
```

### Run from the wrapper

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh search query "assignee = currentUser() AND status != Done"
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh search export "duedate < now() AND status != Done" --output overdue.csv
```

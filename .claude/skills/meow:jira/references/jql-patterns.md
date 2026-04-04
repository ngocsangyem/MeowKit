# JQL Patterns — 50+ Query Templates

Use these as starting points. Replace placeholders (ALL_CAPS) with actual values.

---

## My Work

```jql
assignee = currentUser() AND status != Done ORDER BY priority DESC
assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC
assignee = currentUser() AND status in ("In Progress", "In Review") ORDER BY updated DESC
assignee = currentUser() AND due <= 7d AND status != Done ORDER BY due ASC
assignee = currentUser() AND created >= -14d ORDER BY created DESC
assignee = currentUser() AND status = "To Do" AND sprint in openSprints()
reporter = currentUser() AND resolution = Unresolved ORDER BY created DESC
```

---

## Bug Triage

```jql
type = Bug AND status = Open AND priority in (Critical, Blocker) ORDER BY created DESC
type = Bug AND created >= -7d AND resolution = Unresolved ORDER BY priority DESC
type = Bug AND status != Done AND affectedVersion = AFFECTED_VERSION
type = Bug AND assignee is EMPTY AND status = Open ORDER BY priority DESC, created DESC
type = Bug AND priority = Critical AND updated >= -24h
type = Bug AND labels = regression AND sprint in openSprints()
type = Bug AND status = Open AND component = COMPONENT_NAME ORDER BY priority DESC
type = Bug AND resolution = Unresolved AND reporter = currentUser()
```

---

## Sprint Planning

```jql
project = PROJECT_KEY AND sprint in openSprints() AND status != Done
project = PROJECT_KEY AND sprint is EMPTY AND status = "To Do" ORDER BY priority ASC
project = PROJECT_KEY AND sprint in openSprints() AND assignee is EMPTY
project = PROJECT_KEY AND sprint in openSprints() ORDER BY status ASC, priority DESC
project = PROJECT_KEY AND type = Story AND sprint in openSprints() AND "Story Points" is EMPTY
sprint = SPRINT_NAME AND status = Done ORDER BY resolutiondate DESC
project = PROJECT_KEY AND sprint in futureSprints() ORDER BY rank ASC
```

---

## Overdue / Stale

```jql
due < now() AND status != Done ORDER BY due ASC
updated < -30d AND status != Done AND assignee = currentUser()
updated < -14d AND status = "In Progress" ORDER BY updated ASC
created < -60d AND status = "To Do" AND sprint is EMPTY ORDER BY created ASC
due >= -7d AND due <= 0d AND status != Done ORDER BY due ASC
status = "In Review" AND updated < -5d ORDER BY updated ASC
```

---

## Cross-Project

```jql
project in (PROJECT_A, PROJECT_B, PROJECT_C) AND type = Epic AND status = "In Progress"
project in (PROJECT_A, PROJECT_B) AND assignee = currentUser() AND status != Done
project in (PROJECT_A, PROJECT_B) AND type = Bug AND priority = Critical
project in (PROJECT_A, PROJECT_B) AND sprint in openSprints() AND status = "To Do"
project in (PROJECT_A, PROJECT_B) AND label = SHARED_LABEL ORDER BY project ASC
```

---

## Custom Fields

```jql
"Story Points" > 5 AND sprint in openSprints() AND status = "To Do"
"Story Points" is EMPTY AND sprint in openSprints() AND type = Story
"Team" = "TEAM_NAME" AND type = Story AND sprint in openSprints()
"Epic Link" = EPIC_KEY AND status != Done ORDER BY rank ASC
"Fix Version" = VERSION_NAME AND status != Done ORDER BY priority DESC
"Sprint" = SPRINT_NAME AND "Story Points" is not EMPTY
cf[CUSTOM_FIELD_ID] = "CUSTOM_VALUE" AND status != Done
```

---

## Release / Version

```jql
fixVersion = VERSION_NAME AND status != Done ORDER BY priority DESC
fixVersion = VERSION_NAME AND type = Bug ORDER BY priority DESC
fixVersion = VERSION_NAME AND status = Done ORDER BY resolutiondate DESC
fixVersion in unreleasedVersions() AND status != Done AND project = PROJECT_KEY
affectedVersion = VERSION_NAME AND type = Bug AND resolution = Unresolved
fixVersion = VERSION_NAME AND priority in (Critical, Blocker) AND status != Done
```

---

## Recent Activity

```jql
updated >= -1h ORDER BY updated DESC
updated >= -24h AND assignee = currentUser() ORDER BY updated DESC
created >= -7d AND project = PROJECT_KEY ORDER BY created DESC
status CHANGED TO "In Progress" AFTER -24h ORDER BY updated DESC
status CHANGED TO Done AFTER -7d AND project = PROJECT_KEY
comment ~ "SEARCH_TERM" AND updated >= -30d ORDER BY updated DESC
assignee CHANGED AFTER -7d AND project = PROJECT_KEY ORDER BY updated DESC
worklogDate >= -7d AND worklogAuthor = currentUser()
```

---

## Epics and Hierarchy

```jql
type = Epic AND status = "In Progress" AND project = PROJECT_KEY
type = Epic AND status = "To Do" AND assignee = currentUser()
"Epic Link" in (EPIC_KEY_1, EPIC_KEY_2) AND status != Done
type = Epic AND due <= 30d AND status != Done ORDER BY due ASC
```

---

## Team / Capacity

```jql
sprint in openSprints() AND project = PROJECT_KEY AND status != Done ORDER BY assignee ASC
sprint in openSprints() AND assignee = TEAM_MEMBER ORDER BY priority DESC
sprint in openSprints() AND project = PROJECT_KEY GROUP BY assignee
```

---

## Tips

- Replace `PROJECT_KEY` with your actual project key (e.g. `PLAT`, `WEB`, `APP`)
- `currentUser()` resolves to the authenticated user automatically via Atlassian MCP
- `openSprints()` returns the currently active sprint(s) for the board
- Custom field IDs: use `references/field-discovery.md` to find the right ID
- Chain conditions with `AND`, `OR`, use parentheses for grouping: `(A OR B) AND C`

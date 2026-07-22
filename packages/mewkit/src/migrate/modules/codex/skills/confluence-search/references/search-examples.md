# Search Examples

Real-world natural-language → CQL translations.

## Contents

- [Example 1: Recent Activity by User](#example-1-recent-activity-by-user)
- [Example 2: Stale Spec Audit](#example-2-stale-spec-audit)
- [Example 3: Cross-Space Topic Search](#example-3-cross-space-topic-search)
- [Example 4: Children of a Roadmap Page](#example-4-children-of-a-roadmap-page)
- [Example 5: Recently Updated RFCs](#example-5-recently-updated-rfcs)

## Example 1: Recent Activity by User

**NL:** "Show me everything I've created in ENG in the last week."

**CQL:**
```
creator = currentUser() AND space = ENG AND created >= now("-7d") ORDER BY created DESC
```

**Wrapper invocation:**
```bash
bash the project environment/.agents/skills/confluence/scripts/confluence-as.sh search \
  --cql 'creator = currentUser() AND space = ENG AND created >= now("-7d") ORDER BY created DESC' \
  --max-results 20
```

## Example 2: Stale Spec Audit

**NL:** "Find every page labeled 'spec' that hasn't been touched in 6 months."

**CQL:**
```
label = "spec" AND lastModified < now("-180d") ORDER BY lastModified ASC
```

**Why ASC:** oldest first — these are the most-stale candidates for archival.

## Example 3: Cross-Space Topic Search

**NL:** "Find pages mentioning 'rate limiting' across engineering and ops."

**CQL:**
```
text ~ "rate limiting" AND space IN ("ENG", "OPS") ORDER BY lastModified DESC
```

**Sanitization note:** the term "rate limiting" comes from the user — must be passed through `cql-sanitize.sh` first if it contains anything beyond plain words. For pure ASCII alphanumerics + spaces the sanitizer passes through unchanged.

## Example 4: Children of a Roadmap Page

**NL:** "What pages live directly under page 12345?"

**CQL:**
```
parent = 12345
```

**Note:** for the full subtree, use `ancestor = 12345` instead. Prefer the `hierarchy children` / `hierarchy descendants` verbs (see `mk:confluence-page`) for hierarchy-specific reads — they return the structured tree rather than a flat list.

## Example 5: Recently Updated RFCs

**NL:** "Show RFCs across the whole org updated this month."

**CQL:**
```
label = "rfc" AND lastModified >= now("-30d") ORDER BY lastModified DESC
```

**Export to CSV for sharing:**
```bash
bash the project environment/.agents/skills/confluence/scripts/confluence-as.sh search export \
  --cql 'label = "rfc" AND lastModified >= now("-30d") ORDER BY lastModified DESC' \
  --output-file /tmp/recent-rfcs.csv \
  --format csv
```

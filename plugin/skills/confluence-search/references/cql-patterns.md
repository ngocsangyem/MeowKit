# CQL Patterns (Curated)

Canonical CQL templates for common Confluence search needs. All examples assume `confluence-as` JSON output.

## Contents

- [By Author / Owner](#by-author--owner)
- [By Time](#by-time)
- [By Space](#by-space)
- [By Label](#by-label)
- [By Title / Text](#by-title--text)
- [By Hierarchy](#by-hierarchy)
- [Combined Patterns](#combined-patterns)

## By Author / Owner

```
creator = currentUser()
contributor = currentUser()
creator = "user@example.com"
```

## By Time

```
lastModified >= now("-7d")
lastModified >= "2025-01-01"
created >= now("-30d") AND created < now("-7d")
lastModified < now("-180d")  -- stale pages
```

## By Space

```
space = ENG
space in ("ENG", "OPS", "PROD")
space != ARCHIVE
```

## By Label

```
label = "spec"
label in ("rfc", "adr")
label = "draft" AND space = ENG
```

## By Title / Text

```
title ~ "roadmap"
title = "Q3 Roadmap"
text ~ "incident postmortem"
title !~ "draft"
```

`~` is fuzzy / contains; `=` is exact match.

## By Hierarchy

```
parent = 12345
ancestor = 12345          -- pages anywhere under this root
type = page AND parent = 12345
```

## Combined Patterns

```
-- Pages I created last week in ENG
creator = currentUser() AND space = ENG AND created >= now("-7d")

-- Drafts older than 30 days
label = "draft" AND lastModified < now("-30d")

-- All RFCs in engineering
space = ENG AND label = "rfc" AND type = page

-- Recently-updated specs across multiple spaces
label = "spec" AND space in ("ENG", "PROD") AND lastModified >= now("-14d")

-- Pages mentioning a topic, scoped to a project area
text ~ "rate limiting" AND space = ENG ORDER BY lastModified DESC

-- Stale-spec audit
label = "spec" AND lastModified < now("-180d")
```

Use `ORDER BY lastModified DESC` (or `created DESC`) on result lists you intend to scan visually.

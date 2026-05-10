# CQL Reference

Full CQL operator + function tour for Confluence Cloud. Adapt as needed; verify exact behavior against the live instance via `search validate`.

## Contents

- [Field Operators](#field-operators)
- [Logical Operators](#logical-operators)
- [Quoting Rules](#quoting-rules)
- [Functions](#functions)
- [Searchable Fields](#searchable-fields)
- [ORDER BY](#order-by)
- [Sanitizer Gaps (v1)](#sanitizer-gaps-v1)

## Field Operators

| Operator | Meaning | Example |
|---|---|---|
| `=` | Exact equality | `space = ENG` |
| `!=` | Inequality | `space != ARCHIVE` |
| `~` | Fuzzy / contains | `title ~ "roadmap"` |
| `!~` | Does not contain | `title !~ "draft"` |
| `<` `<=` `>` `>=` | Date / numeric comparison | `lastModified >= now("-7d")` |
| `IN` | Membership | `space IN ("ENG", "OPS")` |
| `NOT IN` | Non-membership | `type NOT IN ("blogpost")` |

## Logical Operators

```
AND      -- both true
OR       -- either true
NOT      -- negation; usually written as != or NOT IN
```

Parentheses group sub-expressions:

```
(space = ENG OR space = OPS) AND label = "rfc"
```

## Quoting Rules

- Identifiers (space keys, field names, type values like `page`, `blogpost`) are bare
- String literals use double-quotes: `title = "Q3 Roadmap"`
- Inside double-quoted strings, escape `"` with `\"` and `\` with `\\`
- The `cql-sanitize.sh` shared script applies these escapes for user input

## Functions

| Function | Returns | Example |
|---|---|---|
| `currentUser()` | The acting user's account | `creator = currentUser()` |
| `now()` | Current timestamp | `lastModified < now("-30d")` |
| `now("-Nd")` | Current minus N days | `created >= now("-7d")` |
| `now("-Nm")` | Minus N months | `created >= now("-3m")` |
| `recentlyViewed()` | Pages the user recently viewed | `id IN recentlyViewed()` |
| `favouriteSpaces()` | User's favourite spaces | `space IN favouriteSpaces()` |

Function-name capitalization is server-defined — prefer lowercase as shown.

## Searchable Fields

| Field | Notes |
|---|---|
| `space` | Space key (uppercase) |
| `type` | `page`, `blogpost`, `attachment`, `comment` |
| `title` | Page / blog title |
| `text` | Free-text body search |
| `label` | Single label or `IN (...)` |
| `creator` | Account ID, email, or `currentUser()` |
| `contributor` | Anyone who edited |
| `created` | Timestamp |
| `lastModified` | Timestamp |
| `parent` | Direct parent page id |
| `ancestor` | Any ancestor page id (anywhere up the tree) |
| `id` | Page id |
| `mention` | Pages mentioning a user |

Run `confluence-as search fields` for the live, complete list.

## ORDER BY

```
ORDER BY lastModified DESC
ORDER BY created ASC
ORDER BY title ASC
```

Only one field at a time (verify against live instance — multi-field ORDER BY is sometimes rejected).

## Sanitizer Gaps (v1)

The shared `cql-sanitize.sh` rejects shell metacharacters and common CQL statement separators (`;<alpha>`, `--`, command-substitution sequences). Known gaps the v1 sanitizer does NOT catch:

- Sneaky `;"` sequences with embedded escapes (rare; partial mitigation by quote-wrapping)
- Unicode lookalike characters (homoglyph attacks)
- Extremely long inputs designed to flood downstream parsers

For destructive ops (any verb that mutates state) the bulk agent additionally requires a typed confirmation token before executing — the second gate.

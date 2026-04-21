# Field Discovery — Finding Custom Fields in Jira

Custom fields vary per project and Jira instance. Use this methodology to discover them dynamically before creating or updating issues.

## Contents

- [Step 1: List All Fields](#step-1-list-all-fields)
- [Step 2: Filter by Project Screen](#step-2-filter-by-project-screen)
- [Step 3: Common Custom Fields](#step-3-common-custom-fields)
- [Step 4: Field Type Handling](#step-4-field-type-handling)
- [Step 5: Discover User Account IDs](#step-5-discover-user-account-ids)
- [Step 6: Validate Before Creating](#step-6-validate-before-creating)
- [Quick Reference: Field Discovery Commands](#quick-reference-field-discovery-commands)
- [Tip: Cache Field IDs Per Project](#tip-cache-field-ids-per-project)


---

## Step 1: List All Fields

Via Atlassian MCP, call the field list endpoint:

```
GET /rest/api/3/field
```

Returns all system and custom fields. Custom fields have IDs like `customfield_10016`.

Key fields to note:
- `id` — used in API calls (e.g. `customfield_10016`)
- `name` — human-readable (e.g. "Story Points")
- `schema.type` — data type (number, string, array, user, date, etc.)
- `schema.custom` — custom field type identifier

---

## Step 2: Filter by Project Screen

Not all fields appear on all issue types. Get the fields for a specific project + issue type:

```
GET /rest/api/3/issue/createmeta?projectKeys=PROJECT_KEY&issueTypeNames=Story&expand=projects.issuetypes.fields
```

This returns only the fields that appear on the create screen for that project + issue type combination. Prefer this over the full field list when creating issues.

---

## Step 3: Common Custom Fields

These appear in most Jira Software projects:

| Field Name | Typical ID | Type | Notes |
|-----------|-----------|------|-------|
| Story Points | `customfield_10016` | number | May be named "Story point estimate" in next-gen |
| Sprint | `customfield_10020` | array | Sprint object with `id`, `name`, `state` |
| Epic Link | `customfield_10014` | string | Epic issue key (classic projects only) |
| Epic Name | `customfield_10011` | string | Short name for the epic |
| Team | `customfield_10001` | object | Team object, varies by instance |
| Start Date | `customfield_10015` | date | ISO 8601 format: `2026-04-03` |
| Fix Version | `fixVersions` | array | System field, not custom |
| Components | `components` | array | System field, not custom |

Note: Custom field IDs differ between Jira instances. Always discover dynamically — never hardcode IDs.

---

## Step 4: Field Type Handling

When setting custom field values, the payload format depends on `schema.type`:

| Type | Example Value | Notes |
|------|--------------|-------|
| `string` (text) | `"Some text"` | Plain string |
| `number` | `5` | Integer or float |
| `option` (select) | `{"value": "High"}` | Single select — use `value` key |
| `array of options` | `[{"value": "A"}, {"value": "B"}]` | Multi-select |
| `user` | `{"accountId": "abc123"}` | Use accountId, not username |
| `date` | `"2026-04-03"` | ISO 8601 date |
| `datetime` | `"2026-04-03T09:00:00.000+0000"` | ISO 8601 with time |
| `array of strings` | `["label1", "label2"]` | Labels use plain strings |
| `issuelink` | `{"key": "PROJ-123"}` | Epic link uses issue key |
| `sprint` | `{"id": 42}` | Sprint uses numeric ID |

---

## Step 5: Discover User Account IDs

User picker fields require `accountId`, not display name or email:

```
GET /rest/api/3/user/search?query=john.doe@company.com
```

Returns array of users with `accountId`. Use the `accountId` in field payloads.

---

## Step 6: Validate Before Creating

When unsure if a field is required or what values it accepts:

1. Get create metadata for the issue type (Step 2)
2. Check `required: true` on each field
3. For option fields, check `allowedValues` array for valid choices
4. For user fields, search for the user first to get accountId

---

## Quick Reference: Field Discovery Commands

```
# All fields in the instance
GET /rest/api/3/field

# Fields for a specific project + issue type
GET /rest/api/3/issue/createmeta?projectKeys=PROJ&issueTypeNames=Bug&expand=projects.issuetypes.fields

# Valid values for a specific field (options, versions, components)
GET /rest/api/3/project/PROJ/components
GET /rest/api/3/project/PROJ/versions

# Find user account ID
GET /rest/api/3/user/search?query=EMAIL_OR_NAME
```

---

## Tip: Cache Field IDs Per Project

Once you discover custom field IDs for a project, they are stable. The IDs do not change unless a Jira admin reconfigures the instance. Safe to reuse within a session.
# Agile Field IDs Reference

Single source of truth for Agile field identifiers.

---

## Important Note

Field IDs vary by JIRA instance. **Always verify with:**

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh fields list --agile
```

---

## Typical JIRA Cloud Field IDs

| Field | Typical ID | Alternative IDs |
|-------|------------|-----------------|
| **Sprint** | `customfield_10020` | varies |
| **Story Points** | `customfield_10016` | `customfield_10040` |
| **Epic Link** | `customfield_10014` | varies |
| **Epic Name** | `customfield_10011` | varies |
| **Epic Color** | `customfield_10012` | varies |
| **Rank** | `customfield_10019` | varies |

---

## Field Descriptions

### Sprint (`customfield_10020`)
- **Type:** Sprint
- **Purpose:** Assign issues to sprints
- **Managed by:** Scrum boards
- **Note:** Cannot be edited directly; use board operations

### Story Points (`customfield_10016`)
- **Type:** Number (float)
- **Purpose:** Effort estimation using Fibonacci scale
- **Values:** 1, 2, 3, 5, 8, 13, 21 (recommended)
- **Used by:** Velocity tracking, sprint planning

### Epic Link (`customfield_10014`)
- **Type:** Epic Link
- **Purpose:** Link Story/Task/Bug to parent Epic
- **Constraint:** Issue can only belong to one Epic
- **Note:** Team-managed projects use built-in parent link instead

### Epic Name (`customfield_10011`)
- **Type:** Text (255 chars)
- **Purpose:** Display name for Epic on boards and backlogs
- **Required:** Yes, when creating Epics

### Epic Color (`customfield_10012`)
- **Type:** Select
- **Purpose:** Visual identification on boards
- **Values:** color_1 through color_9

### Rank (`customfield_10019`)
- **Type:** Rank
- **Purpose:** Global backlog ordering
- **Managed by:** Drag-and-drop on backlogs
- **Note:** Read-only in most contexts

---

## JIRA Server/Data Center Notes

Field IDs on Server/Data Center installations may differ significantly:
- IDs are assigned sequentially during installation
- Plugin installations may shift IDs
- Always use `list_fields.py --agile` to discover IDs

---

## Finding Fields Programmatically

```bash
# List all Agile fields
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh fields list --agile

# Check specific project
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh fields check-project PROJ --check-agile

# Search by partial name
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh fields list --filter "sprint"
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh fields list --filter "story"
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh fields list --filter "epic"
```

---

## Cross-References

- [Field Types Reference](field-types-reference.md) — type-selection guide
- [Field Discovery](field-discovery.md) — discovery methodology
- [SKILL.md](../SKILL.md) — `mk:jira-fields` entrypoint

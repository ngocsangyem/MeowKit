# Agile Custom Fields Reference

This skill uses JIRA's standard Agile custom fields. Field IDs may vary by instance.

## Field IDs

Field IDs vary by instance and are owned by `mk:jira-fields`: run `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh fields list --agile`.

## Common Field Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Epic Link field not found" | Different field ID | Use jira-fields to discover |
| "Story points not showing" | Field not on screen | Check project screen configuration |
| "Cannot set Epic Name" | Field not editable | Check field configuration |

## See Also

- [jira-fields SKILL.md](../../jira-fields/SKILL.md) - Field discovery tools

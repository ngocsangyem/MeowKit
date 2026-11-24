# Checkpoint and Resume Guide

Use a checkpoint for a long bulk run (hundreds of issues, a flaky network, or more than a few minutes), so an interrupted run resumes instead of repeating finished steps.

## Use

Pass `--checkpoint <file>` on the real run (not the dry-run):

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh bulk transition \
  --jql "project=PROJ" --to "Done" --checkpoint tasks/jira-bulk-checkpoint.json
```

The file is rewritten after each completed step and records the selected issues, so a status-changing JQL run resumes the same selection even though finished issues no longer match the query.

## Resume

Re-run the exact same command with the same `--checkpoint` file. The CLI refuses to resume when the operation, selection or options differ ("Checkpoint operation, selection or options mismatch"); in that case start with a new file.

## Clean up

A checkpoint is a plain JSON file. Delete it once the run finishes.

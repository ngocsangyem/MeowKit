# Dry-Run Protocol

How every `mk:confluence-bulk` operation runs. Shown as `$WRAPPER` below: `bash $CLAUDE_PROJECT_DIR/.claude/skills/confluence/scripts/confluence-as.sh`.

## The protocol

```
Step 1  $WRAPPER bulk <op> --cql "<sanitized>" --dry-run --max-pages 100
Step 2  Show impacted count, first 5 page titles + ids, and what will change. The user replies "yes".
Step 3  $WRAPPER bulk <op> --cql "<sanitized>" --max-pages 100 --yes
```

A bulk delete moves pages to the trash and a plain "yes" is enough; restoring is manual in the Confluence UI.

## Example

```
USER:  label every page in space DOCS older than 90 days as 'archive'
AGENT: $WRAPPER bulk label add --cql 'space = DOCS AND lastModified < now("-90d")' \
           --labels "archive" --dry-run --max-pages 100
       impacted_count: 23; first 5: 12001 "Old Onboarding Guide", 12002 ...
       Label these 23 pages? Reply "yes" to proceed.
USER:  yes
AGENT: $WRAPPER bulk label add --cql '...' --labels "archive" --max-pages 100 --yes
       23 pages changed. Status: DONE
```

## Refusals

If asked to skip the dry-run ("I already checked"): run it anyway. A CQL that looked right from memory can match different pages than expected, and the check takes seconds.

If the dry-run count exceeds `--max-pages`: show the count, and ask whether to raise the cap or narrow the CQL.

If the impacted count differs by more than 5% between dry-run and execute, report it as a concern in the status.

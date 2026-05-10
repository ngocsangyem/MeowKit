# Dry-Run Protocol

The 3-step ceremony for any `mk:confluence-bulk` Tier-4 op, with example transcripts.

## Contents

- [The Ceremony](#the-ceremony)
- [Example Transcript: Bulk Label](#example-transcript-bulk-label)
- [Example Transcript: Bulk Delete (with elevated confirmation)](#example-transcript-bulk-delete-with-elevated-confirmation)
- [Refusal Patterns](#refusal-patterns)

## The Ceremony

```
Step 1 — Dry-run
  bash $WRAPPER bulk <op> --cql "<sanitized>" --dry-run --max-pages 100

Step 2 — Inspect + Confirm
  Agent presents:
    - impacted_count
    - first 5 affected page titles + IDs
    - the confirm command to run next
    - the typed-token requirement
  User types: "<TOKEN>" matching the format the agent specifies

Step 3 — Execute
  bash $WRAPPER bulk <op> --cql "<sanitized>" --max-pages 100 --yes
```

## Example Transcript: Bulk Label

```
USER:    label every page in space DOCS older than 90 days as 'archive'

AGENT:   Step 1 — running dry-run.
         (sanitizing CQL: "space = DOCS AND lastModified < now(\"-90d\")")

         bash $CLAUDE_PROJECT_DIR/.claude/skills/confluence/scripts/confluence-as.sh \
             bulk label add --cql 'space = DOCS AND lastModified < now("-90d")' \
             --label "archive" --dry-run --max-pages 100

         Result:
           impacted_count: 23
           first 5 affected:
             - 12001 — "Old Onboarding Guide"
             - 12002 — "Deprecated Auth Spec"
             - 12003 — "v0.5 Release Notes"
             - 12004 — "2024 Q1 Roadmap"
             - 12005 — "Legacy Migration Plan"

         Step 2 — Confirm.
         To proceed, type: LABEL 23 PAGES ARCHIVE

USER:    LABEL 23 PAGES ARCHIVE

AGENT:   Step 3 — executing.

         bash $CLAUDE_PROJECT_DIR/.claude/skills/confluence/scripts/confluence-as.sh \
             bulk label add --cql 'space = DOCS AND lastModified < now("-90d")' \
             --label "archive" --max-pages 100 --yes

         Result:
           pages_changed: 23
           first 5: 12001, 12002, 12003, 12004, 12005
           last 5: 12019, 12020, 12021, 12022, 12023
           Search: https://acme.atlassian.net/wiki/search?cql=label%20%3D%20%22archive%22

         Status: DONE
```

## Example Transcript: Bulk Delete (with elevated confirmation)

```
USER:    delete every page in space TMP

AGENT:   This operation matches a high-blast-radius pattern (no time restriction
         on the CQL). Confirm the scope is intentional.

         Step 1 — running dry-run.

         bash $CLAUDE_PROJECT_DIR/.claude/skills/confluence/scripts/confluence-as.sh \
             bulk delete --cql 'space = TMP' --dry-run --max-pages 100

         Result:
           impacted_count: 47
           first 5 affected:
             - 9001 — "Sandbox Notes"
             - 9002 — "Test Page (do not edit)"
             - 9003 — "Throwaway Draft"
             - 9004 — "Brainstorm 2025"
             - 9005 — "Old Test"

         Step 2 — Confirm.
         Bulk delete is soft-delete to trash; restore requires the Confluence UI.
         To proceed, type: DELETE 47 PAGES IN TMP

USER:    DELETE 47 PAGES IN TMP

AGENT:   Step 3 — executing.

         bash $CLAUDE_PROJECT_DIR/.claude/skills/confluence/scripts/confluence-as.sh \
             bulk delete --cql 'space = TMP' --max-pages 100 --yes

         Result:
           pages_changed: 47
           ...

         Status: DONE
```

## Refusal Patterns

If the user asks the agent to skip the dry-run ("just delete them, I checked already"):

```
The dry-run is unconditional — every bulk op runs with --dry-run first regardless
of who confirms it. The reason: a CQL that looked right from memory will sometimes
match different pages than expected (recently created pages, label drift, ancestor
shifts). Step 2 is a 5-second sanity check; the cost of skipping it is much higher
than the cost of running it.

I'll run the dry-run now.
```

If the user requests a count higher than the cap without raising `--max-pages`:

```
The default cap is 100 pages. The dry-run reported 187 matches. To proceed:
  1. Re-run with --max-pages 200
  2. Re-confirm the count after seeing the new dry-run

Or, narrow the CQL to reduce the match set.
```

If the impacted_count differs by > 5% between dry-run and execute, surface as a concern in Status.

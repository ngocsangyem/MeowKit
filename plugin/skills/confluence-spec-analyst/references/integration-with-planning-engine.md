# Integration With Planning-Engine

How the Spec Research Report feeds the rest of the 7-phase workflow.

## Contents

- [Where the Report Lands](#where-the-report-lands)
- [Planning-Engine `--spec` Flag](#planning-engine---spec-flag)
- [Intake Confluence-URL Detection](#intake-confluence-url-detection)
- [Boundary Rules](#boundary-rules)

## Where the Report Lands

The agent persists the report to **one** of these paths, in priority order:

1. Active plan's research dir: `{plan_dir}/research/confluence-spec-{YYMMDD}-{HHMM}-{title-slug}.md`
2. Otherwise: `tasks/reports/confluence-spec-{YYMMDD}-{HHMM}-{title-slug}.md`

After write, append a row to `tasks/reports/.confluence-spec-index.tsv` (append-only, never edited):

```
{page-id}\t{report-filename}\t{utc-iso-timestamp}\t{source-page-hash}
```

The index supports a future v2 `--spec <page-id>` convenience flag that auto-resolves the most recent report for that page.

## Planning-Engine `--spec` Flag

`mk:planning-engine plan --tickets PROJ-101,PROJ-102 --spec <report-path>` extends the planning pipeline with spec context.

**User-orchestrated, two-step flow** — skill-to-skill invocation is forbidden in Toolkit:

```
Step 1 (user): /mk:confluence-spec-analyst 12345
  → produces report at one of the paths above

Step 2 (user): /mk:planning-engine plan --tickets PROJ-101,PROJ-102 \
                 --spec tasks/reports/confluence-spec-{...}.md
```

What planning-engine does with `--spec`:

1. Validates the path exists AND begins with `# Spec Research Report:` (frontmatter check rejects random markdown files)
2. Extracts `## Requirements`, `## Acceptance Criteria`, `## Gaps & Ambiguities` sections
3. Passes the extracted content to the planning-reporter agent as additional input
4. Planning Report includes a new `## Spec Context (mk:confluence-spec-analyst)` section with:
   - Pointer back to the spec report path
   - Key requirements (filtered to those relevant to the planning tickets)
   - Open spec gaps relevant to planning
   - Conflicts between spec and tickets (if any)

If the path doesn't exist or isn't a spec-analyst report, planning-engine errors with a helpful message and exits before spawning agents.

## Intake Confluence-URL Detection

`mk:intake` recognizes Confluence Cloud URLs as a 5th source (alongside Jira / Linear / GitHub / manual):

```
https://*.atlassian.net/wiki/spaces/{KEY}/pages/{ID}/{slug}    -- canonical
https://*.atlassian.net/wiki/spaces/{KEY}/pages/{ID}            -- without slug
https://*.atlassian.net/wiki/x/{shortcode}                      -- shortlink (v1 limitation: not auto-resolved)
```

Plus raw page-id detection when phrase "from confluence" or similar is explicit.

intake fetches raw page content via the wrapper directly (`page get --page-id <id>`), uses it as intake source, and recommends spec-analyst in its Suggested Actions section for deeper analysis. intake does NOT auto-invoke spec-analyst (no skill-to-skill chaining).

## Boundary Rules

- mk:confluence-spec-analyst produces REPORTS, not Jira tickets. Human runs `mk:jira-issue create` manually if desired.
- Skills do NOT create plan dirs — that is `mk:plan-creator`'s responsibility.
- Reports land in `tasks/reports/` or active plan `research/` per existing convention.
- No Confluence write-back (posting reports as Confluence pages) — out of scope.
- `--with-commands` is opt-in; default report is suggestions-only, preserves "reports not automation" principle.

# Confluence Handoff Protocol — mk:intake → mk:confluence-*

Defines how `mk:intake` recognizes Confluence as a source, fetches content, and (optionally) hands off to `mk:confluence-spec-analyst` for deeper analysis. Auto-invocation of spec-analyst is NOT in v1 scope — user reviews the intake report and runs spec-analyst manually.

## Handoff Flow

```
mk:intake receives Confluence URL or page-id
        ↓
Pattern-match against Atlassian Cloud URL grammar
    Match → extract page-id
    No match (raw input) → require "from confluence" phrase + numeric token
        ↓
Pre-flight check: MEOW_CONFLUENCE_* env vars present?
    NO  → "Confluence not configured. Run /mk:confluence-setup. Exiting."
    YES → continue
        ↓
Confirm with user: fetch page-id {N}? [Y/n]
        ↓
Invoke: confluence-as.sh page get --page-id {N}
        ↓
Use returned markdown as intake source content
        ↓
Continue normal intake flow (sanitize → process media → classify → etc.)
        ↓
Intake report's Source Summary cites the Confluence URL + page metadata
Intake report's Suggested Actions recommends:
  /mk:confluence-spec-analyst <page-id>   (for deeper spec analysis)
```

## URL Patterns Recognized

```
https://*.atlassian.net/wiki/spaces/{KEY}/pages/{ID}/{slug}    -- canonical
https://*.atlassian.net/wiki/spaces/{KEY}/pages/{ID}            -- without slug
```

Both forms expose `{ID}` as a numeric token; intake extracts it via anchored regex (no glob expansion, no command substitution).

## Patterns NOT Recognized (v1 limitations)

- `*.atlassian.net/wiki/x/{shortcode}` — shortlinks. The skill surfaces a Gotcha asking the user to paste the canonical URL or page id.
- Custom-domain enterprise tenants (mapped behind a non-`atlassian.net` host). Surface as Gotcha; user falls back to pasting raw page id.

## Raw Page ID Detection

When user input lacks a URL but contains a numeric token (3+ digits), intake recognizes Confluence only when the explicit phrase "from confluence" (or close variants: "confluence page", "wiki page") accompanies the number. Pure numeric tokens default to Jira / GitHub disambiguation, not Confluence.

## When Intake Triggers Spec-Analyst (it doesn't, in v1)

intake does NOT programmatically invoke spec-analyst. The intake report's Suggested Actions section recommends running `/mk:confluence-spec-analyst <page-id>` as a follow-up. This preserves MeowKit's "user orchestrates skills" boundary.

## How the Spec Report Flows Back

If the user runs spec-analyst after intake, the resulting report is then suitable for `mk:planning-engine plan --tickets ... --spec <report-path>`:

```
1. /mk:intake https://acme.atlassian.net/wiki/spaces/ENG/pages/12345/Q3-Roadmap
   → intake report with "Source: Confluence page 12345" + recommendation

2. /mk:confluence-spec-analyst 12345
   → tasks/reports/confluence-spec-{date}-{title-slug}.md

3. (Optional, separate step) /mk:planning-engine plan --tickets PROJ-101,102 \
     --spec tasks/reports/confluence-spec-{date}-{title-slug}.md
   → Planning Report with ## Spec Context section
```

## Failure Modes

| Symptom | Action |
|---|---|
| Page not found (wrapper exit 4) | Surface error to user; suggest verifying page-id is reachable in current account |
| Page restricted (wrapper exit 5) | User lacks read permission; cannot proceed; recommend asking page owner for access |
| Cloud-only gate triggered (exit 3) | Site URL is non-Cloud; recommend MCP escape hatch per `mk:confluence` install reference |
| Network failure | Retry once; if persistent, exit cleanly with error |
| Spec-analyst absent | Suggested Actions still recommends `/mk:confluence-spec-analyst` — installation gap is user's to resolve |

## What mk:intake Does NOT Do

- Does NOT auto-invoke `mk:confluence-spec-analyst` (user-orchestrated only)
- Does NOT write back to Confluence (no comment posting, no page creation)
- Does NOT fetch child pages or attachments — that's spec-analyst's job
- Does NOT re-fetch on the same intake run if user pastes the same URL twice

---
name: "confluence-spec-analyst"
description: "Deep spec analysis on a Confluence page. Reads page (+ children) via the confluence-as wrapper, produces a structured Spec Research Report with requirements, acceptance criteria, gaps, ambiguities, and suggested user stories for human review. Read-only — does NOT create Jira tickets. Triggers: 'analyze spec for PAGE-ID', 'extract requirements from confluence page', 'spec research on URL'. NOT for raw page CRUD (mk:confluence-page); NOT for ticket complexity scoring (mk:planning-engine)."
---

# mk:confluence-spec-analyst

Forks to the `confluence-spec-analyst` agent. Read-only at the Confluence side — the agent has Write tool privilege ONLY for persisting the Spec Research Report locally; it never writes to Confluence itself.

## Triggers

- "analyze spec for 12345"
- "extract requirements from this confluence page"
- "spec research on https://acme.atlassian.net/wiki/spaces/ENG/pages/12345/Q3-Roadmap"
- "what are the gaps in PAGE-ID 12345"

## Operations

`analyze PAGE-ID [--include-children N] [--no-images] [--with-commands]` — `--with-commands` is opt-in (default report has suggestions only, no executable commands).

## See also

- Agent: `../../agents/confluence-spec-analyst.md`
- Shared: `../confluence/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/spec-analysis-patterns.md` — gap-detection heuristics + weasel-word inventory
  - `references/report-template.md` — the Spec Research Report skeleton
  - `references/integration-with-planning-engine.md` — how planning-engine consumes the report
- Peer leaves: `mk:confluence-page` (raw CRUD), `mk:confluence-search` (CQL search), `mk:planning-engine` (consumes this report via `--spec` flag)

## Handoff

- `mk:planning-engine` accepts `--spec <report-path>` pointing at this report. User runs spec-analyst FIRST, then passes the resulting report path to planning-engine.
- `mk:intake` recognizes Confluence URL/page-id as a 5th source — fetches raw page content via wrapper, recommends spec-analyst for deeper analysis.
- `mk:jira-issue create` — human runs manually from the report's Suggested Commands (with `--with-commands` flag).

## Gotchas

- Source page hash detects staleness; v1 produces a fresh report on every re-run (no diff mode).
- `mk:multimodal` absent → Image / Diagram Findings section is omitted with `[NO_MULTIMODAL]` flag; rest of analysis proceeds.
- Children pipeline: hard cap of 10 children. Default depth 1. User must explicitly raise both.
- `--with-commands` is opt-in — default report has suggestions only; preserves "reports not automation".
- Grow this list as new edge cases surface.
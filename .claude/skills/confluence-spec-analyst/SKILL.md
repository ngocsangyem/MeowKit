---
name: mk:confluence-spec-analyst
description: "Reports requirements and gaps in a spec. NOT for mk:confluence-page."
phase: on-demand
source: local
keywords:
  - confluence-spec
  - spec-analysis
  - requirements-extraction
  - gap-detection
  - story-suggestion
  - weasel-word
when_to_use: "Spec requirements."
user-invocable: true
context: fork
agent: confluence-spec-analyst
owner: confluence
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["confluence"]
default_enabled: false
---

# mk:confluence-spec-analyst

Forks to the `confluence-spec-analyst` agent. Read-only on the Confluence side: the agent may write only the local Spec Research Report and never writes to Confluence.

## Triggers

- "analyze spec for 12345"
- "extract requirements from this confluence page"
- "spec research on https://acme.atlassian.net/wiki/spaces/ENG/pages/12345/Q3-Roadmap"
- "what are the gaps in PAGE-ID 12345"

## Operations

`analyze PAGE-ID [--include-children N] [--no-images] [--with-commands]`. `--include-children` takes at most 5 child pages (default depth 1), to stay inside the Cloud rate limit; the user must raise either explicitly. `--with-commands` is opt-in: the default report has suggestions only.

## See also

- Agent: `../../agents/confluence-spec-analyst.md`
- Shared: `../confluence/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/spec-analysis-patterns.md` — gap-detection heuristics + weasel-word inventory
  - `references/report-template.md` — the Spec Research Report skeleton
  - `references/integration-with-planning-engine.md` — how planning-engine consumes the report
- Peer leaves: `mk:confluence-page` (raw CRUD), `mk:confluence-search` (CQL search), `mk:planning-engine` (consumes this report via `--spec` flag)

## Handoff

`mk:planning-engine` reads the report via `--spec <report-path>`; run this skill first and pass it the path.

## Gotchas

- Every run writes a fresh report; the source-page hash in it shows whether the page changed.
- Without `mk:multimodal` the Image / Diagram Findings section is omitted with a `[NO_MULTIMODAL]` flag and the rest proceeds.

---
title: "mk:confluence-spec-analyst"
description: "Deep spec analysis of a Confluence page (+ children + images). Produces a structured Spec Research Report. Forks the confluence-spec-analyst agent."
---

# mk:confluence-spec-analyst

## What This Skill Does

Forks the `confluence-spec-analyst` agent to read a Confluence spec page, traverse children up to a depth cap, run gap-detection heuristics, and emit a **structured Spec Research Report** for human review. Read-only at the Confluence side — the agent has `Write` tool privilege ONLY for persisting the report locally; it never writes to Confluence itself.

The fetch path uses `--representation atlas_doc_format` (ADF) piped through the shared macro-aware walker (`scripts/adf-to-md.sh`) so panels, decisions, task lists, mentions, expand sections, and Smart Link / Figma embeds survive as explicit markdown labels (`> [INFO]`, `> [DECISION]`, `- [ ]`, `<details>`, `@name`, `![alt](attachment:<id>)`). Macro labels are first-class signals for downstream gap detection.

## When to Use

- **Triggers:** "analyze spec for 12345", "extract requirements from this confluence page", "spec research on URL", "what are the gaps in PAGE-ID 12345"
- **NOT for:** raw page CRUD ([`mk:confluence-page`](/reference/skills/confluence-page)), ticket complexity scoring or sprint planning ([`mk:planning-engine`](/reference/skills/planning-engine)).

## Operations

```
analyze PAGE-ID [--include-children N] [--no-images] [--with-commands]
```

| Flag | Default | Effect |
|---|---|---|
| `PAGE-ID` | required | Numeric page id, or full Confluence URL parsed to id |
| `--include-children N` | 1 | Depth of child traversal — hard cap of 5 children to stay inside the Cloud rate limit |
| `--no-images` | off | Skip attachment download + multimodal analysis |
| `--with-commands` | off | Append `mk:jira-issue create` suggestions to the report (NOT auto-executed) |

## Report Structure

Every report includes:

1. TL;DR (3 sentences max + headline)
2. Source metadata (page id, title, space, version, author, lastModified)
3. Requirements (REQ-F-* and REQ-NF-* with page-anchor citations)
4. Acceptance criteria (testable items derived from `taskList` macros and explicit "must" statements)
5. Decisions & Constraints (from `> [DECISION]` blocks)
6. Gaps (GAP-*), Ambiguities (AMB-*), Conflicts (CONFLICT-*)
7. Open Questions (incl. `[UNHANDLED_NODE: <type>]` surfacings from the walker)
8. Suggested User Stories
9. Image / Diagram Findings (or `[NO_MULTIMODAL]` if the multimodal skill is absent)
10. Source page hash (for staleness detection on re-runs)

## Domain References

- `references/spec-analysis-patterns.md` — gap-detection heuristics + weasel-word inventory + macro-label patterns
- `references/report-template.md` — the Spec Research Report skeleton
- `references/integration-with-planning-engine.md` — how planning-engine consumes the report

## Handoff

- [`mk:planning-engine`](/reference/skills/planning-engine) — accepts `--spec <report-path>`. Run spec-analyst first, then pass the resulting report path.
- [`mk:intake`](/reference/skills/intake) — recognizes Confluence URLs / page IDs as a 5th source; recommends spec-analyst for deeper analysis.
- [`mk:jira-issue`](/reference/skills/jira-issue) `create` — human runs manually from the report's Suggested Commands when invoked with `--with-commands`.

## Peer Leaves

[`mk:confluence-page`](/reference/skills/confluence-page) (raw CRUD) · [`mk:confluence-search`](/reference/skills/confluence-search) (CQL search)

## Agent

[`confluence-spec-analyst`](/reference/agents/confluence-spec-analyst) — A only (untrusted page content). NOT B (token stays in the wrapper), NOT C (read-only at Confluence; writes only to local disk). 1/3 — Rule of Two compliant.

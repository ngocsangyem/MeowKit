---
description: "Decompose a spec/PRD into sized user stories with optional Jira ticket creation and codebase-aware tech breakdown. Stops before plan creation."
---

# /mk:breakdown — Spec to stories + optional tickets + tech breakdown

## When to use

Use when you have a Confluence page, Jira epic, GitHub issue, Linear ticket, or pasted PRD and want: (1) refined user stories, (2) optional Jira tickets, (3) codebase-aware tech breakdown report. Stops before plan creation.

- NOT for sprint capacity planning → `mk:planning-engine`
- NOT for bulk ticket creation → `mk:story-sizer --auto-create`
- NOT for implementation planning → `/mk:plan`
- NOT for single-ticket analysis or RCA → `mk:intake` or `mk:jira-analyst`

## Usage

```
/mk:breakdown <source> [--source confluence|jira|github|linear|paste] [--project <KEY>]
```

- `<source>`: Confluence URL/page-id, Jira KEY, GitHub issue URL, Linear URL, file path, or omit when using `--paste`.
- `--source`: Override auto-detection.
- `--project <KEY>`: Required when Jira creation confirmed in Phase D. If absent at first Create, Phase D aborts; spec analysis is preserved; Phase E emits a re-run footer.

**Idempotency:** Same-day re-run overwrites `breakdown-{YYMMDD}-{slug}.md`. Tickets already in Jira remain — pick "Skip" for existing stories on re-run.

## Purpose

Analyze a spec or issue source, derive user stories, optionally create Jira tickets, optionally run tech planning, and write a breakdown report.

## Dispatch

Use task-specific skills instead of duplicating their procedures here:

1. **Source analysis**
   - Confluence sources → `mk:confluence-spec-analyst`
   - Jira/GitHub/Linear/paste/file sources → `mk:intake`
2. **Story decomposition** — extract story title, acceptance criteria, complexity hint, and open questions from the source analysis.
3. **Optional ticket creation** — for each accepted story, use `mk:jira-issue`; require `--project <KEY>` before creating tickets.
4. **Optional tech breakdown** — after tickets exist, use `mk:planning-engine plan --tickets <keys>`.
5. **Report write** — save `tasks/reports/breakdown-{YYMMDD}-{slug}.md` or the active plan's `research/` directory.

## Safety notes

- Missing Jira configuration skips ticket creation; spec analysis and report generation still proceed.
- Confluence shortlinks are not auto-resolved; request the canonical page URL or page ID.
- Never create tickets without per-story confirmation.
- If source analysis fails or returns no stories, stop without writing a partial report.
- Quote file paths and report paths that may contain spaces.

## Output

Print the report path, story count, ticket keys created, non-fatal warnings, and the suggested next planning command.

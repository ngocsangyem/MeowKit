---
title: "mk:story-sizer"
description: "Pre-ticket Fibonacci sizing for a paste-mode batch of user stories. Default writes an advisory Story Sizing Report. Opt-in --auto-create delegates ticket creation behind a single confirmation gate."
---

# mk:story-sizer

## What This Skill Does

Sizes a batch of suggested user stories **before** Jira tickets exist. v1 ships paste-mode only — the user pastes a markdown block of stories, the skill applies deterministic heuristics, and a Story Sizing Report is written to `tasks/reports/`. Default mode is advisory only. Opt-in `--auto-create` delegates ticket creation to `mk:jira-issue` + `mk:jira-collaborate` behind a single batch-level confirmation gate.

## When to Use

- **Triggers:** "size these stories", "rough-size from spec", "pre-ticket sizing for these user stories", "Fibonacci size this story list".
- **NOT for:** single-ticket estimation ([`mk:jira-estimator`](/reference/skills/jira-estimator)) · sprint capacity ([`mk:planning-engine`](/reference/skills/planning-engine)) · ticket creation alone ([`mk:jira-issue`](/reference/skills/jira-issue)).

## Commands

| Mode | Invocation | Side effects |
|------|-----------|--------------|
| Default | `/mk:story-sizer --paste [--scout] [--story <id>]` | Writes a Story Sizing Report. **No Jira calls.** |
| Auto-create | `/mk:story-sizer --paste --auto-create --project <KEY> [--epic <KEY>]` | After dry-run + single batch confirmation, creates tickets via peer skills. |

`--scout` extracts in-session scout output if present; if not, the skill prompts the user to run `/mk:scout` first and exits. It **never auto-invokes** `/mk:scout`.

## Inputs

Strict paste-mode markdown template:

```text
story: <title>
description: <body — optional>
ac:
  - <ac1>
  - <ac2>
---
story: <next title>
...
```

Schema, validation rules, and failure modes (`[NO_ACS]`, `[MALFORMED_INPUT]`, length caps, whitespace tolerance) are documented at `.claude/skills/story-sizer/references/input-adapter.md`. The parser computes a SHA-256 over the verbatim paste body and stamps every record with it — the auto-create source-consistency check relies on this.

## Outputs

A markdown report at `tasks/reports/story-sizing-{YYMMDD}-{slug}.md`. Per-story sections include:

- Title, sized points + complexity, uncertainty band, drivers score breakdown.
- Description blockquote.
- Acceptance criteria list.
- Inconsistencies (when detected).
- Codebase signals (only when `--scout` extracted output).
- Definition of Ready (only when `agile-story-gates.md` is loaded).
- Split suggestion (advisory, for 13+ pt or multi-concern stories).
- REFUSED notice (for stories with no sizeable signal).
- Suggested `mk:jira-issue create` command using the v1 field whitelist.

Plus a summary table listing every story at a glance. Idempotency is by `source_hash` — re-running on an identical paste prompts before overwriting.

## Auto-create Safety Gates

`--auto-create --project <KEY>` runs 5 pre-flight checks, in order, ABORTing the batch on any failure:

1. **NO_ACS** — any story missing acceptance criteria → ABORT.
2. **Rule-1 injection patterns** — Atlassian summary / description fields scanned against the always-loaded inventory at `.claude/rules/injection-rules.md` (mirrored at `references/injection-patterns.md`). Any match → ABORT, offending pattern quoted.
3. **Length cap** — summary ≤255 chars, description ≤5000 chars.
4. **Duplicate suspect** — `mk:jira-search` JQL `project = <KEY> AND summary ~ "<suggested-summary>"`; any match aborts the **entire batch**.
5. **Source-body hash mismatch** — recomputes the SHA-256 of the current paste and compares against the report header.

All five pass → markdown dry-run table renders → single `AskUserQuestion` confirmation → per-ticket two-call sequence:

- **Call A:** `/mk:jira-issue create --project <KEY> --type Story --summary "..." --story-points <N> --description "..." [--epic <KEY>] [--components <list>] [--labels <list>]`
- **Call B:** `/mk:jira-collaborate add-comment <NEW-KEY> --body "<audit comment>" --internal` (team-only; never `--public`)

Mid-batch Call A failure stops the batch with a manual-cleanup hint (`/mk:jira-lifecycle delete <KEY>` per stranded ticket). Mid-batch Call B failure logs a WARN row and continues.

## v1 Field Whitelist

The only flags reaching `mk:jira-issue create` are: `--project`, `--type`, `--summary`, `--story-points`, `--description`, plus optional `--epic`, `--components`, `--labels`. Forbidden in v1 (deferred): assignee, priority, sprint, blocks, and custom-field overrides.

Phase 6 rejects forbidden flags at gating time; Phase 7 re-strips them at call build time as defense in depth.

## Skill Rule of Two Compliance

Per `.claude/rules/injection-rules.md` Rule 11:

- Default mode: 1-of-3 — story-sizer reads untrusted paste content and writes a local report. No sensitive data; no Jira state change.
- Auto-create mode: 2-of-3 — story-sizer still does not handle credentials. Ticket creation is delegated to peer skills (`mk:jira-issue`, `mk:jira-collaborate`) which own the credentialed wrapper. Story-sizer never invokes `jira-as` directly.

Never 3-of-3.

## Audit Comment Customization

Default comment body:

```text
Initial sizing from mk:story-sizer: {{points}} points (heuristic).
Source: {{report_path}} §{{story_id}}.
Pending team refinement via mk:jira-estimator.
```

Override path via `MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE` env var (must contain the three placeholders above). Legacy `MEOW_*` prefix is NOT honored.

## Gotchas

- The `source_hash` is SHA-256 of the *exact* paste body. Editing the paste locally between sizing and `--auto-create` triggers a source-mismatch abort — re-paste and re-run `--paste`.
- `--scout` does not auto-invoke `/mk:scout`. Run scout first when you want codebase signals.
- DoR advisory only renders when `.claude/rules-conditional/agile-story-gates.md` is loaded for the session.
- No `--from-spec` / `--from-intake` adapter in v1. Use paste mode (copy the suggested-user-stories table out of `mk:confluence-spec-analyst` output and reformat to the paste template).
- Blocks relationships are not propagated in v1. Link dependencies manually via `mk:jira-relationships` after creation.
- Duplicate detection uses Jira's `~` token matching — false positives are possible. Prune or close the matching ticket, then re-run.

## See Also

- Agent: [story-sizer](/reference/agents/story-sizer)
- Peer execution: [`mk:jira-issue`](/reference/skills/jira-issue), [`mk:jira-collaborate`](/reference/skills/jira-collaborate)
- Peer intelligence: [`mk:jira-evaluator`](/reference/skills/jira-evaluator), [`mk:jira-estimator`](/reference/skills/jira-estimator), [`mk:planning-engine`](/reference/skills/planning-engine)
- Workflow: [Spec → PR walkthrough](/workflows/spec-to-pr-walkthrough) — Step 3.5

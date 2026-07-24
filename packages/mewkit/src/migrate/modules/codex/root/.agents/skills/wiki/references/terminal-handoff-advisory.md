# Terminal Wiki Handoff (Advisory)

Shared contract for knowledge-producing skills. After a skill's normal terminal
artifact is already written, the skill MAY hand it to the wiki so durable metadata
can be proposed into the gated pipeline. This is advisory: it adds NO gate, NO
prompt, and NEVER changes the skill's existing next-step flow.

## Non-negotiables

- Run this ONLY after the skill's final artifact already exists on disk. Never instead of it.
- Pass ONLY that artifact's path via `--from`. Never pass transcripts or raw tool output.
- `wiki handoff propose` can create a `WikiCandidate` — it can NEVER write a canonical page. Do NOT call `wiki approve`; approval is human-only.
- Fail open. If the command errors or no wiki slug resolves, print a one-line advisory and let the flow complete normally. A handoff failure must not fail the skill.

## Slug resolution

Resolve the wiki slug in this order; never invent one and never create a wiki:

1. If `MEOWKIT_WIKI_SLUG` is set, use it.
2. Else if exactly one `tasks/wikis/<slug>/wiki.json` exists, use that slug.
3. Else skip the auto-propose and print the exact command for the user to run with `--slug <slug>`.

## Command shape

```bash
npx mewkit wiki handoff propose \
  --skill <skill-name> \
  --from <terminal-artifact-path> \
  --slug <resolved-wiki-slug> \
  <signal-flags>
```

Index refresh is NOT part of this hot path. A freshly proposed candidate is not a
page, so it does not appear in `wiki context` / `search` until a human approves it.
Mention `npx mewkit wiki reindex` only as an optional advisory line for refreshing
the relational `wiki_handoff` / `wiki_candidate` tables — do not run it automatically
in every flow.

## Signal flags (conservative — omit when unsure)

- `--explicit-intent` — the user approved/chose this artifact as a durable plan, report, or verdict.
- `--verified-outcome` — implementation, verification, or review completed (not merely planned).
- `--recurring-friction` — the artifact documents a repeated failure, flaky pattern, or root cause.
- `--novelty-delta N` — only when the skill already computed novelty; otherwise omit.

## Class behavior (from the handoff profile registry)

- **A (required)** — always run the advisory at the terminal step; the salience gate still decides whether a candidate is created.
- **B (conditional)** — prefer `wiki handoff suggest` (read-only) first; only print/run `propose` when there is an explicit project-specific signal.
- **C / unregistered** — do nothing; the registry returns class `none` and proposes nothing.

## Examples

```bash
# Plan artifact (explicit user intent):
npx mewkit wiki handoff propose --skill mk:plan-creator --from tasks/plans/<dir>/plan.md --slug <slug> --explicit-intent

# Verdict artifact (verified outcome; only when WARN/FAIL is worth recall):
npx mewkit wiki handoff propose --skill mk:review --from tasks/reviews/<file>.md --slug <slug> --verified-outcome

# Root-cause report (verified + recurring):
npx mewkit wiki handoff propose --skill mk:fix --from tasks/reports/fix-<id>.md --slug <slug> --verified-outcome --recurring-friction
```

If no unique slug resolves, print the matching command above with a literal
`--slug <slug>` placeholder and a one-line note, then continue normally.

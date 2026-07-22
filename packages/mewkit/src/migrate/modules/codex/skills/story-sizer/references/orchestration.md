# Orchestration

How `mk:story-sizer` wires the paste adapter, scorer, and writer into a single default-mode flow. SKILL.md keeps the routing terse; the operational detail lives here.

## End-to-End Default Mode

```text
the story-sizer skill --paste [--scout] [--story <id>] [--slug <slug>]

1. Parse args at the skill orchestration layer.
2. Resolve scout context per "Scout extraction" below.
3. stop and ask the user in chat (or read stdin) for the paste body.
4. Run scripts/parse-paste-stories.py < paste-body → {records, source_hash, errors}.
5. Pre-flight validation:
   - All records flagged [NO_ACS] → ABORT with usage hint.
   - --story <id> provided but no record matches → ABORT.
   - errors[] present → surface them to the user; if zero records, ABORT.
6. Build score-story payload {records, scout_context, agile_loaded}.
7. Run scripts/score-story.py → enriched records.
8. Build write-sizing-report payload (include source_path, source_hash,
   scout_used, slug, records).
9. Run scripts/write-sizing-report.py.
   - Exit code 0 → report written. Path printed to stdout.
   - Exit code 2 → idempotency hit. Show diff prompt; the caller decides.
10. Print one-line summary + next steps.
```

## Scout Extraction (mirrors mk:planning-engine)

```text
if --scout flag set:
    if scout output already in session context:
        extract structured signals → pass inline as `scout_context`
    else:
        prompt the user: "Run the scout skill first, then re-invoke
        the story-sizer skill --paste --scout."
        exit cleanly (do NOT auto-invoke the scout skill)
else:
    scout_context = null
    flag in report header: [NO_CODEBASE_CONTEXT]
```

Story-sizer NEVER auto-invokes `the scout skill`. This preserves the trust boundary documented in `mk:planning-engine/SKILL.md` and avoids skill-to-skill invocation forbidden by `.agents/skills/rule-skill-authoring-rules.md`.

## Agile Detection

`agile_loaded` is set to `true` only if `mk:agent-detector` reports that `.agents/skills/rule-agile-story-gates.md` is loaded for the current session. The scorer then emits a `dor_status` block per record; when `false`, the field is omitted silently.

## Filtering with --story <id>

When `--story <id>` is provided:

1. Filter parsed records to those matching `record["id"] == id` (case-sensitive).
2. If no match → ABORT with: "No story with id `<id>` in this paste. Available ids: {list}."
3. Pass only the filtered record(s) downstream.

The summary table still renders only the filtered set.

## Failure Surfacing

Adapter errors (`[MALFORMED_INPUT]`) are surfaced inline before any sizing happens — the user sees the line number and can re-paste. Sizing refusals (e.g., `[NO_ACS]`, `no signal`) are surfaced in the report under a `### REFUSED` heading per story.

## Telemetry / Logging

Default mode emits ZERO telemetry. No outbound calls, no log writes outside `tasks/reports/`. The skill's only state change in default mode is writing the report markdown.

## Auto-create Handoff

Auto-create mode (`--auto-create --project <KEY>`) extends this flow with:

1. Pre-flight checks per `references/auto-create-gating.md`.
2. Dry-run table render.
3. Single batch-level `stop and ask the user in chat` gate.
4. Per-ticket two-call sequence per `references/auto-create-execution.md`.

See those files for the safety design — none of it lives in this orchestration doc to keep default-mode reasoning narrow.

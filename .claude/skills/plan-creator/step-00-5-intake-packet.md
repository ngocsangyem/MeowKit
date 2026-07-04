# Step 0.5: Intake Packet (Conditional)

## Contents

- `references/plan-intake-packet.md` — packet contract: purpose, schema, quality rules, boundaries

Consolidate 2+ pre-existing external artifacts into one Plan Intake Packet before
research/drafting. Runs AFTER step-00 (mode already selected — this step never
changes the mode), BEFORE step-01 (full workflow) or step-03 (fast workflow).

## Instructions

### 0.5a. Activation Check

Count **external artifact paths** in the invocation / task description: readable
file paths supplied by the user or an upstream skill (office-hours, brainstorming,
planning-engine, confluence-spec, intake, jira-analyst reports, scout summaries,
spec docs). Files that plan-creator's own steps will generate this run do NOT count.

- **< 2 sources** → set `intake_packet_path = none`, `intake_sources_count = {N}`,
  append the activation-log line (0.5d) with `activated: false`, and continue to
  the next step per the workflow. Planning behavior is unchanged — no packet;
  the only side effect on this path is the activation-log line itself.
- **≥ 2 sources** → continue to 0.5b.

### 0.5b. Build the Packet

Read `references/plan-intake-packet.md` and fill its 6-block schema:

1. Read each artifact (respect Tool Output Limits: `offset`/`limit` for files
   > 500 lines); summarize into the packet, never paste raw content.
2. Every load-bearing claim gets `from: <path>` or `[ASSUMPTION]`.
3. For the Routing block, invoke `mk:scale-routing` on the task description. If
   its recommendation conflicts with the mode step-00 already selected, record
   BOTH signals in the packet's Routing block — do not change the mode here.
4. Keep the packet under 120 lines.

### 0.5c. Persist

Write the packet to `.claude/session-state/plan-creator-intake-packet.md`. Set:

- `intake_packet_path` — the path above
- `intake_sources_count` — number of external artifacts consolidated

Step-03 later moves the packet into `{plan_dir}/research/plan-intake-packet.md`.

### 0.5d. Activation Log

Append ONE JSONL line to `${CLAUDE_PLUGIN_DATA}/plan-creator/intake-activations.jsonl`
(evidence for the dead-weight audit and for any future decision to split this into
its own skill):

```bash
if [ -n "${CLAUDE_PLUGIN_DATA:-}" ]; then
  mkdir -p "${CLAUDE_PLUGIN_DATA}/plan-creator"
  printf '{"date":"%s","sources_count":%d,"mode":"%s","activated":%s}\n' \
    "$(date +%Y-%m-%d)" "{N}" "{planning_mode}" "{true|false}" \
    >> "${CLAUDE_PLUGIN_DATA}/plan-creator/intake-activations.jsonl"
fi
```

Fail-open: if `CLAUDE_PLUGIN_DATA` is unset or the write fails, print one warning
line and continue — logging never blocks planning.

## Output

- `intake_packet_path` — packet path, or `none` when skipped
- `intake_sources_count` — integer count of external artifacts
- Print: `"Intake packet: {activated|skipped} ({N} external sources)"`

## Next

If `planning_mode = fast` or `spike` → read and follow `step-03-draft-plan.md`.
Otherwise (hard/deep/parallel/two/product-level) → read and follow `step-01-research.md`.

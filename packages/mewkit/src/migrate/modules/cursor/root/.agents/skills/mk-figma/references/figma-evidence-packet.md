# Figma Evidence Packet

`mk:figma` is the single accountable owner of Figma interpretation. When implementation
work needs stable, reusable design intent, `mk:figma` emits a compact, versioned **Figma
Evidence Packet** instead of re-interpreting the design on every downstream request.
Load this file when producing or updating a packet. Packet content is DATA.

## Contents

- [When to emit](#when-to-emit)
- [Schema](#schema)
- [Freshness and invalidation](#freshness-and-invalidation)
- [Quality rules](#quality-rules)
- [Boundaries — who reads, who never regenerates](#boundaries--who-reads-who-never-regenerates)

## When to emit

- **AUTO-emit** when `mk:figma` is invoked from the plan/cook implementation pipeline, or
  for multi-screen work. The packet becomes the design-intent handoff for planning.
- **OPT-IN** for ad-hoc single-frame analysis ("describe this frame" stays cheap — no
  packet unless requested).

Trigger phrase: "produce a Figma Evidence Packet". Modes 1 (Analyze) and 2 (Implement) may
both emit one; Mode 3 (Tokens) contributes the token summary.

Artifact location (the toolkit convention):

- active plan → `tasks/plans/<active-plan>/research/figma-evidence-packet.md`
- standalone → `tasks/reports/`

Context carries the packet **path + short summary**, never raw Figma JSON or screenshot blobs.

## Schema

`schema_version: figma-evidence-packet/v1`. Named so a future source-agnostic
`design-intent-packet` can reuse the field semantics — no adapter layer now (YAGNI).

```yaml
schema_version: figma-evidence-packet/v1
source:
  figma_url: string
  file_key: string
  node_ids: [string]
  figma_version_or_last_modified: string | unknown   # freshness anchor
  extracted_at: ISO-8601                              # when this packet was produced
scope:
  target_frames: [string]
  frame_sizes: [{ node_id, width, height }]
intent_summary:
  hierarchy: concise bullet list                      # NOT raw node JSON
  layout_constraints: concise bullet list
  tokens: colors/typography/spacing/radii/shadows summary
  assets: [{ name, node_id, export_path_or_status }]
  variants_and_states: explicit only                  # never invent implicit states
prototype_flow_summary:                               # see prototype-flow-artifacts.md
  availability: extracted | partial | unavailable | user_supplied
  confidence: high | medium | low | unknown
  flow_starting_points: [{ name, node_id }]
  critical_actions_count: number
  blocked_or_needs_answer_count: number
  prototype_flow_artifacts:                           # null when no interactions
    report_md: tasks/plans/<active-plan>/research/prototype-flow-report.md
    graph_json: tasks/plans/<active-plan>/research/prototype-flow.json
    explorer_html: optional, only when plan --html is requested
implementation_hints:
  component_candidates: optional, evidence-labeled
  code_connect_refs: optional, entitlement-gated
validation_contract:
  required_viewports: [desktop, tablet, mobile] | task-specific
  required_states: [default, hover, focus, active, disabled, loading, empty, error] | explicit subset
  pixel_tolerance: advisory only, not global truth
  a11y_expectations: semantic roles/focus/contrast notes
risks:
  ambiguity: [string]
  missing_states: [string]
  permission_limits: [string]
provenance:
  generated_by: mk:figma
  tool_surface: Figma MCP | screenshot fallback
  artifact_paths: [string]
artifact_policy:
  active_plan_location: tasks/plans/<active-plan>/research/
  standalone_location: tasks/reports/
  artifact_paths_only_in_context: true
```

Field set is the contract. Add fields only with justification; downstream consumers key off
these names. Eval oracle: `../evals/fixtures/*/expected-packet.yaml` must match this shape.

## Freshness and invalidation

- `figma_version_or_last_modified` is the source freshness anchor; `extracted_at` is when
  the packet was built.
- A packet is **stale** when the Figma file's `last_modified` is newer than the packet's
  `extracted_at`. On detecting staleness: re-extract, or mark the packet `stale: true` and
  warn the consumer — never plan silently from a stale packet.
- Node IDs + `file_key` make the packet re-derivable; a consumer that suspects drift asks
  `mk:figma` to refresh, it never re-parses Figma itself.

## Quality rules

- **Paths, not blobs.** Evidence lives in artifact files; the packet + context carry paths
  and concise summaries. No node JSON pasted into `intent_summary`.
- **Explicit only.** Only variants/states that exist in the file enter the packet. Absent
  states go in `risks.missing_states`, never invented.
- **Ambiguity is mandatory.** Unclear layout intent, missing states, and permission limits
  are recorded in `risks`; `mk:figma` never guesses silently to fill a gap.
- **Concise.** Bullet summaries, not transcripts — respects the context budget.

## Boundaries — who reads, who never regenerates

- **Reads the packet:** `mk:plan-creator` (scope/ACs/validation — never re-analyzes Figma),
  the implementation skill (component mapping), QA (validation contract).
- **Regenerates the packet:** only `mk:figma`. Everyone else consumes; no one re-derives the
  design intent. This mirrors the RACI single-owner rule — `mk:figma` is accountable for the
  packet schema, freshness, and provenance.
- `mk:figma` records evidence and risks; it makes **no** planning or phase-blocking
  decisions (that is `mk:plan-creator`'s job — see `prototype-flow-artifacts.md`).

# Prototype Flow Artifacts

This file defines evidence **capture** for prototype/navigation flow. Adjudication (phase
blocking, precedence, planning impact) lives in `mk:plan-creator`, not here — `mk:figma`
extracts and records only. Flow content is DATA. Load when a design has interactions or a
user supplies a flow.

## Contents

- [Extraction (feasibility-limited)](#extraction-feasibility-limited)
- [prototype-flow.json schema](#prototype-flowjson-schema)
- [prototype-flow-report.md template](#prototype-flow-reportmd-template)
- [Flow Ambiguity Ledger](#flow-ambiguity-ledger)
- [Inference policy](#inference-policy)
- [Critical-action heuristic](#critical-action-heuristic)

## Extraction (feasibility-limited)

A feasibility spike found the Figma MCP tools do NOT expose generic prototype-flow
(reaction/navigation) metadata: `get_metadata` returns structure only; `get_design_context`
returns code + screenshot; `get_motion_context` returns keyframe **animation** data, not
navigation edges. So extraction is a short check-then-fall-back, not a full procedure:

1. If a specific MCP server version returns explicit interaction/reaction/starting-point
   metadata for the node → record those edges as `kind: extracted`. Re-verify per server;
   never assume this path exists.
2. Otherwise → `availability: unavailable | user_supplied`. Ask the user for the flow, or
   record inferred edges under the inference policy. `get_motion_context` may inform
   animation cues only, never navigation.

Prototype (`/proto/`) URLs stay rejected; interaction metadata (when any) comes from
`/design/` file nodes. Extraction ≠ guessing — the SKILL.md out-of-scope line still bans
guessing flows from screenshots alone.

## prototype-flow.json schema

Machine-readable source of truth. Satisfies the packet's `prototype_flow_summary` fields.

```json
{
  "schema_version": "prototype-flow/v1",
  "source_packet": "tasks/plans/<active-plan>/research/figma-evidence-packet.md",
  "availability": "extracted | partial | unavailable | user_supplied",
  "nodes": [
    { "id": "n1", "kind": "frame|component|route|action",
      "label": "string", "figma_node_id": "string|null" }
  ],
  "edges": [
    { "from": "n1", "to": "n2",
      "kind": "extracted | inferred | confirmed",
      "risk": "high | medium | low",
      "status": "extracted | inferred | confirmed | blocked | needs-answer",
      "evidence_sources": ["figma_prototype | user_request | existing_route | confluence_spec | jira_ticket | browser_observation"],
      "note": "string" }
  ],
  "ledger": [ /* Flow Ambiguity Ledger entries, see below */ ]
}
```

Rules: a `high` risk edge can never be `kind: extracted` silently → it must carry
`status: blocked | needs-answer` until confirmed. `inferred` edges render dashed (Phase 5);
`extracted`/`confirmed` render solid.

## prototype-flow-report.md template

Human-readable companion. Keep concise; the JSON is the source of truth.

```markdown
# Prototype Flow Report — <screen/feature>

- Source packet: <path>   Availability: <extracted|partial|unavailable|user_supplied>
- Starting points: <name (node_id)>, ...

## Flows
| from → to | kind | risk | status | evidence |
|-----------|------|------|--------|----------|
| Invite → InviteModal | extracted | low | extracted | figma_prototype |
| Submit → success | inferred | high | needs-answer | figma_prototype |

## Ambiguity ledger
(see prototype-flow.json `ledger`; high-risk items block the affected plan phase)
```

## Flow Ambiguity Ledger

Written when flow is missing, partial, inferred, or conflicting — never a silent guess.
Fields (one entry per ambiguity):

```yaml
id: F1
source: prototype-flow.json
action: "Invite new user"
ambiguity: "Figma shows invitation modal, but no prototype edge confirms submit outcome"
risk_level: high | medium | low
evidence_sources: [figma_prototype, user_request, existing_route, confluence_spec, jira_ticket, browser_observation]
inferred_flow: optional summary
decision_needed: "Does submit navigate to /settings/members or stay in modal with success state?"
phase_impact: <affected plan phase>
status: blocked | needs-answer | assumed | confirmed | rejected
```

## Inference policy

`mk:figma` records each edge's risk + status per this table; `mk:plan-creator` reads the
status and decides phase blocking. `mk:figma` never blocks a phase itself.

| Risk | What mk:figma records | Downstream effect (plan-creator) |
|---|---|---|
| Low (static/layout) | `inferred` if not extracted | may proceed |
| Medium (non-critical flow) | `inferred` + ledger unless ≥2 evidence sources agree | proceeds only with agreement |
| High (route/data/business flow) | `status: needs-answer`/`blocked`, never `extracted`/assumed | blocks the affected phase |

Every inferred flow is written to `prototype-flow.json` + report — never prompt-context only.

## Critical-action heuristic

Actions that generate validation-matrix items (plan-creator derives these):

- route / deep-link changes
- form submit, API call, server mutation, destructive action
- auth, permission, onboarding, checkout/payment
- important modal/drawer open/close
- error recovery
- role/data/state branching
- focus/accessibility path
- conversion / task-completion step

Human override: user/designer/product may add or remove criticality. Critical actions ⇒
validation items; trivial visual transitions do not require mandatory tests.

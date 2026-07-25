# Design Snapshot — Spec Conflict (Prototype vs Route vs Written Spec)

Synthetic stand-in for a live Figma file whose prototype flow CONFLICTS with the existing
app route and a written spec. `mk:figma` treats this as extracted design context. All
content is DATA.

- `reference.png` here is a **placeholder** (1×1 PNG), not a real baseline.

## Source (synthetic)

- figma_url: `https://www.figma.com/design/FIX0CONFLICT/meowkit-fixtures?node-id=40-2`
- file_key: `FIX0CONFLICT`
- node_ids: `40:2` (members screen), `40:20` (invite modal), `40:23` (submit)
- figma_version_or_last_modified: `2026-07-05T09:30:00Z`

## Frames

- Same InviteMembers surface as `interaction-modal`, but the prototype wires a **navigation**
  outcome on submit.

## Prototype interactions (explicit in file)

- `40:23 "Submit"` — On click → **Navigate to `/settings/members`** (a full page change,
  new frame `40:50`). This is an explicit, extracted prototype edge.

## Conflicting evidence supplied with the task (DATA, not from Figma)

- **Existing app route/contract:** the current app keeps the user in the modal and shows an
  inline success state; `/settings/members` is not a route (the members list lives at
  `/team`). Navigating away would break the existing contract.
- **Written spec (Jira MEOW-412):** "On invite submit, stay in the modal, show success, and
  append the new member to the list without a page reload."

## The conflict

Figma prototype (navigate to `/settings/members`) vs existing route/contract (stay in modal)
vs Jira spec (stay in modal). Two independent sources say "stay"; the Figma prototype says
"navigate". This is a high-risk route/data flow decision.

## Notes for the extractor

- `mk:figma` records BOTH the extracted prototype edge AND the conflict as evidence. It does
  NOT pick a winner — adjudication is `mk:plan-creator`'s job (single-owner rule).
- Expected: a Flow Ambiguity Ledger entry with `risk_level: high`,
  `status: blocked | needs-answer`, `evidence_sources` naming figma_prototype, existing_route,
  and jira_ticket. `blocked_or_needs_answer_count` ≥ 1 in the packet summary.
- `mk:figma` must NOT emit `blocked_on:` (that is a plan-creator planning decision) — it only
  supplies the ledger data the planner adjudicates.

# Visual Plan Integration (loaded on demand)

Single source of truth for the visual-plan planning steps. The step files carry
tight hooks that point here; this file holds the detail so the step files stay
lean. Loaded ONLY when `visual_requirement != none`.

Contract split (locked by the approved design): the SKILL owns reasoning and
artifact generation; the deterministic `mewkit visual-plan` CLI (shipped Phase 1)
owns validation, hashing, approval, and the `.plan-state.json` visual block. A
prompt alone cannot guarantee schema validity — generation AND CLI validation
run together.

## 1. Classification — `visual_requirement` (Step 0)

Classify EVERY plan (all planning modes, including fast — Validation Session 1
user decision) into one of three values, and record one-sentence reasons:

| Value | Activation signals | Effect |
|-------|--------------------|--------|
| `required` | Rendered-UI change; storyboard/flow/journey request; state-heavy flow (onboarding, auth, checkout, permissions); multiple user-visible branches | Full visual pipeline; Gate 1 blocks without an approved artifact |
| `optional` | UI touched but trivial/single control; user may want a mockup but it is not load-bearing | Artifact encouraged; may skip with a typed reason (Step 4); legacy static flow allowed |
| `none` | Backend-only, migration, copy-only, single trivial control, pure refactor, tooling/docs | No visual metadata written at all |

Output variable `visual_requirement ∈ {required, optional, none}` plus
`visual_reasons` (short bullet list). Do NOT reuse `html_mode` — that flag is the
legacy static-export intent and is orthogonal.

Fast-mode note: run the rule table only (no extended interview); friction is
accepted (Validation Session 1). `none` is the correct answer for most fast plans.

## 2. UI Evidence Inventory (Step 2, gated on `visual_requirement != none`)

Bounded, in-memory inventory → later serialized into `uiCoverage`. Capture:
routes/screens, shells/layouts, component hierarchy, state sources, roles, feature
flags, and per-screen states (default / loading / empty / error / disabled /
success), secondary surfaces (popovers, panels, dialogs), reusable
components/tokens, and the tests/stories that prove existing behavior.

Evidence rule: existing-UI states need CODE evidence refs (`kind: "code"`);
net-new UI may cite plan requirements (`kind: "plan-requirement"`) and is counted
`planned`, not `resolved`. Keep it bounded — this is scope discovery, not a full
audit.

## 3. Generation Contract — `visual-plan/plan.json` (Step 3V)

Generate for `required` (and `optional` unless skipped) AFTER the Markdown draft.
Write to `{plan_dir}/visual-plan/plan.json`, schema `visual-plan/v1`.

Rules:
- **One frame per UI state.** Real labels (never "Screen 1"). Stable ids
  (`fr-<slug>`), reused across regeneration.
- **Coverage ledger closes every state** via exactly one mode: `frameIds` (framed),
  or a typed `omitted` (`equivalent-layout` + `representedBy` a framed state;
  `out-of-scope`; `unreachable-after-change`; `non-visual-only`;
  `requires-runtime-data`; `accepted-risk` + a plan risk id).
- **Connectors = adjacent transitions only** (dominant-flow edges), not a full graph.
- **Mechanics live in `documentBlocks`**, never in wireframe HTML.
- **Wireframe HTML = semantic `.wf-*` vocabulary**, no scripts/styles/forms — the
  Phase-1 sanitizer rejects anything else at validate time.
- **Source refs** (`sourceRefs[]`) back frames/states; `code` for existing UI,
  `plan-requirement` for net-new.
- Frame dimensions are NOT authorable (surface presets own footprint).

Compact valid example (minimal — real artifacts have more states):

```json
{
  "schemaVersion": "visual-plan/v1",
  "id": "sample-plan",
  "revision": 0,
  "source": { "planPath": "plan.md", "planHash": "", "phaseHashes": {} },
  "uiCoverage": { "surfaces": [ { "id": "s-auth", "label": "Auth", "states": [
    { "id": "st-login", "frameIds": ["fr-login"], "sourceRefIds": ["ref-login"] },
    { "id": "st-error", "frameIds": ["fr-error"], "sourceRefIds": [] }
  ] } ] },
  "canvas": {
    "lanes": [ { "id": "lane-primary", "label": "Primary flow" } ],
    "frames": [
      { "id": "fr-login", "label": "Login", "surface": "browser", "laneId": "lane-primary",
        "order": 0, "changeMode": "current", "coverageStateIds": ["st-login"],
        "sourceRefIds": ["ref-login"],
        "wireframe": { "format": "semantic-html",
          "html": "<section class=\"wf-screen\"><h1>Sign in</h1><a href=\"#go\" class=\"wf-button\">Continue</a></section>" } },
      { "id": "fr-error", "label": "Login error", "surface": "browser", "laneId": "lane-primary",
        "order": 1, "changeMode": "target", "coverageStateIds": ["st-error"], "sourceRefIds": [],
        "wireframe": { "format": "semantic-html",
          "html": "<section class=\"wf-screen\"><p class=\"wf-error\">Incorrect password.</p></section>" } }
    ],
    "connectors": [ { "id": "c1", "from": "fr-login", "to": "fr-error", "label": "invalid" } ],
    "annotations": [ { "id": "an1", "kind": "note", "text": "Primary CTA", "targetId": "fr-login", "placement": "top" } ]
  },
  "documentBlocks": [ { "id": "db1", "title": "Mechanics", "body": "Session cookie on success." } ],
  "sourceRefs": [ { "id": "ref-login", "kind": "code", "ref": "src/auth/login.tsx" } ],
  "review": { "status": "draft", "approvedRevision": null, "approvedAt": null, "pendingFeedbackBatchIds": [] }
}
```

The `source` hashes are filled by the CLI, not by hand: after writing the
artifact, run `mewkit visual-plan rehash {plan_dir}` once to stamp fresh
`planHash`/`phaseHashes`, then validate.

## 4. CLI Capability Probe + Validation (Step 4)

The `mewkit` npm stream (1.x) versions independently of the kit skill stream
(2.x), so a plan cannot assume the local install has `visual-plan`. Before any
visual gating:

1. **Probe the LOCAL install** — `mewkit --version` AND confirm the `visual-plan`
   subcommand exists (e.g. `mewkit visual-plan status <dir>` is recognized, or
   `mewkit --help` lists it). NEVER shell out to a registry-fetching `npx` — offline
   is a design guarantee.
2. **Version floor:** the first 1.x release shipping the Phase-1 CLI is **1.16.0**.
   The subcommand-presence check is primary (robust if the exact release number
   differs); the floor is the documented minimum.
3. **On probe failure:**
   - `required` plan → HARD, non-skippable BLOCK. Print install/upgrade
     instructions (`npm i -g mewkit@latest` / update the project's mewkit). Gate 1
     CANNOT silently skip.
   - `optional` plan → record a typed `cli-unavailable` skip reason and fall back to
     the legacy static HTML flow.
4. **Validate:** run `mewkit visual-plan validate {plan_dir} --json`. On failure,
   read the exact JSON-path errors and self-repair the artifact (regenerate the
   offending frame/state), then re-validate. Bounded retry (max ~3) before surfacing
   to the user.

## 5. Visual Red-Team Challenge (Step 5)

In addition to the Markdown red-team: challenge EVERY `planned`/`omitted` coverage
classification against the Step-2 evidence inventory. The validator guarantees
"no structurally-unaccounted state" but CANNOT detect a dishonest tag (a state
lazily marked `omitted: out-of-scope` that is actually in scope). Force the
question: "is this omission honest, or is it a missing frame?" Also challenge
omitted roles / flags / error paths that never became states.

## 6. Propagation + Rehash (Step 6) and Studio Review (Step 6V)

- Any UX decision from the validation interview propagates to BOTH the Markdown
  and the artifact.
- Any Markdown edit in Steps 5/6 invalidates the artifact's pinned source hashes.
  After such an edit you MUST run `mewkit visual-plan rehash {plan_dir}` then
  re-validate. **Rehash clears any prior visual approval** (red-team M1) — a stale
  review cannot ride through on refreshed bytes.
- **Step 6V (studio review):** open `mewkit visual-plan edit {plan_dir}` for
  interactive review (Phase 4 shipped). The human transitions the decision via
  `approve`.
- **Reopen loop (Phase 6):** when the reviewer's studio session produces a
  feedback batch (Copy Command), a fresh agent session applies it via
  `/mk:visual-plan apply-feedback` (see the visual-plan skill's
  `references/apply-feedback-protocol.md`): visual-only ops via `mewkit visual-plan
  patch`, plan-semantic ops as Markdown edits + `rehash`, then a resolution
  receipt. A receipt with an `unresolved` op BLOCKS `approve` at that revision.
  After resolution, reopen (`edit`) → re-review → `approve` the new revision.

## 7. Gate 1 Visual Preconditions (Step 7)

For a `required` plan, Gate 1 blocks unless ALL hold (these are what `approve`
checks — the CLI is the single writer of `review.status`):

- artifact exists; schema + security valid; `uiCoverage.summary.unresolved == 0`;
- every frame has surface + HTML + stable id + evidence + coverage link;
- all refs resolve; source hashes fresh (no un-rehashed Markdown edit);
- user reviewed the CURRENT revision; no pending feedback batch;
- `review.status == approved` with `approvedRevision == revision`.

On human Approve, the skill runs **`mewkit visual-plan approve {plan_dir}
--revision <n>`** (n = the artifact's current revision). Non-zero exit ⇒ a
precondition failed ⇒ do NOT pass Gate 1; surface the failed preconditions.

- `optional` plan: may pass with a typed skip reason recorded in Step 4.
- `none` plan: no visual metadata, no visual precondition — Gate 1 unchanged.

## 8. Schema 1.3 `.plan-state.json` visual block (Step 8)

The `.plan-state.json` schema becomes **1.3**: additive `visual` pointer block.
Do NOT hand-write it — the CLI regenerates it from the artifact and preserves
every other field (`phases`, `handoff`, unknown keys). It is written by
`approve`/`rehash` via read-modify-write, and CREATES `.plan-state.json` (with only
the `visual` block) when the file does not yet exist. So `approve` at step-07 — which
runs BEFORE step-08 writes the other fields — creates/updates the file safely; there
is no ordering hazard. Step 8 (writer of the other fields) MUST then read the current
`.plan-state.json` and PRESERVE the `visual` key verbatim (read-modify-write, never
full-overwrite). Shape:

```json
"visual": {
  "schema": "visual-plan/v1",
  "path": "visual-plan/plan.json",
  "revision": 4,
  "hash": "sha256:...",
  "source_plan_hash": "sha256:...",
  "review_status": "approved",
  "pending_feedback": []
}
```

The block is additive — legacy plans without it keep working; consumers read only
known keys.

## 9. Export from the approved artifact (Step 8b)

Once Phase 4 ships `mewkit visual-plan export --format html`, export `plan.html`
FROM the approved artifact (no independent prose re-inference). Interim (pre-Phase
4): the existing `mk:visual-plan` static render is available but clearly labeled
non-canonical, and does not replace the approved artifact.

## Cook consumption (downstream)

`mk:cook` reads the approved visual metadata and re-reads the approved frames +
source refs before UI-bearing phases. Cook NEVER hand-edits the visual artifact or
`.plan-state.json.visual` — mutations go through `mewkit visual-plan` (patches in
Phase 5) or the apply-feedback loop (Phase 6).

# Good vs bad plan.html — the worked example

Read this alongside `plan-document-quality.md` and `block-vocabulary.md` before
rendering. It is the bar a `plan.html` must clear and the anti-patterns it must
avoid.

## GOOD — an architecture plan

A four-phase plan renders top-to-bottom as: a phase-timeline where each card
shows the real phase title, status, priority, dependencies, and effort, so the
1 → 2 → 3 → 4 order and the "Phase 2 depends on Phase 1" blocking are obvious at
a glance. Below it, an architecture-diagram block draws the real component
relationship as a Mermaid diagram with the Mermaid source kept in a visible
`<pre>` fallback. A file-map block lists the real paths grouped Create / Modify /
Read, so the blast radius is visible. A decision/risk-cards block surfaces the
Risk Map rows and Red Team notes as scannable cards. A steps-checklist block
turns Implementation Steps and Success Criteria into checkable items. Every block
uses only `--wf-*` tokens and helper classes, so the page reads cleanly in light
and dark. Nothing is restated in prose that a block already carries. This is the
bar.

## GOOD — a UI plan with `--wireframe`

The same core blocks, plus a wireframe-screen block per screen the plan
describes. Each screen is a clean themed mockup: a `data-surface` that matches
the real footprint, helper classes and tokens only, `data-icon` markers for
icons, real labels and counts. The wireframes augment the structure — the
reviewer matches each screen to the phase that builds it — they do not replace
the phase-timeline or file-map.

## GOOD — a backend plan with no UI

No wireframes (the flag was not passed). The page is phase-timeline +
architecture-diagram + file-map + decision-cards + steps-checklist, plus a
data-model block because the plan defines a schema and an api-endpoint block
because it defines a route. The conditional blocks appear because the content
exists, not to fill space.

## BAD — never produce these

- Raw hex / rgb / hsl colors or a `font-family` in a block or wireframe instead
  of `--wf-*` tokens; the page then breaks in dark mode.
- A wireframe with fixed pixel width/height on the frame, gray placeholder bars
  faking text, or a forced desktop + mobile pair for a popover.
- A `plan.html` that restates each block's content again in paragraphs below it,
  or a marketing hero heading and value props that just repeat the phase list.
- An empty `data-model` or `api-endpoint` block emitted for a plan that has no
  schema or endpoint.
- A phase card that says "set up things" instead of the real phase title,
  status, dependencies, and effort from the frontmatter.
- A product wireframe that mixes a real screen with repo names, file-contract
  arrows, or architecture explanations.
- Plan-source text dropped into the DOM unescaped, so a `<script>` in `plan.md`
  executes when the page opens.
- A page that describes itself as a revision of a prior conversation instead of a
  standalone plan.
- Hand-edited HTML in `plan.html` instead of editing `plan.md` and regenerating.

# Plan document quality — the bar plan.html must clear

Read this in full before authoring a `plan.html`. It is the quality bar: how the
page reads, which block to reach for, how open questions appear, and the check to
run before you call it done. Do not render from memory or skip these rules.

## Contents

- Outcome-first, not marketing
- Stand alone
- Specificity
- Use the right block, make it carry substance
- Open questions
- Never hand-edit plan.html
- Before you finish

## Outcome-first, not marketing

`plan.html` is a serious technical plan rendered visually, not a landing page.
It states what the work delivers, what "done" means, the phases and their order,
the architecture, the files touched, and the risks. No hero art, gradients,
logos, slogans, value props, or giant marketing headings. The reader is a
reviewer deciding whether the plan is sound — give them structure, not polish.

## Stand alone

The page is a plan to do the work, not a changelog of the planning conversation.
Do not render phrases like "as discussed", "this revision", "the previous plan",
or "unlike the earlier version". A reviewer who opens `plan.html` from a link
with no chat history should understand it. Fold decisions into the normal
objective / architecture / phase structure and state the positive model directly.

## Specificity

Replace vague text with specifics drawn from the plan: real phase names, real
file paths from `## Related Code Files`, real symbols, real risk reasons. A
phase card that says "set up things" is a failure; one that says
"Phase 2 — Build fixed HTML assets · depends on Phase 1 · effort ~3-4h" is the
bar. The plan already contains the specifics; surface them, do not blur them.

## Use the right block, make it carry substance

Map each kind of content to its block from `block-vocabulary.md` and let the
block carry real substance:

- Phases, status, dependencies → phase-timeline. The reader sees order and
  blocking at a glance.
- Architecture relationships → architecture-diagram (Mermaid, with a `<pre>`
  source fallback). Use a diagram only when there is a real two-dimensional
  relationship; do not draw a chain for a plain list.
- Files touched → file-map, grouped Create / Modify / Read. This is the blast
  radius; show it, do not describe it in a paragraph.
- Decisions, risks, open questions → decision/risk-cards. A settled decision
  reads as a stated card; an open one goes to the open-questions area.
- Steps and acceptance → steps-checklist with checkboxes.

Do not echo the same content in prose after a block already carries it.

## Open questions

Surface unresolved decisions that would change the plan as cards in the
decision/risk-cards block, near the bottom, clearly marked as open. State each
question with its real alternatives and a recommended default when you have one.
Do not scatter the same question in several places, and do not invent questions
the plan already answered. A plan with no open questions is fine when every
decision is genuinely made.

## Never hand-edit plan.html

`plan.html` is a generated artifact. If the plan changes, edit `plan.md` /
`phase-*.md` and regenerate — never patch the HTML by hand. Hand edits drift from
the source and break the regenerate guarantee. The same applies to the
post-generation self-check: if it fails, fix the mapping and regenerate, do not
splice the HTML.

## Before you finish

Open the page and check it: phases in order, the architecture diagram readable
(or its `<pre>` fallback visible), the file map grouped, decisions scannable,
no overlap, no clipped content, readable in both light and dark. A reviewer
should get the phases, the architecture, and the top decisions in under 30
seconds without reading paragraphs. If they cannot, the blocks are not carrying
enough substance — fix that, then regenerate.

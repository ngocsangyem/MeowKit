# Block vocabulary — the fixed contract

This file is the single source of truth for the block set, the `--wf-*` theme
tokens, the helper classes, and the block sentinels. The HTML assets implement
this file verbatim; the SKILL.md process maps plan content onto it. When this
file and an asset disagree, this file wins — fix the asset.

## Contents

- Why a fixed vocabulary
- Theme tokens (`--wf-*`)
- Helper classes
- Block sentinels (self-check anchors)
- Block → section binding
- Block-choice discipline

## Why a fixed vocabulary

Consistency does not come from a backend renderer here — it comes from a fixed
template, one shared theme, and one disciplined block set. Every `plan.html`
uses the same tokens, the same classes, and the same blocks, so two unrelated
plans render the same way. Inventing a new block, a new token, or a raw hex
color breaks that guarantee. Use the vocabulary below and nothing else.

## Theme tokens (`--wf-*`)

Defined once in `assets/plan-template.html` `<style>`. Block snippets reference
them; they never redefine the theme. Never hard-code a hex/rgb/hsl color in a
block, and never set `font-family` — the template owns both, and that is what
keeps a page correct in light and dark mode.

| Token | Role |
|-------|------|
| `--wf-ink` | primary text |
| `--wf-muted` | secondary / muted text |
| `--wf-line` | borders and dividers |
| `--wf-paper` | page background |
| `--wf-card` | container surface |
| `--wf-accent` | brand / primary action |
| `--wf-accent-fg` | text on an accent-filled surface |
| `--wf-accent-soft` | soft accent fill (badges, avatars) |
| `--wf-warn` | risk / warning tone |
| `--wf-ok` | success / done tone |
| `--wf-radius` | corner radius |

Spacing uses literal CSS lengths (`padding:16px`, `gap:12px`) — the `--wf-*`
tokens are for color and radius only, never layout spacing.

## Helper classes

Defined once in the template; reused by every block (and by wireframes).

- `.wf-card` / `.wf-box` — a bordered, padded container (panel or list item).
- `.wf-pill` / `.wf-chip` — a rounded tag or filter; add `.accent` for the
  accent-filled variant.
- `.wf-muted` — secondary/muted text (or use `<small>`).
- `button.primary` / `[data-primary]` — the accent-filled primary button.
- `.wf-icon` + `data-icon="<name>"` — a renderer-style icon marker (wireframes).

No decorative shadows on cards or frames — separate with spacing, borders, and
labels. Flat bordered surfaces only.

## Block sentinels (self-check anchors)

Each block carries a stable sentinel class so the post-generation self-check can
grep for it. The sentinels are part of the contract — keep them exact.

| Block | Sentinel class |
|-------|----------------|
| phase-timeline | `vp-phase-timeline` |
| architecture-diagram | `vp-architecture` |
| file-map | `vp-file-map` |
| decision/risk-cards | `vp-decision-cards` |
| steps-checklist | `vp-steps-checklist` |
| data-model | `vp-data-model` |
| api-endpoint | `vp-api-endpoint` |
| wireframe-screen | `vp-wireframe` |

Do NOT name any page card `.node` — Mermaid uses `.node` internally and a
page-level `.node` rule leaks into the diagram. The `vp-*` names avoid this.

## Block → section binding

Each block binds to named sections of the real `mk:plan-creator` output:
`plan.md` (Goal / Context / Scope / Constraints / Technical Approach / Risk Map /
Red Team Review / Acceptance Criteria) and each `phase-*.md` (Context Links,
Overview, Key Insights, Requirements, Architecture, Related Code Files,
Implementation Steps, Todo List, Success Criteria, Risk Assessment, Security
Considerations, Next Steps).

| Block | Binds to | When |
|-------|----------|------|
| phase-timeline | the `## Phases` list + each phase frontmatter (status/priority/dependencies/effort) + each phase `## Overview` | core — always |
| architecture-diagram | each phase `## Architecture` (Mermaid) | core — always |
| file-map | each phase `## Related Code Files` (Create / Modify / Read) | core — always |
| decision/risk-cards | plan `## Risk Map` + `## Red Team Review` + each phase `## Key Insights` + `## Risk Assessment` + `## Security Considerations` + open questions | core — always |
| steps-checklist | each phase `## Implementation Steps` + `## Todo List` + `## Success Criteria` | core — always |
| data-model | schema / entity / table content in the plan | only if present |
| api-endpoint | API / endpoint / request-response content in the plan | only if present |
| wireframe-screen | UI screens the plan describes | only with `--wireframe` |

## Block-choice discipline

- Use the right block and make it carry substance — real phase names, real file
  paths, real decisions, not filler.
- Emit a conditional block (`data-model`, `api-endpoint`) ONLY when the plan
  actually has that content. Never emit an empty block to fill space.
- Do not restate the same content in two blocks. A decision belongs in the
  decision cards; a file belongs in the file map; do not echo either in prose.
- `wireframe-screen` is for product UI only, and only under `--wireframe`. Never
  use a diagram as a substitute for a requested screen, and never embed file
  contracts or architecture arrows inside a product screen.

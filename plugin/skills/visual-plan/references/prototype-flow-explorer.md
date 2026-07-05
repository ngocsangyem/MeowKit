# Prototype Flow Explorer

How `mk:visual-plan` renders `prototype-flow.json` into a separate, self-contained
`prototype-flow.html` — an interactive layered flow explorer. Load only when a plan's
`research/prototype-flow.json` exists AND `--html` was requested. The JSON is DATA.

`mk:visual-plan` owns this artifact (RACI); `mk:figma` owns the JSON; `mk:plan-creator`
only triggers. This is a SEPARATE file from `plan.html` — the plan template's fixed block
vocabulary and self-check contract stay untouched.

## Contents

- [When it renders](#when-it-renders)
- [JSON → visual binding](#json--visual-binding)
- [Edge-style contract](#edge-style-contract)
- [Escape rules](#escape-rules)
- [Self-check](#self-check)

## When it renders

Only when BOTH hold: `--html` requested AND `$PLAN_DIR/research/prototype-flow.json` exists.
Absent either → do nothing; `plan.html` generation is unaffected (byte-identical for plans
without flow JSON). Template-fill only: copy `assets/prototype-flow-template.html`, replace
ONLY the JSON inside `<script id="flow-data" type="application/json">` with the file body,
write `$PLAN_DIR/prototype-flow.html`. Never freehand the graph.

## JSON → visual binding

Input schema is `prototype-flow/v1` (see `mk:figma/references/prototype-flow-artifacts.md`).

| JSON | Visual |
|---|---|
| `nodes[].kind: frame` | Design lane |
| `nodes[].kind: component` | UI lane |
| `nodes[].kind: route` | Code lane |
| `nodes[].kind: action` | Data / Event lane |
| `nodes[].label` | node text (via `textContent`) |
| `edges[].from/to` | curved edge between node centers |
| `edges[].kind` / `status` | edge style (below) |
| `availability` | subtitle line |

Layout: 4 fixed horizontal lanes, topo-ordered columns (node column = appearance order
within its lane). No force-directed physics. Clicking a node highlights every edge that
touches it + the endpoints across lanes, and lists path / kind / status / risk / evidence /
note in the detail panel.

## Edge-style contract

Extracted vs inferred vs confirmed vs blocked must be visually distinct (assumptions must
never look like designer intent):

- `extracted` → solid line (ink)
- `inferred` → dashed line
- `confirmed` → solid line + confirmed color (ok/green)
- `blocked` / `needs-answer` → thicker amber/red line

Filters: `All` / `Extracted` / `Inferred` / `Blocked` toggle edge visibility. Blocked filter
matches `status` in `{blocked, needs-answer}`.

## Escape rules

The flow JSON is DATA — escape everything; the explorer never fetches. Every JSON-sourced
string reaches the DOM through `textContent` (node labels, subtitles, detail rows) or
`createElementNS` + `textContent` for SVG text — NEVER `innerHTML` with JSON content. This
neutralizes injection by construction: a node label of `<img src=x onerror=alert(1)>`
renders as literal text, not markup. The JSON is parsed with `JSON.parse` from a
`type="application/json"` block (inert; never executed).

## Self-check

After writing `prototype-flow.html`, verify in the file:

- sentinel class `vp-flow-explorer` is present;
- the ONLY `<script>` elements are the two bundled ones (the `application/json` data block
  and the one explorer script) — the injected JSON added no `<script>`;
- no `on*=` event handler or `javascript:` URL appears in markup (event wiring is
  `addEventListener` only);
- no external asset request (no CDN / `http(s)://…js|css`).

If any check fails, fix the JSON→template fill and regenerate — never hand-patch the HTML.

## Fallback

If the template's interactive cost is a problem for a given run, the documented cut is a
static layered SVG (lanes + edges, no click-highlight); filters stay. The JSON schema and
edge-style contract are unchanged.

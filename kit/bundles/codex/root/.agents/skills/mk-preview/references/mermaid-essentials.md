# Mermaid Essentials (v11)

Read this BEFORE emitting any mermaid block, in markdown or HTML.

## Contents

- Pinned version
- Init pattern (HTML)
- classDef and the `.node` trap
- Node labels — special characters
- Layout direction
- Color rules
- What we do not do

## Pinned version

`11.4.x` — keep this version identical in `references/html-design-rules.md` → "CDN resources". A single edit bumps both.

## Init pattern (HTML)

```html
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
  mermaid.initialize({
    startOnLoad: true,
    theme: "neutral",
    securityLevel: "loose",
    flowchart: { curve: "basis" }
  });
</script>
```

For 10+ nodes use the ELK layout: add `layout: "elk"` to the init options. ELK reduces edge crossings and avoids spaghetti diagrams.

## classDef and the `.node` trap

Mermaid uses `.node` internally as a CSS class on every node `<g>` element. Page-level CSS targeting `.node` leaks into the diagram and breaks rendering.

- DO NOT name page cards `.node`.
- USE `.ve-card`, `.section-card`, `.ts-card`, or any non-`.node` class for cards on the page.
- classDef rules inside the mermaid block are scoped to the diagram — those are fine:

```
classDef primary fill:#fef3c7,stroke:#92400e,color:#92400e
classDef accent fill:#e0e7ff,stroke:#3730a3,color:#1e3a8a
class A primary
class B accent
```

## Node labels — special characters

- Quote labels with slashes, parens, or punctuation: `A["text with /slashes"]`
- Escape brackets in labels: `A["array[0]"]`
- No raw HTML in labels — use `&lt;` and `&gt;` if you must show angle brackets
- `stateDiagram-v2` truncates labels above ~30 chars; keep state names short

## Layout direction

| Direction | Use for |
|---|---|
| `flowchart TD` | Hierarchies (parent → child), call graphs |
| `flowchart LR` | Pipelines, time-ordered flows |
| `sequenceDiagram` | Request/response, multi-party protocols |
| `stateDiagram-v2` | State machines, lifecycle |
| `erDiagram` | Schema relationships |
| `classDiagram` | Type hierarchies |

For 10+ nodes: add `%%{init: {"flowchart": {"layout": "elk"}}}%%` at the top, OR set `layout: "elk"` in `mermaid.initialize`.

## Color rules

- 8-digit hex for transparency: `#c2410c33` (last two digits = alpha)
- classDef colors should reference theme variables when the diagram appears inside a theme-aware page; concretely, prefer hex values that match the page's chosen palette
- Mermaid theme is set ONCE at init — switching the page theme does not re-skin Mermaid SVG internals. Document this; do not pretend otherwise.

## What we do not do

- No screenshot / render verification loop. Agents lack reliable image-render tools that are both deterministic and free of dependencies. Emit syntax-valid Mermaid and stop.
- No Chart.js logic in this file — Chart.js belongs in `references/html-design-rules.md` if it appears at all.
- No anime.js, no GSAP — keep the visual surface to Mermaid + plain CSS transitions.

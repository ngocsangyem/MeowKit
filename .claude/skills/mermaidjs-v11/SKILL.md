---
name: mk:mermaidjs-v11
description: "Writes inline Mermaid v11 diagrams. NOT for mk:tech-graph."
user-invocable: true
when_to_use: "A diagram in markdown."
keywords:
  - mermaid
  - mermaid-v11
  - diagrams
  - flowchart
  - sequence-diagram
  - class-diagram
  - state-diagram
  - er-diagram
  - gantt
  - timeline
  - user-journey
  - markdown-diagram
  - chart
  - graph
preamble-tier: 1
phase: on-demand
trust_level: kit-authored
injection_risk: low
owner: utility
criticality: medium
status: active
runtime: claude-code
---

# Mermaid.js v11

Write valid Mermaid v11 for markdown and docs. For publish-grade SVG use `mk:tech-graph`; for an explainer page or slide deck use `mk:preview`.

Check that the diagram parses before returning it: `mmdc` (see CLI below) or `mermaid.parse(text)`, which validates without rendering and throws on invalid input (or returns `false` with `suppressErrors: true`). If neither is available, say the diagram was not validated.

## Quick Start

Common types: `flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram`,
`gantt`, and `journey`. Load [references/diagram-types.md](references/diagram-types.md) for
the complete v11 syntax catalog.

## Creating Diagrams

**Inline Markdown Code Blocks:**
````markdown
```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
```
````

**Configuration via Frontmatter:**
````markdown
```mermaid
---
theme: dark
---
flowchart LR
    A --> B
```
````

**Comments:** Use `%% ` prefix for single-line comments.

## CLI Usage

Convert `.mmd` files to images:
```bash
# Installation
npm install -g @mermaid-js/mermaid-cli

# Basic conversion
mmdc -i diagram.mmd -o diagram.svg

# With theme and background
mmdc -i input.mmd -o output.png -t dark -b transparent

# Custom styling
mmdc -i diagram.mmd --cssFile style.css -o output.svg
```

See `references/cli-usage.md` for Docker, batch processing, and advanced workflows.

## JavaScript Integration

**HTML Embedding:**
```html
<pre class="mermaid">
  flowchart TD
    A[Client] --> B[Server]
</pre>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>mermaid.initialize({ startOnLoad: true });</script>
```

Pin an exact version in the URL; do not load `latest`. See `references/integration.md` for the Node.js API and advanced patterns.

## Configuration & Theming

**Common Options:**
- `theme`: "default", "dark", "forest", "neutral", "base"
- `look`: "classic", "handDrawn"
- `fontFamily`: Custom font specification
- `securityLevel`: "strict", "loose", "antiscript"

See `references/configuration.md` for complete config options, theming, and customization.

## Practical Patterns

Load `references/examples.md` for:
- Architecture diagrams
- API documentation flows
- Database schemas
- Project timelines
- State machines
- User journey maps

## References

| Need | Load |
|---|---|
| Diagram syntax | [references/diagram-types.md](references/diagram-types.md) |
| Config, theming, accessibility | [references/configuration.md](references/configuration.md) |
| CLI, Docker, batch export | [references/cli-usage.md](references/cli-usage.md) |
| JavaScript integration | [references/integration.md](references/integration.md) |
| Common patterns | [references/examples.md](references/examples.md) |

For rendered SVG layout review, load `mk:tech-graph` and follow its SVG-layout route.

## Gotchas

- Prefer `flowchart` over `graph` for new diagrams; `graph` is still accepted as the older keyword.
- The `securityLevel: "strict"` setting strips HTML from labels — use plain text in node labels when security mode is on.
- `mmdc` has its own Node requirement; if it fails to start, check the Node version it documents and fall back to `mermaid.parse` or report the diagram unvalidated.
- Beta diagram types in `references/diagram-types.md` (names ending in `-beta`) need a recent Mermaid.
- Inline frontmatter config (the `---` block inside a code fence) needs a recent Mermaid; older renderers silently drop it and render the `---` as content.
- External `@import` in `<style>` breaks `rsvg-convert` — embed fonts inline if you later export via `mk:tech-graph`.

# Visual Vocabulary and Layout

## Contents

- [Shape vocabulary](#shape-vocabulary)
- [Arrow semantics](#arrow-semantics)
- [Spacing and labels](#spacing-and-labels)
- [Arrow routing and crossings](#arrow-routing-and-crossings)
- [Final validation](#final-validation)

## Shape vocabulary

| Concept | Shape | Notes |
| --- | --- | --- |
| User / Human | Circle + body path | Stick figure or avatar |
| LLM / Model | Rounded rectangle | Brain/spark icon or gradient accent |
| Agent / Orchestrator | Hexagon or double-border rounded rectangle | Active controller |
| Memory (short-term) | Dashed rounded rectangle | Ephemeral |
| Memory (long-term) | Cylinder | Persistent storage |
| Vector Store | Cylinder with grid lines | Add three horizontal lines |
| Graph DB | Cluster of three overlapping circles | |
| Tool / Function | Gear-like rectangle or wrench rectangle | |
| API / Gateway | Hexagon | Single border |
| Queue / Stream | Horizontal tube | |
| File / Document | Folded-corner rectangle | |
| Browser / UI | Rectangle with three-dot titlebar | |
| Decision | Diamond | Flowcharts only |
| Process / Step | Rounded rectangle | Standard box |
| External Service | Rectangle with cloud icon or dashed border | |
| Data / Artifact | Parallelogram | Flowchart I/O |

## Arrow semantics

| Flow Type | Color | Stroke | Dash | Meaning |
| --- | --- | --- | --- | --- |
| Primary data flow | blue `#2563eb` | 2px | none | Main request/response |
| Control / trigger | orange `#ea580c` | 1.5px | none | One system triggers another |
| Memory read | green `#059669` | 1.5px | none | Retrieval |
| Memory write | green `#059669` | 1.5px | `5,3` | Store/write |
| Async / event | gray `#6b7280` | 1.5px | `4,2` | Non-blocking event |
| Embedding / transform | purple `#7c3aed` | 1px | none | Transformation |
| Feedback / loop | purple `#7c3aed` | 1.5px curved | none | Iterative reasoning |

Always include a legend when two or more arrow types appear.

## Spacing and labels

- Keep same-layer nodes 80px apart horizontally and layers 120px apart vertically.
- Use 40px canvas margins, 60px between node edges, and an 8px grid; favour 120px horizontal/vertical intervals.
- Offset labels 6–8px above horizontal arrows or 8px beside vertical arrows. Add a `0.95` opacity canvas-colour background only when offset text still crosses a visual element.
- Put labels near the arrow middle, limit them to three words, stagger converging labels by 15–20px, and keep 10px from nodes.

## Arrow routing and crossings

- Prefer orthogonal L-shaped routes, attach to node edges rather than centres, and use distinct offsets for parallel routes.
- Route around dense clusters. For JSON/template generation, prefer `source` and `target` ids; use `x1,y1,x2,y2` only as hints. Set per-arrow `"label_style": "offset"` when legacy badge backgrounds clutter a diagram.
- Never allow straight arrow crossings without a jump-over. Mask the lower layer with a matching-background semicircle and draw the upper arc over it. Stagger multiple radii (5px, 7px, 9px).

## Final validation

1. Arrows must not pass through component interiors.
2. Text must fit with 8px padding; estimate `text.length × 7px ≤ shape_width - 16px`.
3. Arrow endpoints must touch shape edges; labels must not sit on arrow lines.
4. Enter or leave containers through clear gaps rather than through contained components.
5. During visual review, move legends/notes clear of arrows, enlarge gutters or canvas before packing content tighter, and collapse repeated cross-layer arrows into one outside rail when appropriate.

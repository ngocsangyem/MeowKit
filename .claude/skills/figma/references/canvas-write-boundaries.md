# Canvas-Write Boundaries (gated)

> **Gate — load and run this workflow ONLY when ALL hold:**
> 1. Explicit user request to MUTATE the Figma file (create/update/delete). Never inferred from an
>    implement/analyze task.
> 2. User confirms the target file is safe to modify.
> 3. Work proceeds in small incremental steps with verify-after-each.
> 4. On error: inspect before retry; clean only artifacts verified as self-created.
>
> If any condition is unconfirmed: tell the user what is missing and STOP.

**Rule of Two rationale.** Default modes read untrusted Figma content without changing state (2 of 3 —
acceptable). Canvas writes add state change on top of untrusted input, so they are opt-in behind this
gate (per the toolkit's injection-rules Rule 11).

## Contents

- [Part A — Execution rules (`use_figma` scripts)](#part-a--execution-rules-use_figma-scripts)
- [Part B — Plugin API rules](#part-b--plugin-api-rules)
- [Part C — Prohibited](#part-c--prohibited)

## Part A — Execution rules (`use_figma` scripts)

- Load the Plugin API reference before writing any script.
- Use `return` for output — never `figma.closePlugin`.
- Use top-level `await`.
- Never emit user notifications from scripts.
- `await figma.loadFontAsync(node.fontName)` before any text property change.
- Switch pages with `await figma.setCurrentPageAsync(page)` before node access (not the legacy sync
  `figma.currentPage = page` assignment).
- Return created node IDs — multi-step workflows reference them in later calls.
- Work in small incremental steps: create → verify → adjust → verify → finalize. Never batch-create then
  verify at the end.
- On error: inspect state before retrying; clean up only artifacts you verified you created (writes may
  be partial — do not assume atomicity).

## Part B — Plugin API rules

### Color values

Colors use the 0–1 scale, not 0–255. Alpha is also 0–1.

```
Figma: { r: 0.2, g: 0.6, b: 1.0, a: 0.8 }
CSS:   rgba(51, 153, 255, 0.8)   // Math.round(c * 255) for r/g/b
```

### Fills and strokes are read-only arrays

Direct mutation fails silently. Clone, modify the clone, reassign.

```
WRONG: node.fills[0].color = newColor
RIGHT: node.fills = [{ ...node.fills[0], color: newColor }]
```

### Variable scopes

Set the narrowest relevant `scopes` at creation (e.g. `['FILL_COLOR']` for color vars). Do NOT create
with `ALL_SCOPES` — it pollutes property pickers across the whole file. This is the single scope rule.

```
variable.scopes = ['FILL_COLOR']   // narrow, not ['ALL_SCOPES']
node.setBoundVariable('fills', variable)
```

### Variable naming conflicts

Duplicate variable names crash with an unhelpful error. Check before creating.

```
const existing = figma.variables.getLocalVariables()
if (existing.some(v => v.name === newName)) throw new Error(`Variable "${newName}" already exists`)
```

### Component variants: properties before instances

Define property definitions before creating instances; instances cannot be created with undefined
property values.

```
component.addComponentProperty('state', 'VARIANT', 'Default')
const instance = component.createInstance()
instance.setProperties({ state: 'Default' })
```

### Auto-layout padding — per-side setters, no shorthand

```
frame.paddingTop = 16
frame.paddingRight = 24
frame.paddingBottom = 16
frame.paddingLeft = 24
// NOT: frame.padding = '16px 24px'  ← property does not exist
```

### Error recovery

| Error Type | Recovery |
|---|---|
| Rate limit (429) | Retry with delay 1s → 2s → 4s (exponential backoff) |
| Node not found | Verify `await figma.setCurrentPageAsync(page)`, then retry |
| Font not loaded | `await figma.loadFontAsync(node.fontName)` then retry |
| Fills read-only | Clone array, modify, reassign |
| Variable name conflict | Check existing names before creation |

## Part C — Prohibited

- Bulk delete of Figma nodes by name.
- One-shot large builds (full component libraries) — see `design-system-and-library-patterns.md`.
- Chaining a canvas write automatically from Implement mode.

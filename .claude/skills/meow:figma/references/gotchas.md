# Figma MCP Gotchas

Common pitfalls that cause silent failures or hard-to-debug errors.

## 1. Page Not Switched Before Node Access

```
WRONG: figma.currentPage.findAll(n => n.id === targetId)
       // Returns [] if you're on the wrong page — no error thrown

RIGHT: figma.currentPage = figma.root.children.find(p => p.name === 'Design')
       figma.currentPage.findAll(n => n.id === targetId)
```

Always switch page explicitly. `figma.root.children` returns pages, not nodes.

## 2. Fills/Strokes Are Read-Only Arrays

```
WRONG: node.fills[0].color = { r: 1, g: 0, b: 0, a: 1 }
       // Silently fails — no error, no change

RIGHT: const fills = JSON.parse(JSON.stringify(node.fills))
       fills[0] = { ...fills[0], color: { r: 1, g: 0, b: 0, a: 1 } }
       node.fills = fills
```

## 3. Text Changes Without Font Load

```
WRONG: node.characters = 'New text'
       // Throws: "Error: in set_characters: Expected all fonts to be loaded"

RIGHT: await figma.loadFontAsync(node.fontName)
       node.characters = 'New text'
```

Load font BEFORE every text property change, even if you think it's already loaded.

## 4. Variable Name Duplicates Crash Silently

```
WRONG: figma.variables.createVariable('color/primary', collection, 'COLOR')
       // If name exists → crash with unhelpful error

RIGHT: const existing = figma.variables.getLocalVariables()
       if (!existing.find(v => v.name === 'color/primary')) {
         figma.variables.createVariable('color/primary', collection, 'COLOR')
       }
```

## 5. Colors Are 0–1, Not 0–255

```
WRONG: { r: 255, g: 102, b: 0 }   // Renders white (values clamped to 1)
RIGHT: { r: 1.0, g: 0.4, b: 0.0 } // Orange

// CSS conversion:
const toCSS = (c) => Math.round(c * 255)
`rgb(${toCSS(r)}, ${toCSS(g)}, ${toCSS(b)})`
```

## 6. Component Variants Need Properties Before Instances

```
WRONG: const instance = component.createInstance()
       component.addComponentProperty('state', 'VARIANT', 'Default')
       // instance has no valid state → undefined behavior

RIGHT: component.addComponentProperty('state', 'VARIANT', 'Default')
       const instance = component.createInstance()
       instance.setProperties({ state: 'Default' })
```

## 7. Auto-Layout Padding Has No Shorthand

```
WRONG: frame.padding = 16          // Property doesn't exist
WRONG: frame.padding = '16px 24px' // Property doesn't exist

RIGHT: frame.paddingTop = 16
       frame.paddingRight = 24
       frame.paddingBottom = 16
       frame.paddingLeft = 24
```

## 8. Node ID URL Encoding

Node IDs in Figma URLs are URL-encoded. `2304:512` becomes `2304%3A512` in the URL.

```
WRONG: nodeId = '2304%3A512'          // MCP lookup fails
RIGHT: nodeId = decodeURIComponent('2304%3A512')  // → '2304:512'
```

Always URL-decode the node-id query param before passing to MCP.

## 9. get_design_context Returns Truncated Trees

Large components (100+ layers) may return truncated context.
Symptom: missing nested nodes in the response.
Fix: Request child nodes individually by ID, not via parent context.

## 10. Screenshots Reflect Last Published State

`get_screenshot` returns the last published/saved state, not unsaved edits.
If design was recently changed, screenshot may not match `get_design_context` data.
Workaround: note the discrepancy, trust `get_design_context` for values, screenshot for layout intent.

## 11. Node Default Position is (0,0)

New nodes default to position (0,0). If you create multiple nodes without setting position, they stack on top of each other invisibly.
Fix: Always set `node.x` and `node.y` explicitly after creation.

## 12. MUST Return Node IDs from use_figma

When creating nodes via `use_figma`, always return the created node IDs. Multi-step workflows need IDs to reference nodes in subsequent calls. Failing to return IDs breaks the entire chain.

## 13. HUG Parent with FILL Child Collapses

A parent frame with `primaryAxisSizingMode: 'AUTO'` (HUG) containing a child with `layoutSizingHorizontal: 'FILL'` → parent collapses to zero width, silently hiding content.
Fix: Set parent to FIXED or min-width before setting child to FILL.

## 14. resize() Resets Sizing Modes

Calling `node.resize(w, h)` resets `layoutSizingHorizontal` and `layoutSizingVertical` to `'FIXED'`. If the node was `'FILL'` or `'HUG'`, it becomes pixel-locked.
Fix: After `resize()`, re-apply the desired sizing mode.

## 15. detachInstance() Invalidates Node IDs

Detaching a component instance creates NEW nodes with NEW IDs. Any cached references to the old instance ID become invalid.
Fix: Re-query nodes after detach. Never cache IDs across detach operations.

## 16. Variables Need Explicit Scopes

Creating variables without specifying `scopes` defaults to `ALL_SCOPES` — pollutes the Figma UI with variables visible everywhere.
Fix: Always set `scopes` to the narrowest relevant set (e.g., `['FILL_COLOR']` for color vars).

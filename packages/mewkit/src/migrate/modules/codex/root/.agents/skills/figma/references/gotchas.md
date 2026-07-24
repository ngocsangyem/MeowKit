# Figma MCP Gotchas

Common pitfalls that cause silent failures or hard-to-debug errors. Split by path: read/analyze gotchas
apply to every mode; canvas-write gotchas apply ONLY inside the `canvas-write-boundaries.md` workflow.

## Contents

**Read & analyze gotchas**

- [R1. Page Not Switched Before Node Access](#r1-page-not-switched-before-node-access)
- [R2. Colors Are 0–1, Not 0–255](#r2-colors-are-01-not-0255)
- [R3. Node ID URL Encoding](#r3-node-id-url-encoding)
- [R4. get_design_context Returns Truncated Trees](#r4-get_design_context-returns-truncated-trees)
- [R5. Screenshots Reflect Last Published State](#r5-screenshots-reflect-last-published-state)
- [R6. Variables Need Explicit Scopes](#r6-variables-need-explicit-scopes)
- [R7. Node IDs Change When Frames Are Restructured](#r7-node-ids-change-when-frames-are-restructured)
- [R8. Token Format Differs: Variables vs Color Styles](#r8-token-format-differs-variables-vs-color-styles)
- [R9. Screenshot Export Scale on Retina](#r9-screenshot-export-scale-on-retina)

**Canvas-write gotchas** (only inside `canvas-write-boundaries.md`)

- [W1. Fills/Strokes Are Read-Only Arrays](#w1-fillsstrokes-are-read-only-arrays)
- [W2. Text Changes Without Font Load](#w2-text-changes-without-font-load)
- [W3. Variable Name Duplicates Crash Silently](#w3-variable-name-duplicates-crash-silently)
- [W4. Component Variants Need Properties Before Instances](#w4-component-variants-need-properties-before-instances)
- [W5. Auto-Layout Padding Has No Shorthand](#w5-auto-layout-padding-has-no-shorthand)
- [W6. Node Default Position is (0,0)](#w6-node-default-position-is-00)
- [W7. MUST Return Node IDs from use_figma](#w7-must-return-node-ids-from-use_figma)
- [W8. HUG Parent with FILL Child Collapses](#w8-hug-parent-with-fill-child-collapses)
- [W9. resize() Resets Sizing Modes](#w9-resize-resets-sizing-modes)
- [W10. detachInstance() Invalidates Node IDs](#w10-detachinstance-invalidates-node-ids)


# Read & analyze gotchas

## R1. Page Not Switched Before Node Access

```
WRONG: figma.currentPage.findAll(n => n.id === targetId)
       // Returns [] if you're on the wrong page — no error thrown

LEGACY (sync assignment — avoid for dynamic page access):
       figma.currentPage = figma.root.children.find(p => p.name === 'Design')

RIGHT: const page = figma.root.children.find(p => p.name === 'Design')
       await figma.setCurrentPageAsync(page)
       page.findAll(n => n.id === targetId)
```

Always switch page explicitly with `await figma.setCurrentPageAsync(page)` before node access.
`figma.root.children` returns pages, not nodes.

## R2. Colors Are 0–1, Not 0–255

```
WRONG: { r: 255, g: 102, b: 0 }   // Renders white (values clamped to 1)
RIGHT: { r: 1.0, g: 0.4, b: 0.0 } // Orange

// CSS conversion:
const toCSS = (c) => Math.round(c * 255)
`rgb(${toCSS(r)}, ${toCSS(g)}, ${toCSS(b)})`
```

## R3. Node ID URL Encoding

Node IDs in Figma URLs are URL-encoded. `2304:512` becomes `2304%3A512` in the URL.

```
WRONG: nodeId = '2304%3A512'          // MCP lookup fails
RIGHT: nodeId = decodeURIComponent('2304%3A512')  // → '2304:512'
```

Always URL-decode the node-id query param before passing to MCP.

## R4. get_design_context Returns Truncated Trees

Large components (100+ layers) may return truncated context.
Symptom: missing nested nodes in the response.
Fix: call `get_metadata`, then request child nodes individually by ID, not via parent context.

## R5. Screenshots Reflect Last Published State

`get_screenshot` returns the last published/saved state, not unsaved edits.
If design was recently changed, screenshot may not match `get_design_context` data.
Workaround: note the discrepancy, trust `get_design_context` for values, screenshot for layout intent.

## R6. Variables Need Explicit Scopes

Variables carry `scopes`. Creating them without an explicit scope defaults to `ALL_SCOPES`, which pollutes
the Figma UI with variables visible everywhere; narrow scopes keep property pickers (and token reads) clean.
Fix: always use the narrowest relevant set (e.g. `['FILL_COLOR']` for color vars). This is the single scope
rule — it supersedes any older "create with `ALL_SCOPES`" advice. (Write-side creation detail lives in
`canvas-write-boundaries.md`.)

## R7. Node IDs Change When Frames Are Restructured

Figma node IDs change when a designer duplicates or restructures frames — a node ID captured on Monday
may return 404 by Friday if the file was reorganized. Always re-extract the node ID from the current
URL before any MCP call; never cache IDs across sessions.

## R8. Token Format Differs: Variables vs Color Styles

Design token export format differs between Figma Variables and Color Styles. `search_design_system`
returns color styles as `rgba()` strings, while Figma Variables export as `{ r, g, b, a }` float objects
(0–1 range). Mixing the two in one token file produces half the tokens in the wrong format and silent
CSS variable failures. Normalize to one format before writing token files.

## R9. Screenshot Export Scale on Retina

`get_screenshot` defaults to 1x export. On 2x/3x displays the screenshot looks correct in the MCP
response but renders blurry when embedded in a 2x-density web page. Request `scale: 2` for any asset
intended for screen display.


# Canvas-write gotchas

These apply ONLY inside the `canvas-write-boundaries.md` workflow (gated `use_figma` mutation). The
read/analyze path does not load them.

## W1. Fills/Strokes Are Read-Only Arrays

```
WRONG: node.fills[0].color = { r: 1, g: 0, b: 0, a: 1 }
       // Silently fails — no error, no change

RIGHT: const fills = JSON.parse(JSON.stringify(node.fills))
       fills[0] = { ...fills[0], color: { r: 1, g: 0, b: 0, a: 1 } }
       node.fills = fills
```

## W2. Text Changes Without Font Load

```
WRONG: node.characters = 'New text'
       // Throws: "Error: in set_characters: Expected all fonts to be loaded"

RIGHT: await figma.loadFontAsync(node.fontName)
       node.characters = 'New text'
```

Load font BEFORE every text property change, even if you think it's already loaded.

## W3. Variable Name Duplicates Crash Silently

```
WRONG: figma.variables.createVariable('color/primary', collection, 'COLOR')
       // If name exists → crash with unhelpful error

RIGHT: const existing = figma.variables.getLocalVariables()
       if (!existing.find(v => v.name === 'color/primary')) {
         figma.variables.createVariable('color/primary', collection, 'COLOR')
       }
```

## W4. Component Variants Need Properties Before Instances

```
WRONG: const instance = component.createInstance()
       component.addComponentProperty('state', 'VARIANT', 'Default')
       // instance has no valid state → undefined behavior

RIGHT: component.addComponentProperty('state', 'VARIANT', 'Default')
       const instance = component.createInstance()
       instance.setProperties({ state: 'Default' })
```

## W5. Auto-Layout Padding Has No Shorthand

```
WRONG: frame.padding = 16          // Property doesn't exist
WRONG: frame.padding = '16px 24px' // Property doesn't exist

RIGHT: frame.paddingTop = 16
       frame.paddingRight = 24
       frame.paddingBottom = 16
       frame.paddingLeft = 24
```

## W6. Node Default Position is (0,0)

New nodes default to position (0,0). If you create multiple nodes without setting position, they stack on top of each other invisibly.
Fix: Always set `node.x` and `node.y` explicitly after creation.

## W7. MUST Return Node IDs from use_figma

When creating nodes via `use_figma`, always return the created node IDs. Multi-step workflows need IDs to reference nodes in subsequent calls. Failing to return IDs breaks the entire chain.

## W8. HUG Parent with FILL Child Collapses

A parent frame with `primaryAxisSizingMode: 'AUTO'` (HUG) containing a child with `layoutSizingHorizontal: 'FILL'` → parent collapses to zero width, silently hiding content.
Fix: Set parent to FIXED or min-width before setting child to FILL.

## W9. resize() Resets Sizing Modes

Calling `node.resize(w, h)` resets `layoutSizingHorizontal` and `layoutSizingVertical` to `'FIXED'`. If the node was `'FILL'` or `'HUG'`, it becomes pixel-locked.
Fix: After `resize()`, re-apply the desired sizing mode.

## W10. detachInstance() Invalidates Node IDs

Detaching a component instance creates NEW nodes with NEW IDs. Any cached references to the old instance ID become invalid.
Fix: Re-query nodes after detach. Never cache IDs across detach operations.

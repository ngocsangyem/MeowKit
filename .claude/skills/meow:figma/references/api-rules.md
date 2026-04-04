# Figma API Rules

Critical rules for Figma MCP operations. Violations cause silent failures or data corruption.

## Color Values

- Colors use 0–1 scale, NOT 0–255
- CSS `rgb()` expects 0–255 → always multiply by 255
- Alpha is also 0–1 (same scale, no conversion needed)

```
Figma: { r: 0.2, g: 0.6, b: 1.0, a: 0.8 }
CSS:   rgb(51, 153, 255, 0.8)
Conversion: Math.round(r * 255)
```

## Fills and Strokes (Immutable Arrays)

Fills and strokes are READ-ONLY arrays — direct mutation throws silently.

```
WRONG: node.fills[0].color = newColor
RIGHT: node.fills = [{ ...node.fills[0], color: newColor }]
```

Clone the array, modify the clone, reassign to the property.

## Page Switching

ALWAYS switch to the correct page before accessing nodes.
`figma.root.children` returns pages, NOT nodes.

```
// Must do this first:
figma.currentPage = figma.root.children.find(p => p.name === 'Design')
// Now access nodes:
figma.currentPage.findAll(...)
```

Failure to switch page → node lookup returns wrong results or undefined.

## Font Loading

Text node properties CANNOT be changed until font is loaded.
`loadFontAsync` MUST run before ANY text property change.

```
await figma.loadFontAsync(node.fontName)
node.characters = 'New text'
node.fontSize = 16
```

Skipping this → "Font not loaded" error that surfaces only at runtime.

## Variable Scopes

- Creation: use `ALL_SCOPES` to make variable available everywhere
- Usage: use specific scope (e.g., `FILL`, `STROKE`) when binding

```
// Create (broad scope):
variable.scopes = ['ALL_SCOPES']

// Bind (specific scope):
node.setBoundVariable('fills', variable)
```

## Workflow Pattern: Incremental Verify

ALWAYS follow: create → verify → adjust → verify → finalize
Never batch-create then verify at the end.
Each step's output is the next step's input.

## Error Recovery

| Error Type | Recovery |
|---|---|
| Rate limit (429) | Retry with delay: 1s → 2s → 4s (exponential backoff) |
| Node not found | Verify page switch, then retry |
| Font not loaded | `loadFontAsync` then retry |
| Fills read-only | Clone array, modify, reassign |
| Variable name conflict | Check existing names before creation |

## Variable Naming

Check for existing variable names before creating new ones.
Duplicate variable names cause crashes with no useful error message.

```
const existing = figma.variables.getLocalVariables()
const nameExists = existing.some(v => v.name === newName)
if (nameExists) throw new Error(`Variable "${newName}" already exists`)
```

## Component Variants

Define property definitions BEFORE creating instances.
Instances cannot be created with undefined property values.

```
// Wrong order:
const instance = component.createInstance()
component.addComponentProperty('state', 'VARIANT', 'Default')

// Right order:
component.addComponentProperty('state', 'VARIANT', 'Default')
const instance = component.createInstance()
```

## Auto-Layout Padding

Auto-layout padding uses individual properties, no shorthand:

```
frame.paddingTop = 16
frame.paddingRight = 24
frame.paddingBottom = 16
frame.paddingLeft = 24
// NOT: frame.padding = '16px 24px'  ← doesn't exist
```

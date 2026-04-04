# Figma → Code Implementation Workflow

7-step process for pixel-perfect implementation from Figma designs.
Load this file only when meow:figma is in **implement** mode.

## Step 1: Parse Figma URL

Extract file key and node ID from URL.

```
URL patterns:
  https://www.figma.com/design/{FILE_KEY}/Title?node-id={NODE_ID}
  https://www.figma.com/file/{FILE_KEY}/Title?node-id={NODE_ID}
  https://www.figma.com/proto/{FILE_KEY}/Title?node-id={NODE_ID}

Regex: /figma\.com\/(design|file|proto)\/([a-zA-Z0-9]+).*node-id=([^&]+)/
Group 2 = FILE_KEY, Group 3 = NODE_ID (URL-decode it)
```

STOP if URL does not match — report invalid URL, ask user to verify.

## Step 2: Get Design Context

Call `get_design_context` with file key + node ID.

Extract and record:
- Component tree (hierarchy, nesting depth)
- Layout mode: auto-layout (flex) vs absolute positioning
- Spacing: gap, padding, margin values
- Constraints: how elements respond to resize
- Text styles: font, size, weight, line-height, letter-spacing
- Color styles: fills, strokes, background colors
- Effect styles: shadows, blurs

## Step 3: Get Screenshot

Call `get_screenshot` for the target node.

Purpose: visual ground truth for pixel-perfect comparison after implementation.
Save reference as `figma-reference-{node-id}.png` in task's `assets/` folder.

## Step 4: Download Assets

For each icon or image in the design:
- Icons → export as SVG (vector, scalable)
- Photos/illustrations → export as WebP or optimized PNG
- Serve from `public/assets/` during development

Do NOT inline SVGs larger than 500 bytes — reference file path instead.

## Step 5: Identify Design System

Match the Figma design to the project's existing design system.

| Signal | Design System |
|---|---|
| `tailwind.config.*` exists | Tailwind CSS |
| `@mui/material` in deps | Material UI |
| `@radix-ui` or `shadcn` components | shadcn/ui |
| Custom CSS vars in `--design-*` | Custom system |

Map Figma tokens to existing system:
- Figma color → Tailwind color class or CSS var
- Figma spacing → Tailwind spacing scale or CSS var
- Figma text style → existing typography class

If no design system: generate CSS custom properties from Figma tokens (use tokens mode).

## Step 6: Translate to Code

Build in this order:
1. **Structure** — component hierarchy matches Figma layer tree
2. **Layout** — auto-layout → flexbox/grid, absolute → CSS position
3. **Spacing** — padding, gap, margin from Figma values
4. **Typography** — font, size, weight, line-height, tracking
5. **Colors** — fills, strokes, backgrounds (remember: multiply Figma 0–1 by 255)
6. **Effects** — shadows, blur, border-radius
7. **Interactions** — hover, focus, active states from prototype links
8. **Responsive** — apply Figma constraints as CSS responsive breakpoints

Use existing project components where possible — never recreate what exists.

## Step 7: Validate Visual Parity

Compare implementation to Figma screenshot:

- [ ] Spacing matches (padding, gap, margin within 2px tolerance)
- [ ] Typography matches (font, size, weight, line-height)
- [ ] Colors match (use hex comparison, not visual only)
- [ ] Layout direction correct (row vs column, wrap behavior)
- [ ] Border radius matches
- [ ] Shadows/effects match
- [ ] Responsive behavior matches Figma constraints
- [ ] Assets render correctly (no broken images, correct SVG colors)

If visual parity fails: identify the delta, fix the specific property, re-validate.

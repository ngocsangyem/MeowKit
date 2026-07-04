# Figma → Code Implementation Workflow

7-step process for pixel-perfect implementation from Figma designs.
Load this file only when mk:figma is in **implement** mode.

## Contents

- [Step 1: Parse Figma URL](#step-1-parse-figma-url)
- [Step 2: Get Design Context](#step-2-get-design-context)
- [Step 3: Get Screenshot](#step-3-get-screenshot)
- [Step 4: Download Assets](#step-4-download-assets)
- [Step 5: Identify Design System](#step-5-identify-design-system)
- [Step 6: Translate to Code](#step-6-translate-to-code)
- [Step 7: Validate Visual Parity](#step-7-validate-visual-parity)

## Step 1: Parse Figma URL

Extract file key and node ID from a `/design/` or `/file/` editor URL.

```
Accepted for extraction:
  https://www.figma.com/design/{FILE_KEY}/Title?node-id={NODE_ID}
  https://www.figma.com/file/{FILE_KEY}/Title?node-id={NODE_ID}

Shape regex (recognition only): /figma\.com\/(design|file|proto)\/([a-zA-Z0-9]+).*node-id=([^&]+)/
Group 1 = URL type, Group 2 = FILE_KEY, Group 3 = NODE_ID (URL-decode it, e.g. 2304%3A512 → 2304:512)
```

The regex recognizes link *shape* only; `/design/` and `/file/` are the only types accepted for extraction.

- Group 1 is `proto` → STOP. Prototype links are not parseable by `get_design_context`;
  request the `/design/` (or `/file/`) editor URL before proceeding.
- URL does not match the shape regex at all → STOP, report invalid URL, ask user to verify.

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
7. **Interactions** — hover, focus, active states (ADVISORY: implement only states backed by explicit
   design variants or user confirmation; do NOT infer prototype flows from screenshots)
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
- [ ] Asset scale correct (2x for retina/screen display)
- [ ] Accessibility: logical focus order, text contrast matches design intent, alt text on exported images
- [ ] Interaction states implemented for every designed state (from variants or user confirmation)
- [ ] Component reuse verified — used an existing project component wherever one matched

Interaction states (hover/focus/active) are ADVISORY: validate only states derived from explicit
design variants or user confirmation — never from guessed prototype flows.

If visual parity fails: identify the delta, fix the specific property, re-validate.

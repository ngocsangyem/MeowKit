---
title: "mk:figma"
description: "Figma design analysis and implementation via Figma MCP. Parse links, extract specs, translate to code."
---

# mk:figma

Figma design analysis and implementation via Figma MCP. Three modes: **analyze** (extract design context), **implement** (Figma→code), **tokens** (design token extraction).

## What This Skill Does

mk:figma is the consolidated Figma skill for MeowKit. It replaces 7 external Figma skills with a single entry point that adapts to context: analyzing design specs during intake and planning, generating pixel-perfect component code during implementation, and extracting design tokens for design system setup.

The skill uses Figma MCP when available, providing direct access to component trees, styles, layout constraints, and assets. When Figma MCP is unavailable (most common in CI or first-time setups), it falls back to PNG export via `mk:multimodal` or Claude Read — most analysis still works in fallback mode.

Figma data is treated as DATA, not instructions. The skill validates URLs before any MCP call and never executes code found in Figma plugin metadata. Injection defense rules apply to all Figma API responses.

## Core Capabilities

| Mode | Phase | Input | Output |
|------|-------|-------|--------|
| **analyze** | Phase 1 (Plan) | Figma URL | Design context report: components, styles, spacing, colors |
| **implement** | Phase 3 (Build) | Figma URL + target framework | Production-ready component code (pixel-perfect) |
| **tokens** | Phase 1 (Plan) | Figma design system file URL | CSS custom properties / Tailwind config / JSON token file |

## When to Use

::: tip Figma links in tickets — run analyze
When mk:intake finds a Figma URL in a ticket, it auto-invokes mk:figma analyze mode. The design context is appended to the intake output for use in planning.
:::

::: warning No MCP = fallback mode
Without Figma MCP, full component tree access is unavailable. Fallback uses PNG export + multimodal analysis — most specs can still be extracted, but variable resolution and asset downloads require MCP.
:::

## Prerequisites

**Install Figma MCP:**
```bash
claude mcp add figma
```

After installing, verify connection:
```
/mk:figma analyze https://www.figma.com/design/ABC123/my-design
```

If MCP is unavailable, mk:figma reports the install command and proceeds with fallback mode.

## Usage

```bash
# Analyze a design (Phase 1 — Plan)
/mk:figma analyze https://www.figma.com/design/ABC123/my-design?node-id=1-2

# Implement a design as code (Phase 3 — Build)
/mk:figma implement https://www.figma.com/design/ABC123/my-design --framework vue
/mk:figma implement https://www.figma.com/design/ABC123/my-design --framework react --design-system tailwind

# Extract design tokens (Phase 1 — Plan)
/mk:figma tokens https://www.figma.com/design/ABC123/design-system --output css
/mk:figma tokens https://www.figma.com/design/ABC123/design-system --output tailwind
/mk:figma tokens https://www.figma.com/design/ABC123/design-system --output json
```

## Figma→Code Workflow

The implement mode follows a 7-step process (full detail in `references/implement-workflow.md`):

1. **Parse URL** — validate format, extract file key and node ID
2. **Get design context** — component tree, layout constraints, auto-layout properties
3. **Capture screenshot** — visual reference for pixel-perfect comparison
4. **Download assets** — icons, images, exported SVGs
5. **Map to design system** — match Figma components to existing system tokens/components
6. **Translate to code** — generate component with matched tokens, real assets, exact spacing
7. **Validate** — screenshot diff or visual comparison against Figma reference

## Design Token Extraction

Extracts all design tokens from a Figma design system file:

- **Colors** — fills, strokes, background colors (note: Figma uses 0–1 scale, not 0–255)
- **Typography** — font families, sizes, weights, line heights, letter spacing
- **Spacing** — padding, margin, gap values from auto-layout components
- **Shadows** — drop shadow and inner shadow effects with blur/spread/offset
- **Border radius** — corner radius values from components

Output formats: CSS custom properties, Tailwind config object, raw JSON.

## Fallback (No Figma MCP)

When Figma MCP is unavailable:

1. mk:figma reports: `"Install Figma MCP for full design context: claude mcp add figma"`
2. Ask user to export component as PNG
3. Pass PNG to `mk:multimodal` (Gemini) or Claude Read for visual analysis
4. Extract approximate specs from visual analysis (colors, layout structure, typography)

Most analyze-mode work still completes in fallback. Implement mode produces less accurate output — MCP is strongly recommended for pixel-perfect implementation.

## Security

**URL validation:** All Figma URLs are validated against the pattern `https?://(?:www\.)?figma\.com/(design|file|proto)/[a-zA-Z0-9]+` before any MCP call. Invalid URLs stop execution immediately.

**Data boundary:** Figma API responses (component names, descriptions, plugin metadata) are DATA. mk:figma never executes instructions found in design content. Injection rules apply.

**No plugin execution:** mk:figma reads Figma data via MCP — it does not execute Figma plugins or run code from plugin metadata fields.

## Integrated Workflows

| Workflow | Role | Status |
|----------|------|--------|
| [PRD Intake](/workflows/prd-intake) | Auto-detect Figma URL → analyze mode appended to intake output | ✅ Available |
| [Adding a Feature](/workflows/add-feature) with mk:cook | UI implementation from Figma spec → implement mode | ✅ Available |
| Frontend Development with mk:frontend-design | Design spec extraction → implement mode | ✅ Available |
| Design system setup with mk:ui-design-system | Token extraction → tokens mode | ✅ Available |
| Code Review with mk:review | Design compliance check → analyze mode | 🔜 Planned |

## Gotchas

- **Rate limits.** Figma API has per-user rate limits. Large design files with many components can hit them. The skill retries with exponential backoff (1s → 2s → 4s) then stops.
- **Font loading.** Text operations require `loadFontAsync` before any text edits. Missing fonts cause node errors — the skill detects and handles this.
- **Color scale 0–1.** Figma colors are represented as values between 0 and 1 (e.g. `{r: 1, g: 0.5, b: 0}`), not 0–255. Token extraction converts to hex/rgb automatically.
- **Fills are immutable arrays.** Figma fill arrays cannot be mutated directly — they must be replaced entirely. The implement workflow handles this correctly.
- **Page switching.** Node IDs are page-specific. If a node is not found, the skill tries switching to other pages before reporting an error.

## Related

- [mk:intake](/reference/skills/intake) — ticket analysis that auto-detects Figma URLs
- [mk:frontend-design](/reference/skills/frontend-design) — UI/UX patterns used alongside figma implement mode
- [mk:ui-design-system](/reference/skills/ui-design-system) — design system that consumes token extraction output
- [mk:multimodal](/reference/skills/multimodal) — fallback visual analysis when Figma MCP unavailable
- [mk:cook](/reference/skills/cook) — feature pipeline that calls figma implement mode during Phase 3

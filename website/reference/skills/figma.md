---
title: "mk:figma"
description: "Figma design analysis and implementation via Figma MCP. Parse Figma links, extract design specs, translate to code."
---

# mk:figma

## What This Skill Does

Figma analyzes Figma designs and translates them into code. It operates in three modes: **Analyze** (extract design context for intake/review), **Implement** (pixel-perfect code generation from Figma specs), and **Tokens** (extract design tokens as CSS custom properties or Tailwind config). It integrates with Figma MCP when available; falls back to PNG export + multimodal analysis otherwise.

## When to Use

Triggers:
- "implement this design", "figma link", "design tokens", "design system"
- Figma URL present in a ticket (auto-detected by `mk:intake`)
- UI implementation from Figma spec (invoked by `mk:cook` or `mk:frontend-design`)

Anti-triggers:
- Full design system building with components and variants -- use official `figma-generate-library` skill
- Creating or updating screens IN Figma from code -- use official `figma-generate-design` skill
- Code Connect (`.figma.js` templates) -- use official `figma-code-connect` skill
- Complex multi-phase Figma orchestration -- use official Figma MCP skills directly

## Core Capabilities

- **3 operation modes** -- Analyze (design context report), Implement (7-step Figma-to-code workflow), Tokens (CSS/Tailwind token extraction)
- **URL parsing and validation** -- extracts file key and node ID from Figma URLs; validates against a regex; rejects prototype URLs
- **Design context extraction** -- component tree, layout mode, spacing, text styles, color styles, effect styles via `get_design_context`
- **Screenshot capture** -- visual ground truth for pixel-perfect comparison via `get_screenshot`
- **Design system matching** -- auto-detects Tailwind, MUI, shadcn/ui, or custom CSS variable systems
- **Token extraction** -- color (0-1 to CSS hex), typography, spacing (4px base unit), shadows, border-radius
- **Pre-flight checklist** -- 18-item validation before any Figma operation (file access, fonts, variables, rate limits, design system, assets)
- **PNG fallback** -- when Figma MCP is unavailable, asks user to export frames as PNG and uses `mk:multimodal`

## Arguments

No flags. Mode is determined by the invoking skill:
- `mk:intake` or `mk:review` triggers **Analyze** mode
- `mk:cook` or `mk:frontend-design` triggers **Implement** mode
- `mk:ui-design-system` triggers **Tokens** mode

## Workflow (Implement Mode)

1. **Parse Figma URL** -- extract file key and node ID. Stop if URL is invalid.
2. **Get design context** -- `get_design_context`: component tree, layout, spacing, text styles, colors.
3. **Get screenshot** -- visual reference for post-implementation comparison.
4. **Download assets** -- icons as SVG, photos as WebP/PNG.
5. **Identify design system** -- match Figma tokens to existing project system (Tailwind, MUI, shadcn, custom).
6. **Translate to code** -- structure first, then layout, spacing, typography, colors, effects, interactions, responsive.
7. **Validate visual parity** -- compare implementation to Figma screenshot; fix deltas.

## Usage

```bash
# Analyze (via mk:intake -- auto-detects Figma URLs in tickets)
/mk:intake  # then paste ticket with Figma link

# Implement
/mk:cook "build the login page from this Figma: https://www.figma.com/design/ABC123/..."
```

## Example Prompt

```
Implement this design: https://www.figma.com/design/XYZ789/Dashboard?node-id=2304%3A512
Use our existing Tailwind config and shadcn/ui components.
```

## Common Use Cases

- Extracting design context from a Figma link in a Jira ticket during intake
- Implementing a new UI screen pixel-perfect from a Figma design
- Generating CSS custom properties from a Figma design system file
- Validating that an implementation matches the Figma spec during code review
- Extracting spacing/typography/color tokens to bootstrap a new design system

## Pro Tips

- **Figma prototype links (`/proto/`) are not parseable.** Ask for the `/design/` URL from the editor, not the shareable prototype link.
- **Node IDs change when designers restructure frames.** Always re-extract the node ID from the current URL before any MCP call -- never cache IDs across sessions.
- **Colors are 0-1 scale, not 0-255.** Figma returns `{ r: 0.2, g: 0.4, b: 1.0 }`. Multiply by 255 for CSS: `rgb(51, 102, 255)`.
- **Screenshots at 1x are blurry on Retina displays.** Always request `scale: 2` for assets intended for screen display.
- **Batch more than ~20 nodes and you hit rate limits.** Fetch in batches of <=15 nodes with exponential backoff.
- **MCP unavailable? Export as PNG.** Ask the user to export target frames, then use `mk:multimodal` for analysis.

> **Canonical source:** `.claude/skills/figma/SKILL.md`

# Design Patterns Reference

## Style Categories

When user requests a specific style, apply these characteristics:

| Style | Key traits | Best for |
|-------|-----------|----------|
| Minimalism | White space, limited palette, thin typography | SaaS, portfolios, docs |
| Glassmorphism | Frosted glass, blur, transparency, subtle borders | Dashboards, modals, cards |
| Neumorphism | Soft shadows, extruded/inset, monochrome base | Settings panels, controls |
| Brutalism | Raw, bold type, harsh colors, exposed structure | Creative agencies, portfolios |
| Bento Grid | Card-based grid, mixed sizes, clean gaps | Feature showcases, dashboards |
| Dark Mode | Dark backgrounds, high-contrast accents, reduced blue light | Dev tools, media, productivity |
| Flat Design | No shadows, solid colors, simple shapes | Mobile apps, icons, infographics |
| Skeuomorphism | Real-world textures, depth, realistic elements | Games, music apps, niche tools |

## Color Palette Selection

Match palette to product type:

| Product type | Primary direction | Accent direction |
|-------------|-------------------|------------------|
| SaaS / Business | Blue, Indigo | Green for success, Orange for CTA |
| E-commerce | Brand-specific | Red/Orange for urgency, Green for trust |
| Healthcare | Teal, Blue | Soft green for positive, warm gray for neutral |
| Finance | Navy, Dark blue | Gold/amber for premium, green for growth |
| Creative / Portfolio | Flexible — match brand personality | High-contrast accent |
| Developer tools | Dark bg, cool grays | Cyan/green for syntax, warm for warnings |

## Typography Pairing Principles

- **Heading + Body**: contrast weight/style (e.g., bold geometric heading + regular humanist body)
- **Max 2 families**: one for headings, one for body. More = visual noise.
- **Scale**: use a modular scale (1.25 or 1.333 ratio) for consistent hierarchy
- **Line height**: 1.5–1.75 for body text, 1.1–1.3 for headings
- **Line length**: 65–75 characters for readability

## Spacing

4px is the base unit and layouts step on an 8px rhythm: 4, 8, 12, 16, 24, 32, 48, 64, 80. Use scale values only, with component padding of 12–24px and section spacing of 48–80px. Vary spacing to signal hierarchy instead of using one value everywhere.

## Responsive Breakpoints

Breakpoints follow Tailwind's defaults; the checked width below them is 320px.

| Breakpoint | Target | Design approach |
|-----------|--------|----------------|
| 320px+ | Mobile (small): lowest width to verify | Single column, stacked, thumb-zone navigation |
| 640px+ (`sm`) | Mobile landscape | Wider single column |
| 768px+ (`md`) | Tablet | 2-column options, expanded navigation |
| 1024px+ (`lg`) | Desktop | Full layout, sidebar options, hover states |
| 1280px+ (`xl`), 1536px+ (`2xl`) | Large desktop | Max-width container, wider gutters |

Design mobile-first and enhance upward. Body text is at least 16px on mobile so iOS does not zoom.

## Dark Mode

Build a separate dark palette instead of inverting the light one: dark grey surfaces rather than pure black, text off pure white, saturation reduced by 10–15%, and every contrast ratio re-checked in the dark theme.

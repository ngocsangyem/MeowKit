# Design Data Lookup

> Source: open-source upstream (MIT)
> Data files in assets/. Search each CSV by type with `grep -i`; rows are wide, so do not read a whole file into context.

## Color Palettes (`assets/colors.csv` — 161 palettes)

**When:** Choosing colors for a new project or component.
**How:** Filter by product type column, get hex values for: primary, on-primary, secondary, accent, background, foreground, card, muted, border, destructive, ring.
**All palettes are WCAG 3:1+ verified (most 4.5:1+).**

```
Example: "I need colors for a fintech dashboard"
→ `grep -i fintech assets/colors.csv`, read the matching rows only
→ Get: #F59E0B gold primary + #8B5CF6 purple accent
```

## Font Pairings (`assets/typography.csv` — 73 pairings)

**When:** Selecting typography for a project.
**How:** Filter by mood keywords or use-case. Each row includes: heading font, body font, mood, best-for, Google Fonts URL, Tailwind config snippet.

```
Example: "I need fonts for a tech startup landing page"
→ `grep -iE "bold|innovative" assets/typography.csv`
→ Get: Space Grotesk (heading) + DM Sans (body)
→ Copy the Google Fonts URL and Tailwind config from the row
```

## Product Type Recommendations (`assets/products.csv` — 161 types)

**When:** Starting a new project and need design direction.
**How:** Find the product type row. Get: recommended primary style, secondary styles, landing page pattern, dashboard style, color palette focus, key considerations.

```
Example: "Building a mental health app"
→ `grep -i "mental health" assets/products.csv`
→ Get: calming style, lavender palette, soft animations, accessibility-first
```

## UX Guidelines (`assets/ux-guidelines.csv` — 99 rules)

**When:** Reviewing UI for common UX mistakes.
**How:** Filter by category (navigation, animation, layout, touch, interaction, accessibility, performance, forms, responsive, typography, feedback, content, onboarding, search, AI interaction).

Each row: category, issue, platform, Do/Don't pair, severity (CRITICAL/HIGH/MEDIUM/LOW).

## Chart Types (`assets/charts.csv` — 25 types)

**When:** Choosing chart visualization for data.
**How:** Match your data type to the recommended chart. Each row: data type, best chart, secondary options, accessibility grade, library recommendation.

```
Example: "I need to show trends over time"
→ `grep -iE "time series|trend" assets/charts.csv`
→ Get: Line chart (primary), Area chart (secondary), use Recharts or D3
```

## Lookup Priority

1. **Start with products.csv** — get overall design direction
2. **Then colors.csv** — get specific hex values
3. **Then typography.csv** — get font stack
4. **Then ux-guidelines.csv** — verify against common mistakes
5. **charts.csv** — only if data visualization needed

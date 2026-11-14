# Anti-Slop Directives

Patterns that mark AI-generated UI as generic and forgettable. Avoid all of them.

## Patterns to Avoid

| Pattern | Why It's Slop |
|---|---|
| Generic gradient: `#667eea → #764ba2` (purple-blue) | Appears in thousands of AI-generated UIs. Instantly recognizable as default output. |
| Excessive rounded corners (`border-radius: 24px+` on everything) | Signals no intentional design decision was made. |
| "Welcome to [App Name]" hero headline | Zero specificity. Says nothing about what the app does or why it matters. |
| Default MUI / Shadcn component themes without customization | Ships what the library ships. No design identity. |
| Placeholder images (`via.placeholder.com`, gray boxes) | Signals the design is incomplete, not production-ready. |
| Generic equal-height card grid (3 columns, same padding everywhere) | The default layout when no layout decision is made. |
| AI-generated SVG patterns as background decoration | Visually busy, semantically empty, universally recognizable as filler. |

## Use Instead

| Instead of | Use |
|---|---|
| Generic gradient | Specific palette from `mk:ui-design-system/assets/colors.csv` matched to the product's emotional tone |
| Excessive rounding | Intentional corner radius scale: sharp for data-dense UIs, rounded for consumer apps — applied consistently |
| "Welcome to [App]" | Specific value proposition: what the user can do, not what the app is called |
| Default component theme | Override at minimum: primary color, font, border radius, shadow scale |
| Placeholder images | Real screenshots, product UI captures, or abstract geometric art with brand colors |
| Equal card grid | Asymmetric layouts, feature highlight cards, bento grids, or 2-column with varied card weights |
| SVG filler patterns | Purposeful whitespace, or a single illustration tied to the product's domain |

## The Identity Test

Before delivery, remove the logo and brand name from the design. Could this be any other app in the same category?

If yes — it's slop. Add one specific, opinionated design decision that makes this design belong only to this product. That decision becomes the design's signature.

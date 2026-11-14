# SVG Authoring and Recovery

## SVG rules

- Start with `viewBox="0 0 960 600"`; use `960 800` for tall and `1200 600` for wide diagrams.
- Embed fonts in `<style>`; never use external `@import`.
- Define markers, gradients, filters, and clip paths in `<defs>`.
- Use text of at least 12px (13–14px labels, 11px sub-labels, 16–18px titles).
- Use `<marker>` arrows with `markerWidth="10" markerHeight="7"`; apply `<feDropShadow>` sparingly.
- Use cubic Bézier paths (`M … C …`) for feedback loops and `clipPath` when node text may overflow.

## Safe hand-authored output

Execute the bundled helper instead of placing a shell heredoc inline:

```bash
printf '%s\n' \
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 700">' \
  '  <text x="40" y="60">Example</text>' \
  '</svg>' \
  | python3 .agents/skills/tech-graph/scripts/generate-svg-from-lines.py /path/to/output.svg
```

The helper writes each supplied line, closes the output safely, and rejects an empty or unterminated SVG. Use `generate-from-template.py` when a supported template and JSON data fit the request; all user-provided text must stay in its JSON boundary so the generator can XML-escape it.

## Before generation

1. Confirm the complete content and all parameters are prepared.
2. Check the prepared SVG syntax before executing a command.
3. If either check fails, prepare the content first; do not issue a partial or empty command.

## Error recovery

- First error: identify the root cause and apply a targeted fix.
- Second error: change approach, such as template generation to hand-authored line generation.
- Third error: stop and report the failure; do not retry the same command indefinitely.

Common corrections:

| Invalid | Correct |
| --- | --- |
| `yt-anchor` | `y="60" text-anchor="middle"` |
| `x="390` | `x="390" y="250"` |
| `fill=#fff` | `fill="#ffffff"` |
| `marker-end=` | `marker-end="url(#arrow)"` |
| `L 29450` | `L 290,220` |
| missing end tag | `</svg>` |

## Validate and inspect

Run `bash .agents/skills/tech-graph/scripts/validate-svg.sh <svg-file>`. When available, also run:

```bash
rsvg-convert file.svg -o /tmp/test.png 2>&1 && echo "✓ Valid" && rm /tmp/test.png
```

Inspect rendered PNGs when the runtime supports image reading. Fix component/arrow collisions, label overlap, narrow gutters, covered legends, or clipped content before delivery. The temporary PNG is only for ephemeral validation.

## Common gotchas

- Style 8 is AI-authored and unsupported by `generate-from-template.py`; hand-author it using `references/style-8-dark-luxury.md`.
- Badge-style labels can clutter dark diagrams; use `"label_style": "offset"` where needed.
- `rsvg-convert` is not bundled. Its absence must not block SVG delivery.
- `generate-from-template.py` XML-escapes JSON text values; do not bypass that data boundary with unescaped user strings.

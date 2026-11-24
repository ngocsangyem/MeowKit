# Design Rules Reference


## Typography

### Hierarchy (from largest to smallest)
```
Display:  2.5-4rem,  font-weight 700-900, tracking tight
Heading:  1.5-2.5rem, font-weight 600-700
Subhead:  1.125-1.5rem, font-weight 500-600
Body:     1rem (16px), font-weight 400, line-height 1.5-1.75
Caption:  0.75-0.875rem, font-weight 400, muted color
```

### Font Pairing Strategy
- Sans-serif heading + sans-serif body (safe, modern)
- Serif heading + sans-serif body (editorial, premium)
- Never: two decorative fonts together, more than 2 families

### Anti-Patterns
- All text same size → must have 3+ distinct sizes
- Font weight only 400 → use two or three weights (for example 400 and 600/700)
- Line height < 1.4 for body text → minimum 1.5

## Color

### Palette Structure
```
Primary:  1 color (brand identity, CTAs)
Accent:   1 color (highlights, interactive states)
Neutral:  3-5 shades (gray-50 to gray-900 for text/bg)
Semantic: success (#22c55e), warning (#f59e0b), error (#ef4444), info (#3b82f6)
```

### Rules
- Maximum 5 distinct hue families in any design
- Text color: #111827 (gray-900) not #000
- Background: #fafafa or #f9fafb not #fff
- Contrast: WCAG AA; ratios in `mk:ui-design-system`
- Dark mode: a separate palette, not an inversion (see the design-patterns reference of `mk:ui-design-system`)

## Motion

### When to Animate
- State transitions (hover, focus, active)
- Enter/exit (mount/unmount components)
- Feedback (success, error, loading)

### When NOT to Animate
- Static content display
- Already-visible elements on scroll (unless reveal pattern)
- Purely decorative motion (wastes GPU/battery)

Timing and easing values: the accessibility-standards reference of `mk:ui-design-system`.

## Spacing and responsive

Spacing scale, breakpoints and dark mode live in the design-patterns reference of `mk:ui-design-system`. Design mobile first, expand upward, and vary spacing for hierarchy.

## Accessibility

Contrast ratios, large-text size, touch targets, keyboard and screen-reader rules, and the audit commands are in the accessibility-standards reference of `mk:ui-design-system`. The target is WCAG AA; check the project's stated version.

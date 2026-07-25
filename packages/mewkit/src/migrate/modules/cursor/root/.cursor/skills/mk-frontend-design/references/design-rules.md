# Design Rules Reference


## Contents

- [Typography](#typography)
  - [Hierarchy (from largest to smallest)](#hierarchy-from-largest-to-smallest)
  - [Font Pairing Strategy](#font-pairing-strategy)
  - [Anti-Patterns](#anti-patterns)
- [Color](#color)
  - [Palette Structure](#palette-structure)
  - [Rules](#rules)
- [Spacing](#spacing)
  - [Scale (4px base)](#scale-4px-base)
  - [Rules](#rules)
- [Motion](#motion)
  - [When to Animate](#when-to-animate)
  - [When NOT to Animate](#when-not-to-animate)
  - [Timing](#timing)
- [Responsive](#responsive)
  - [Breakpoints (Tailwind convention)](#breakpoints-tailwind-convention)
  - [Mobile-First Rules](#mobile-first-rules)
- [Accessibility (WCAG 2.1 AA)](#accessibility-wcag-21-aa)
  - [Required](#required)
  - [Testing](#testing)

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
- Font weight only 400 → use at least 400, 500, and 700
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
- Contrast: WCAG AA minimum (4.5:1 text, 3:1 large text)
- Dark mode: invert neutrals, reduce saturation by 10-15%

## Spacing

### Scale (4px base)
```
0: 0px     1: 4px     2: 8px     3: 12px
4: 16px    5: 20px    6: 24px    8: 32px
10: 40px   12: 48px   16: 64px   20: 80px
```

### Rules
- Use scale values only — no arbitrary numbers
- Component internal padding: 12-24px (3-6 units)
- Section spacing: 48-80px (12-20 units)
- Never use same spacing everywhere — vary for hierarchy

## Motion

### When to Animate
- State transitions (hover, focus, active)
- Enter/exit (mount/unmount components)
- Feedback (success, error, loading)

### When NOT to Animate
- Static content display
- Already-visible elements on scroll (unless reveal pattern)
- Purely decorative motion (wastes GPU/battery)

### Timing
```
Micro:    100-200ms (hover, focus, toggle)
Standard: 200-300ms (panel open, navigation)
Complex:  300-500ms (page transition, modal)
Easing:   ease-out for enter, ease-in for exit
```

## Responsive

### Breakpoints (Tailwind convention)
```
sm:  640px   (mobile landscape)
md:  768px   (tablet portrait)
lg:  1024px  (tablet landscape / small desktop)
xl:  1280px  (desktop)
2xl: 1536px  (large desktop)
```

### Mobile-First Rules
- Design mobile layout first, then expand
- Touch targets: minimum 44×44px
- Text: minimum 16px on mobile (prevents iOS zoom)
- Test: thumb reach zone (bottom-center is prime real estate)

## Accessibility (WCAG 2.1 AA)

### Required
- Color contrast: 4.5:1 (normal text), 3:1 (large text ≥18px bold or ≥24px)
- Keyboard navigation: all interactive elements focusable
- Focus indicators: visible, high contrast ring
- Screen reader: all images have alt text, forms have labels
- Reduced motion: respect `prefers-reduced-motion` media query

### Testing
```bash
# Lighthouse accessibility audit
npx lighthouse --only-categories=accessibility http://localhost:3000

# axe-core for component-level
npm install @axe-core/playwright  # for e2e
```
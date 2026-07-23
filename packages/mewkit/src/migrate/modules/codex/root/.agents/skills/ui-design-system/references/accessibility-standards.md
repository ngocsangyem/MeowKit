# Accessibility Standards (WCAG 2.1 AA)

Non-negotiable. Every UI component must pass these checks.

## Color Contrast

| Element | Minimum ratio | Tool |
|---------|:---:|------|
| Normal text (<18px) | 4.5:1 | Check with contrast checker |
| Large text (≥18px or ≥14px bold) | 3:1 | — |
| UI components & graphical objects | 3:1 | Borders, icons, form controls |
| Decorative elements | No requirement | — |

**Rule:** Never use color alone to communicate information. Always pair with icon, text, or pattern.

## Touch Targets

| Element | Minimum size | Minimum spacing |
|---------|:---:|:---:|
| Buttons, links, controls | 44×44px | 8px gap between targets |
| Icon-only buttons | 48×48px (larger for no label) | 8px |
| Form inputs | 44px height minimum | — |

## Keyboard Navigation

- All interactive elements reachable via Tab
- Visible focus indicator (2px+ outline, 3:1 contrast)
- Escape closes modals/dropdowns
- Arrow keys navigate within groups (tabs, menus, lists)
- No keyboard traps (can always Tab out)

## Screen Readers

- All images: meaningful `alt` text or `aria-hidden="true"` for decorative
- Heading hierarchy: h1 → h2 → h3 (no skipping levels)
- Form inputs: associated `<label>` or `aria-label`
- ARIA landmarks: `<main>`, `<nav>`, `<aside>`, `<footer>`
- Dynamic content: `aria-live="polite"` for updates

## Motion & Animation

- Respect `prefers-reduced-motion` — disable non-essential animations
- Animation duration: 150–300ms for micro-interactions
- No auto-playing video/audio without user control
- Loading spinners: include `aria-busy="true"` on container

## Forms

- Error messages adjacent to field (not just top of form)
- Required fields: visual indicator + `aria-required="true"`
- Inline validation on blur (not keystroke)
- Clear error recovery path (what went wrong + how to fix)

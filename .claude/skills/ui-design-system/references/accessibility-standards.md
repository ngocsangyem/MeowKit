# Accessibility Standards (WCAG AA)

The target is WCAG AA. Check the project's stated version; the values below hold for 2.1 and 2.2. A component that fails one of these is not ready, because users who cannot meet the visual or pointer assumption cannot use it. Scale the pass to the change: a one-colour fix needs the contrast section only.

## Color Contrast

| Element | Minimum ratio | Tool |
|---------|:---:|------|
| Normal text (below the large-text size) | 4.5:1 | A contrast checker or `npx lighthouse --only-categories=accessibility <url>` |
| Large text (≥24px, or ≥18.66px bold) | 3:1 | — |
| UI components & graphical objects | 3:1 | Borders, icons, form controls |
| Decorative elements | No requirement | — |

**Rule:** Never use color alone to communicate information. Always pair with icon, text, or pattern.

## Touch Targets

| Element | Minimum size | Minimum spacing |
|---------|:---:|:---:|
| Buttons, links, controls | 44×44px recommended (WCAG 2.2 AA floor is 24×24px) | 8px gap between targets |
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
- Duration: micro-interactions 100–200ms, panels and navigation 200–300ms, page transitions and modals 300–500ms; ease-out for enter, ease-in for exit
- No auto-playing video/audio without user control
- Loading spinners: include `aria-busy="true"` on container

## Forms

- Error messages adjacent to field (not just top of form)
- Required fields: visual indicator + `aria-required="true"`
- Inline validation on blur (not keystroke)
- Clear error recovery path (what went wrong + how to fix)

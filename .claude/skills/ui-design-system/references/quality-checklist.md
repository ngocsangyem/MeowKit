# UI Quality Checklist

Handoff aid. Walk every group for a new component or a design system; for a patch, walk only the groups the change touched. Numeric values come from `accessibility-standards.md` and `design-patterns.md`.

## Visual Quality

- [ ] No emoji used as icons — use SVG or icon library
- [ ] Consistent spacing from the scale in `design-patterns.md`
- [ ] Color palette limited to 1 primary + 1 accent + neutrals
- [ ] Typography uses max 2 font families
- [ ] All interactive elements have hover, active, focus, disabled states
- [ ] Dark mode is a separate palette: dark grey (not pure black) surfaces, contrast re-checked

## Responsive

- [ ] Works at 320px width (no horizontal scroll)
- [ ] Touch targets meet `accessibility-standards.md`
- [ ] Navigation collapses to hamburger/bottom nav on mobile
- [ ] Images scale without distortion
- [ ] Tables scroll horizontally or restructure on mobile

## Accessibility

- [ ] Color contrast passes WCAG AA (ratios in `accessibility-standards.md`)
- [ ] All images have alt text (or aria-hidden for decorative)
- [ ] Keyboard navigation works for all interactive elements
- [ ] Focus indicators visible (2px+ outline)
- [ ] Form fields have labels
- [ ] Error messages are descriptive and adjacent to field

## Performance

- [ ] Images optimized (WebP/AVIF, appropriate dimensions)
- [ ] Fonts loaded with `font-display: swap`
- [ ] No layout shift from loading content (CLS < 0.1)
- [ ] Critical CSS inlined or preloaded
- [ ] Lazy load below-fold images

## Interaction

- [ ] Loading states for async actions (spinners, skeletons)
- [ ] Empty states designed (not just blank screens)
- [ ] Error states have recovery path
- [ ] Success feedback for completed actions (toast, checkmark)
- [ ] Confirmation for destructive actions (delete, discard)

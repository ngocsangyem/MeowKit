# UI Quality Checklist

Run through before any design handoff. All items must pass.

## Visual Quality

- [ ] No emoji used as icons — use SVG or icon library
- [ ] Consistent spacing (8px rhythm: 8, 16, 24, 32, 48)
- [ ] Color palette limited to 1 primary + 1 accent + neutrals
- [ ] Typography uses max 2 font families
- [ ] All interactive elements have hover, active, focus, disabled states
- [ ] Dark mode: backgrounds use true dark (not pure black), text has sufficient contrast

## Responsive

- [ ] Works at 320px width (no horizontal scroll)
- [ ] Touch targets ≥44×44px on mobile
- [ ] Navigation collapses to hamburger/bottom nav on mobile
- [ ] Images scale without distortion
- [ ] Tables scroll horizontally or restructure on mobile

## Accessibility

- [ ] Color contrast passes WCAG 2.1 AA (4.5:1 normal, 3:1 large)
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

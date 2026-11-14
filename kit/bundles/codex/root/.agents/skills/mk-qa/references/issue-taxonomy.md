# QA Issue Taxonomy

## Severity Levels

| Severity | Definition | Examples |
|----------|------------|----------|
| **critical** | Blocks a core workflow, causes data loss, or crashes the app | Form submit causes error page, checkout flow broken, data deleted without confirmation |
| **high** | Major feature broken or unusable, no workaround | Search returns wrong results, file upload silently fails, auth redirect loop |
| **medium** | Feature works but with noticeable problems, workaround exists | Slow page load (>5s), form validation missing but submit still works, layout broken on mobile only |
| **low** | Minor cosmetic or polish issue | Typo in footer, 1px alignment issue, hover state inconsistent |

## Categories

### 1. Visual/UI
- Layout breaks (overlapping elements, clipped text, horizontal scrollbar)
- Broken or missing images, incorrect z-index
- Font/color inconsistencies, animation glitches
- Alignment issues, dark mode / theme issues

### 2. Functional
- Broken links (404, wrong destination), dead buttons
- Form validation (missing, wrong, bypassed)
- Incorrect redirects, state not persisting
- Race conditions (double-submit, stale data)

### 3. UX
- Confusing navigation, missing loading indicators
- Slow interactions (>500ms with no feedback)
- Unclear error messages, no confirmation before destructive actions
- Dead ends (no way back, no next action)

### 4. Content
- Typos, outdated text, placeholder/lorem ipsum
- Truncated text, wrong labels, missing empty states

### 5. Performance
- Slow page loads (>3s), janky scrolling
- Layout shifts, excessive network requests (>50/page)
- Large unoptimized images, blocking JavaScript

### 6. Console/Errors
- JavaScript exceptions, failed network requests (4xx, 5xx)
- Deprecation warnings, CORS errors
- Mixed content warnings, CSP violations

### 7. Accessibility
- Missing alt text, unlabeled form inputs
- Keyboard navigation broken, focus traps
- Missing ARIA attributes, insufficient color contrast

## Per-Page Exploration Checklist

For each page visited during QA:

1. **Visual scan** — Screenshot. Look for layout issues, broken images, alignment.
2. **Interactive elements** — Click every button, link, control. Does each work?
3. **Forms** — Fill and submit. Test empty, invalid, edge cases (long text, special chars).
4. **Navigation** — All paths in/out. Breadcrumbs, back button, deep links, mobile menu.
5. **States** — Empty state, loading state, error state, overflow state.
6. **Console** — Check for JS errors or failed requests after interactions.
7. **Responsiveness** — Mobile and tablet viewports if relevant.
8. **Auth boundaries** — Logged out behavior? Different user roles?

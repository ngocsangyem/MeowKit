# Browser QA Checklist

4-phase protocol for systematic web application QA. Complete all phases before issuing a verdict.

## Contents

- [Phase 1: Smoke Test](#phase-1-smoke-test)
- [Phase 2: Interaction Testing](#phase-2-interaction-testing)
- [Phase 3: Visual Regression](#phase-3-visual-regression)
- [Phase 4: Accessibility](#phase-4-accessibility)
- [Verdict Taxonomy](#verdict-taxonomy)


## Phase 1: Smoke Test

Confirm the app is alive and not catastrophically broken before deeper testing.

**Steps:**
1. Navigate to the target URL — confirm page loads (HTTP 200, no blank screen)
2. Open DevTools → Console tab — note all errors and warnings
   - Filter out known analytics noise (Google Analytics, Hotjar, Segment init messages)
   - Flag any `Uncaught Error`, `Unhandled Promise Rejection`, `404`, or React hydration errors
3. Open DevTools → Network tab — filter to errors
   - Flag any 4xx or 5xx responses on page load
   - Flag any failed resource loads (JS, CSS, fonts)
4. Screenshot desktop viewport (1440px wide)
5. Screenshot mobile viewport (375px wide)
6. Check Core Web Vitals in DevTools → Lighthouse or Performance panel:
   - LCP (Largest Contentful Paint): target <2.5s, flag if >4s
   - CLS (Cumulative Layout Shift): target <0.1, flag if >0.25
   - INP (Interaction to Next Paint): target <200ms, flag if >500ms

**Smoke test pass:** page loads, no console errors, no 5xx, screenshots taken.

---

## Phase 2: Interaction Testing

Click everything. Submit every form. Follow every user journey.

**Navigation:**
- Click all nav links — confirm each resolves to correct page, no 404
- Test browser back button — confirm state preserved or gracefully reset
- Test deep links (paste URL directly) — confirm page renders correctly

**Forms:**
- Submit each form with valid data — confirm success state
- Submit each form with empty required fields — confirm validation errors shown
- Submit each form with invalid formats (bad email, short password) — confirm field-level errors
- Test form submission on slow connection (DevTools → Network → Slow 3G)

**Auth flow:**
- Sign up with new account
- Log in with valid credentials
- Log in with invalid credentials — confirm error message (not a server crash)
- Log out — confirm session cleared, redirect to login

**Critical user journeys** (define per-app, examples):
- E-commerce: browse → add to cart → checkout → order confirmation
- SaaS: sign up → complete onboarding → use core feature → invite teammate
- Content: create item → edit item → publish → view published

---

## Phase 3: Visual Regression

Check layout at all breakpoints. Flag shifts and broken layouts.

**Viewport screenshots:**
- 375px (iPhone SE — smallest common mobile)
- 768px (iPad portrait — tablet breakpoint)
- 1440px (standard desktop)

**Checks at each viewport:**
- Navigation is accessible (hamburger menu works on mobile)
- Text does not overflow containers
- Images are not stretched or cropped incorrectly
- CTA buttons are tappable (min 44×44px touch target)
- No horizontal scroll on mobile

**Layout shift detection:**
- Flag any element that shifts position after initial paint (CLS >0.1)
- Common causes: images without dimensions, late-loading fonts, dynamic content injection

**Dark mode** (if supported):
- Toggle dark mode — confirm no pure white elements remain (blinding)
- Confirm text contrast meets WCAG AA (4.5:1 minimum)

---

## Phase 4: Accessibility

Run automated checks, then verify manually for the most impactful issues.

**Automated:**
- Run axe-core via DevTools extension or `npx axe <url>`
- Flag all WCAG AA violations (not just warnings)
- Common critical failures: missing alt text, missing form labels, insufficient contrast, missing landmark regions

**Manual checks:**
- Keyboard navigation: press Tab to move through the page — every interactive element must be reachable and have visible focus indicator
- Skip links: pressing Tab from the top should offer "Skip to main content"
- Landmarks: page must have `<main>`, `<nav>`, `<header>` — verify with axe or screen reader

---

## Verdict Taxonomy

**SHIP** — All 4 phases pass. No critical or high findings.

**SHIP WITH FIXES** — Medium findings only. List specific items. Can ship if fixes are committed before merge.

**BLOCK** — Any critical finding (console error on load, auth bypass, WCAG AA violation on primary flow, 5xx on core journey). Do not ship until resolved.

Each finding in the report must include: phase found, severity (critical/high/medium/low), description, screenshot path, and recommended fix.
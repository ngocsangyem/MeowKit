# Scoring and taxonomy

## Severity

| Severity | Definition | Examples |
|---|---|---|
| critical | Blocks a core workflow, loses data or crashes the app | Submit causes an error page, checkout broken, data deleted without confirmation |
| high | Major feature broken, no workaround | Search returns wrong results, upload silently fails, auth redirect loop |
| medium | Works with noticeable problems, a workaround exists | Page load over 5s, validation missing but submit works, mobile-only layout break |
| low | Cosmetic or polish | Typo in footer, 1px misalignment, inconsistent hover state |

## Categories

Visual/UI (layout breaks, broken images, z-index, theme issues), Functional (dead links and buttons, validation, redirects, state that does not persist, double-submit), UX (confusing navigation, no loading indicator, unclear errors, no confirmation before a destructive action, dead ends), Content (typos, placeholder text, truncation, wrong labels), Performance (loads over 3s, layout shift, more than about 50 requests per page, large images), Console/Errors (exceptions, failed requests, CORS, CSP, mixed content), Accessibility (alt text, form labels, keyboard navigation and focus, ARIA, contrast).

## Per-page checklist

1. Visual scan of the annotated screenshot.
2. Click every button, link and control.
3. Forms: valid, empty, invalid, long text, special characters.
4. Navigation in and out: breadcrumbs, back button, deep links, mobile menu.
5. States: empty, loading, error, overflow.
6. Console and failed requests after each interaction.
7. Mobile (375px) and tablet (768px) viewports where relevant.
8. Auth boundaries: logged out, different roles.

Quick mode only visits the homepage and the top five navigation targets and asks: does it load, are there console errors, are links broken.

Deeper checks, when the app warrants them: smoke test (loads, no console errors, no 5xx; the Core Web Vitals LCP under 2.5s, CLS under 0.1, INP under 200ms if you can measure them), keyboard tab order with visible focus, a skip link and landmarks, and an automated accessibility scan (`npx --yes @axe-core/cli@4.14.0 <url>`; the unscoped `axe` package is an unrelated logger) for WCAG AA violations.

## Health score

Each category scores 0 to 100, then the weighted average is the score.

- **Console** (15%): 0 errors 100; 1 to 3 errors 70; 4 to 10 errors 40; more than 10 errors 10.
- **Links** (10%): 100 minus 15 per broken link, minimum 0.
- **Other categories**: start at 100 and deduct per finding: critical 25, high 15, medium 8, low 3, minimum 0.

| Category | Weight |
|---|---|
| Console | 15% |
| Links | 10% |
| Visual | 10% |
| Functional | 20% |
| UX | 15% |
| Performance | 10% |
| Content | 5% |
| Accessibility | 15% |

`score = sum(category score x weight)`. The weights are a convention; the aim is a number that moves when real defects are fixed, so keep them fixed between a baseline and its re-run.

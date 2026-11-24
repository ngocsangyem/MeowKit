# Browser-based visual QA

For a UI change that passes its unit and integration tests, check the page in a browser at three breakpoints. `mk:qa` runs the full test-and-fix pass and `mk:agent-browser` drives the browser; this file keeps the breakpoint table and the report shape.

| Breakpoint | Width | Device class |
|---|---|---|
| Mobile | 375px | small phone |
| Tablet | 768px | medium tablet |
| Desktop | 1280px | laptop |

At each width, wait for the page to settle (network idle, no running animation), take a full-page screenshot, and check content visibility, layout integrity (no overlap, no horizontal scroll), reflow and interactive states. Collect console errors, failed requests (4xx, 5xx, network errors) and missing assets. With baseline screenshots, a pixel diff above about 1% is worth a look.

Save screenshots and the report under `tasks/reports/qa/` (the `mk:qa` convention). The report lists, per breakpoint, the screenshot and PASS or FAIL, then console errors, failed requests and layout issues, then a one-line verdict. FAIL when any check failed; list every failure.

For CI, run it after the integration tests and keep baselines in version control, updating them only when the UI change is intended.

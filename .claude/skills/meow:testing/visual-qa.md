# Skill: Browser-Based Visual QA

**Purpose:** Perform visual quality assurance by testing UI in a browser at multiple breakpoints, checking for layout issues, console errors, and failed requests.

## When to Use

Invoke this skill after any UI change is implemented and passes unit/integration tests. Run before shipping.

---

## Steps

### Step 1: Start Browser Session

Launch a headless browser session (Puppeteer, Playwright, or equivalent).

```bash
# Example with Playwright
npx playwright test --headed  # for debugging
npx playwright test            # headless for CI
```

### Step 2: Navigate to Target URL

Navigate to the page or component being tested. If testing locally:
- Ensure the dev server is running
- Use `http://localhost:[port]/[path]`

### Step 3: Screenshot at Key Breakpoints

Capture screenshots at three standard breakpoints:

| Breakpoint | Width | Device Class |
|-----------|-------|-------------|
| Mobile | 375px | iPhone SE / small Android |
| Tablet | 768px | iPad / medium tablet |
| Desktop | 1280px | Standard laptop |

For each breakpoint:
1. Set viewport to the target width
2. Wait for page to be fully loaded (network idle + no pending animations)
3. Take a full-page screenshot
4. Save as `qa/screenshots/[page]-[breakpoint]-[date].png`

### Step 4: Compare Against Expected Layout

Check each screenshot for:
- **Content visibility** — all expected text, images, and interactive elements are present
- **Layout integrity** — no overlapping elements, no horizontal scroll, proper spacing
- **Responsive behavior** — content reflows correctly at each breakpoint
- **Interactive states** — hover, focus, active states work (if applicable)

If baseline screenshots exist, perform pixel-diff comparison. Flag differences above a configurable threshold (default: 1% pixel difference).

### Step 5: Check for Runtime Issues

At each breakpoint, collect:

**Console Errors:**
```javascript
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text())
})
```

**Failed Network Requests:**
```javascript
page.on('requestfailed', req => {
  failures.push({ url: req.url(), error: req.failure().errorText })
})
```

**Check for:**
- [ ] No console errors
- [ ] No failed network requests (4xx, 5xx, network errors)
- [ ] No unhandled promise rejections
- [ ] No missing assets (images, fonts, stylesheets)

### Step 6: Generate Visual QA Report

Create a report at `qa/reports/visual-qa-[date].md`:

```markdown
# Visual QA Report

**Date:** YYYY-MM-DD
**Page:** [URL or route]
**Tester:** [agent or human]

## Screenshots

| Breakpoint | Screenshot | Status |
|-----------|-----------|--------|
| Mobile (375px) | [link] | PASS/FAIL |
| Tablet (768px) | [link] | PASS/FAIL |
| Desktop (1280px) | [link] | PASS/FAIL |

## Console Errors
- [None / list of errors]

## Failed Network Requests
- [None / list of failures]

## Layout Issues
- [None / description of issues found]

## Verdict
**PASS** / **FAIL** — [summary]
```

## Verdict Criteria

- **PASS** — No console errors, no failed requests, no layout issues at any breakpoint
- **FAIL** — Any of the above checks failed. List all failures in the report.

## Automation

For CI integration, add visual QA as a pipeline step that runs after integration tests and before the ship gate. Store baseline screenshots in version control and update them deliberately when UI changes are intentional.

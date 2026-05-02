---
title: "mk:playwright-cli"
description: "Session-persistent browser automation — form filling, screenshots, data extraction, multi-step flows. NOT for AI-driven long flows (mk:agent-browser)."
---

# mk:playwright-cli

Browser automation via Playwright CLI. Uses accessibility tree refs (`e1`, `e2`, ...) for interaction. NOT for single-shot screenshots (use `mk:browse`); NOT for AI-driven long autonomous flows (use `mk:agent-browser`); NOT for generating `.spec.ts` E2E code (use `mk:qa-manual`).

## When to use

DOM interaction, navigation, data extraction, or generating reusable `.spec.ts` E2E test code. Use `mk:agent-browser` when session persistence (auth flows, MFA, cookie import) is required.

## Quick start

```bash
playwright-cli open https://playwright.dev
playwright-cli snapshot              # Get element refs (e1, e2, ...)
playwright-cli click e15
playwright-cli type "page.click"
playwright-cli press Enter
playwright-cli screenshot
playwright-cli close
```

## Core workflow

1. `open <url>` — navigate
2. `snapshot` — accessibility tree with refs
3. Interact: `click`, `fill`, `type`, `select`, `check`
4. Re-snapshot after DOM changes
5. `close` when done

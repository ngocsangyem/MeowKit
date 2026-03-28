---
title: "meow:agent-browser"
description: "Chrome/Chromium browser automation via CDP for page navigation, form filling, screenshots, session persistence, and auth flows."
---

# meow:agent-browser

Chrome/Chromium browser automation via CDP for page navigation, form filling, screenshots, session persistence, and auth flows.

## What This Skill Does

`meow:agent-browser` wraps the `agent-browser` CLI (vercel-labs) to control Chrome/Chromium directly via Chrome DevTools Protocol. Its key advantage over other browser skills is **session persistence** — it can import auth from your real browser, save/restore session state, and use persistent profiles. This makes it the best choice for authenticated flows.

## Core Capabilities

- **CDP-based control** — Direct Chrome DevTools Protocol, not Playwright wrapper
- **Session persistence** — Profiles, session names, state files for auth reuse
- **Auth import** — Grab cookies from a running Chrome instance (`--auto-connect`)
- **Element references** — Snapshot with `@e1`, `@e2` refs for precise interaction
- **Video recording** — Record browser sessions for debugging
- **Proxy support** — Route through HTTP/SOCKS proxies

## When to Use This

::: tip Use agent-browser when...
- You need authenticated browser sessions that persist
- You need to import auth from your real browser
- You're testing flows that require complex session management
- You need video recording of browser interactions
:::

::: warning For simpler browser tasks...
- Quick QA checks → use [`meow:browse`](/reference/skills/browse) ($B binary, faster)
- Playwright code generation → use [`meow:playwright-cli`](/reference/skills/playwright-cli)
:::

## Usage

```bash
# Navigate and interact
agent-browser open https://example.com
agent-browser snapshot -i          # see elements with @e1, @e2 refs
agent-browser fill @e1 "user@example.com"
agent-browser click @e3

# Import auth from your running Chrome
agent-browser --auto-connect state save ./auth.json
agent-browser --state ./auth.json open https://app.example.com/dashboard

# Persistent profile (stays logged in across sessions)
agent-browser --profile ~/.myapp open https://app.example.com
```

## Example Prompts

| Prompt | What happens |
|--------|-------------|
| `open the dashboard and take a screenshot` | Navigate → wait for load → screenshot |
| `log in with my browser session` | Import auth from running Chrome → navigate |
| `test the checkout flow` | Navigate → fill form → submit → verify |

## Quick Workflow

```
agent-browser open [url]
  → agent-browser snapshot -i (get element refs)
  → agent-browser fill/click (interact using refs)
  → agent-browser snapshot (verify result)
```

::: info Skill Details
**Phase:** 2–4
:::

## Gotchas

- **Stale refs after dynamic DOM updates**: Modals, infinite scroll, and tab switches all invalidate refs silently — commands succeed but target the wrong element. Re-run `snapshot -i` after any interaction that causes DOM change, not just navigation.
- **Cross-origin iframes block CDP**: Sandboxed iframes (Stripe, reCAPTCHA) appear in snapshot but `fill`/`click` fail silently. Use `screenshot --annotate` to confirm reachability; use `--auto-connect` against a browser where user has already interacted.
- **JavaScript dialogs freeze all commands**: An unhandled `alert()`/`confirm()`/`prompt()` times out every subsequent command. Run `agent-browser dialog status` first when debugging unexpected timeouts; dismiss with `dialog accept` or `dismiss`.

## Related

- [`meow:browse`](/reference/skills/browse) — Faster headless browser for QA patterns
- [`meow:playwright-cli`](/reference/skills/playwright-cli) — Playwright-based with code generation
- [`meow:qa-manual`](/reference/skills/qa-manual) — Orchestrates all three for spec-driven QA

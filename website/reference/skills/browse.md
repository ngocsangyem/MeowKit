---
title: "mk:browse"
description: "Fast headless Chromium browser for single-shot site verification and evidence capture — navigate, interact, screenshot, diff, verify state. Persistent state between calls."
---

## What This Skill Does

Provides a persistent headless Chromium browser session for QA testing and dogfooding. Browser state (cookies, localStorage, tabs, login sessions) persists between calls within a session. All interactions use the `$B` alias. Supports 40+ commands across navigation, reading, interaction, inspection, visual capture, snapshot/diff, tabs, and server management.

## When to Use

- "open in browser", "take a screenshot", "dogfood this"
- Verifying a deployment or feature works end-to-end
- Filing bugs with visual evidence (annotated screenshots, console errors, network logs)
- Testing user flows (login, forms, uploads, dialogs)
- Comparing responsive layouts or diffing environments (staging vs prod)
- Single-shot interactions — one click, one screenshot, one state check

**NOT for:** systematic QA passes with health scores/fix loops (use `mk:qa`), multi-step session-persistent flows (use `mk:playwright-cli`), E2E test code generation (use `mk:qa-manual`), AI-autonomous long sessions (use `mk:agent-browser`).

## Example Prompt

```
Open https://staging.example.com/login, fill in the test credentials, verify the dashboard loads, take a full-page screenshot, and diff it against last week's screenshot to catch visual regressions.
```

## Core Capabilities

| Category | Commands |
|----------|---------|
| Navigation | `goto`, `back`, `forward`, `reload`, `url` |
| Reading | `text`, `html`, `links`, `accessibility`, `forms` |
| Interaction | `click`, `fill`, `select`, `hover`, `press`, `upload`, `scroll`, `type`, `viewport` |
| Inspection | `attrs`, `console`, `cookies`, `css`, `is`, `js`, `network`, `perf`, `storage` |
| Visual | `screenshot`, `snapshot` (with 8 flags), `diff`, `pdf`, `responsive` |
| Tabs | `tabs`, `newtab`, `tab`, `closetab` |
| Server | `handoff`, `resume`, `restart`, `status`, `stop` |

## The `$B` Alias

All commands must be prefixed with `$B`. This is a shell alias that must be set before first use:

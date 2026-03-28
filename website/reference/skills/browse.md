---
title: "meow:browse"
description: "Fast headless browser (~100ms/command) for QA testing, visual verification, and site dogfooding."
---

# meow:browse

Fast headless browser (~100ms/command) for QA testing, visual verification, and site dogfooding.

## What This Skill Does

`meow:browse` wraps the gstack `$B` headless browser binary, providing fast browser interactions for QA and testing. The core pattern is: navigate → snapshot → interact → re-snapshot → diff. Snapshots are text representations (much more token-efficient than screenshots), with reference IDs for every interactive element. At ~100ms per command, it's fast enough for real-time QA flows.

## Core Capabilities

- **Text snapshots** — `$B snapshot` returns a structured text representation with element references (`@e1`, `@e2`)
- **Interactive mode** — `$B snapshot -i` shows all clickable/fillable elements with IDs
- **Diff mode** — `$B snapshot -D` shows exactly what changed after an action
- **Element assertions** — `$B is visible`, `$B is enabled`, `$B is checked`, `$B is focused`
- **Responsive testing** — `$B responsive` tests at mobile, tablet, and desktop widths
- **Annotated screenshots** — `$B snapshot -i -a -o path.png` for visual bug reports

## When to Use This

::: tip Use meow:browse when...
- You need to quickly verify a page loads correctly
- You want to test a user flow interactively
- You need visual evidence for a bug report
- You want to check responsive layouts
:::

## Usage

```bash
# Navigate and check
$B goto https://app.example.com
$B snapshot -i              # see all interactive elements
$B fill @e3 "user@test.com" # fill an input
$B click @e5                # click submit
$B snapshot -D              # see what changed

# Visual evidence
$B screenshot /tmp/bug.png
$B responsive               # test 3 viewport widths
```

## Example Prompts

| Prompt | What browse does |
|--------|-----------------|
| `test the login page` | goto → snapshot -i → fill fields → click submit → verify |
| `check if dashboard loads` | goto → text (content check) → console (JS errors?) |
| `take a screenshot for the bug report` | snapshot -i -a -o /tmp/annotated.png |
| `test responsive layout` | responsive → 3 screenshots at different widths |

## Quick Workflow

```
$B goto [url]
$B snapshot -i        → See elements with @e1, @e2, @e3
$B fill @e3 "value"   → Fill input
$B click @e5           → Click button
$B snapshot -D         → See what changed (unified diff)
$B is visible ".result" → Assert element exists
```

::: info Skill Details
**Phase:** 2–4
:::

## Gotchas

- **SPA content not rendered**: Headless browser captures DOM before JS hydration completes → Add explicit wait for selector or networkidle before assertions
- **Auth-gated pages return 401**: Session cookies expire between commands → Re-authenticate or pass cookies explicitly before each protected page test

## Related

- [`meow:qa-manual`](/reference/skills/qa-manual) — Orchestrates browse for spec-driven QA
- [`meow:qa`](/reference/skills/) — Systematic QA with health scoring

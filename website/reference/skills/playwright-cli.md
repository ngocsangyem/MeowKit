---
title: "mk:playwright-cli"
description: "Playwright-based browser automation that generates TypeScript test code as a side-effect of every interaction."
---

# mk:playwright-cli

Playwright-based browser automation that generates TypeScript test code as a side-effect of every interaction.

## What This Skill Does

`mk:playwright-cli` wraps the Playwright MCP server to control browsers via snapshots and element references. Its unique advantage: **every action you perform outputs the corresponding Playwright TypeScript code.** Click a button → you get `await page.getByRole('button', { name: 'Submit' }).click();`. This makes it the preferred tool when you want to both interact with a page AND generate test code.

## Core Capabilities

- **Code generation** — Every action outputs Playwright TypeScript code
- **Accessibility tree** — Uses ARIA roles and labels, not DOM/CSS selectors
- **Snapshot-based** — Element refs (`e1`, `e2`) from accessible snapshot
- **Full interaction** — Click, fill, type, hover, drag, select, check, upload
- **Session management** — Storage state save/restore for auth persistence
- **Request mocking** — Intercept and mock API responses for testing

## When to Use This

::: tip Use playwright-cli when...
- You want to interact with a page AND generate Playwright test code
- You need role-based locators (getByRole, getByLabel, getByText)
- You're building E2E tests from manual exploration
:::

## Usage

```bash
playwright-cli open https://example.com
playwright-cli snapshot             # see element refs
playwright-cli fill e1 "user@test.com"
# → Ran: await page.getByRole('textbox', { name: 'Email' }).fill('user@test.com')
playwright-cli click e3
# → Ran: await page.getByRole('button', { name: 'Sign In' }).click()
```

## Example Prompts

| Prompt | What happens |
|--------|-------------|
| `fill out the login form` | Fill fields → code generated for each action |
| `navigate to settings page` | goto → code generated for navigation |
| `take a snapshot of the form` | Returns element tree with refs |

## Quick Workflow

```
playwright-cli open [url] → playwright-cli snapshot
  → interact (fill, click, type) → each outputs Playwright TS code
  → collect generated code into .spec.ts file
```

::: info Skill Details
**Phase:** 2–4
:::

## Gotchas

- **Flaky selectors on SPAs**: `data-testid` changes between renders → prefer role-based selectors (`getByRole`) over CSS selectors
- **Auth state not persisting between tests**: each test starts with fresh context → use `state-save` / `state-load` to persist auth cookies across runs

## Related

- [`mk:qa-manual`](/reference/skills/qa-manual) — Uses playwright-cli for E2E code generation
- [`mk:agent-browser`](/reference/skills/agent-browser) — CDP-based, better for auth
- [`mk:browse`](/reference/skills/browse) — Faster QA patterns

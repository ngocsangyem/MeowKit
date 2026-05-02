---
title: "mk:playwright-cli"
description: "Session-persistent browser automation via Playwright CLI — form filling, screenshots, data extraction, multi-step flows."
---

# mk:playwright-cli

## What This Skill Does

Playwright-cli provides browser automation through the Playwright CLI. It uses accessibility tree snapshots with stable element refs (`e1`, `e2`, ...) for interaction, making scripts resilient to DOM changes. It supports named persistent sessions, auth state save/load, request mocking, network inspection, tracing, and video recording -- all without writing Playwright code.

## When to Use

Triggers:
- DOM interaction, page navigation, form filling, data extraction
- Capturing screenshots of multi-step flows
- Testing web application behavior across multiple requests
- Generating reusable `.spec.ts` E2E test code

Anti-triggers:
- Single-shot screenshots -- use `mk:browse`
- AI-driven long autonomous flows -- use `mk:agent-browser` (session persistence, auth flows, MFA, cookie import)
- Writing E2E test files from scratch -- use `mk:qa-manual`

## Core Capabilities

- **Accessibility tree snapshots** -- `snapshot` returns element refs (`e1`, `e2`, ...) that stay stable across re-renders
- **Named persistent sessions** -- isolated contexts with separate cookies, storage, and history via `-s=<name> --persistent`
- **Auth state management** -- `state-save` and `state-load` persist auth cookies across runs
- **Request mocking** -- `route` blocks or mocks network requests by URL pattern
- **Network inspection** -- `network` command views request/response details
- **DevTools integration** -- `console`, tracing (`tracing-start`/`tracing-stop`), video recording (`video-start`/`video-stop`)
- **Storage manipulation** -- `cookie-list`/`cookie-set`/`cookie-delete`, `localstorage-get`/`localstorage-set`
- **Custom code execution** -- `run-code` executes arbitrary Playwright page scripts
- **Multi-format capture** -- screenshot (PNG), PDF export

## Arguments

| Argument | Effect |
|----------|--------|
| `open <url>` | Navigate to a URL |
| `snapshot` | Get accessibility tree with element refs |
| `snapshot --filename=<name>.yaml` | Save snapshot to named file |
| `click <ref>` | Click element by ref (e.g., `e15`) |
| `fill <ref> "text"` | Clear and type into an input |
| `type "text"` | Type at current focus |
| `press <key>` | Press a key (Enter, Tab, Escape) |
| `select <ref> "value"` | Select an option |
| `check <ref>` / `uncheck <ref>` | Check/uncheck a checkbox |
| `screenshot` / `screenshot --filename=<name>.png` | Capture screenshot |
| `pdf --filename=<name>.pdf` | Export page as PDF |
| `-s=<name>` | Use a named session |
| `--persistent` | Keep session alive across commands |
| `state-save <file>` / `state-load <file>` | Save/load auth state |
| `route "<pattern>" --status=404` | Mock a request |
| `route "<pattern>" --body='{"mock": true}'` | Mock with custom body |
| `console` / `network` | View console output / network requests |
| `tracing-start` / `tracing-stop` | Record a trace |
| `video-start` / `video-stop <file>.webm` | Record a video |
| `run-code "async page => { ... }"` | Execute custom Playwright code |
| `list` / `close` / `close-all` / `kill-all` | Session management |

## Workflow

1. `open <url>` -- navigate to target page
2. `snapshot` -- get accessibility tree with element refs
3. Interact using refs: `click`, `fill`, `type`, `select`, `check`
4. Re-`snapshot` after navigation or DOM changes
5. `close` when done

## Usage

```bash
# Basic form fill
playwright-cli open https://example.com/form
playwright-cli snapshot
playwright-cli fill e1 "user@example.com"
playwright-cli fill e2 "password123"
playwright-cli click e3
playwright-cli screenshot --filename=result.png
playwright-cli close

# Named session with auth
playwright-cli -s=mytask open https://app.example.com --persistent
playwright-cli -s=mytask fill e1 "admin"
playwright-cli -s=mytask state-save auth.json
playwright-cli -s=mytask close

# Request mocking
playwright-cli route "**/*.jpg" --status=404
playwright-cli route "https://api.example.com/**" --body='{"mock": true}'
```

## Example Prompt

```
Use playwright-cli to log into our staging dashboard, navigate to the user management page,
take a screenshot of the table, and save the auth state for re-use.
```

## Common Use Cases

- Automating a multi-step form fill for manual testing or data entry
- Capturing screenshots of a workflow for documentation
- Extracting structured data from a web page that requires login
- Mocking API responses to test frontend error states
- Recording a browser trace for debugging a flaky page interaction
- Saving and reusing auth state to avoid re-logging in across sessions

## Pro Tips

- **Snapshot after every navigation.** Element refs change when the DOM re-renders. Always re-snapshot.
- **Flaky selectors on SPAs?** `data-testid` attributes change between renders. Prefer role-based selectors (`getByRole`) when using `run-code`.
- **Auth state not persisting?** Each test starts with a fresh context. Use `state-save` / `state-load` to persist auth cookies.
- **Named sessions are isolated.** Each `-s=<name>` session has separate cookies, storage, and history. Use different names for parallel tasks.
- **Requires Playwright MCP server.** Configure in `.mcp.json`: `{ "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] } }`.

> **Canonical source:** `.claude/skills/playwright-cli/SKILL.md`

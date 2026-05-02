---
title: "mk:agent-browser"
description: "AI-agent-driven browser automation for long autonomous sessions via Chrome/CDP — session persistence, auth flows, annotated screenshots."
---

# mk:agent-browser

Browser automation via Chrome/CDP for long autonomous sessions. Supports session persistence (auth flows, MFA, cookie import) and visual annotated screenshots. NOT for quick single-shot verification (`mk:browse`), deterministic scripted flows (`mk:playwright-cli`), or E2E code generation (`mk:qa-manual`).

## When to use

Auth-heavy flows, multi-step autonomous tasks, sessions requiring cookie persistence. Install via `npm i -g agent-browser`, `brew install agent-browser`, or `cargo install agent-browser`.

## Core workflow

```bash
agent-browser open <url>
agent-browser snapshot -i       # Get element refs (@e1, @e2)
agent-browser fill @e1 "user@example.com"
agent-browser click @e3
```

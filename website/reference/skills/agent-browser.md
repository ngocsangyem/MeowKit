---
title: "mk:agent-browser"
description: "AI-agent-driven browser automation via Chrome/CDP for long autonomous sessions — auth-heavy flows, session persistence, annotated screenshots, video recording, and 100+ commands."
---

## What This Skill Does

Provides a full Chrome/CDP automation CLI for long-running autonomous browser sessions. Supports persistent profiles, session auto-save/restore, cookie import from running Chrome, OAuth/2FA flows, video recording, proxy configuration, performance profiling, and annotated screenshots. Element interaction uses @e ref discovery from accessibility tree snapshots.

## When to Use

- Auth-heavy flows requiring session persistence, cookie import, or MFA
- Multi-step autonomous browser tasks spanning many pages
- Flows that must NOT generate reusable test code (use `mk:playwright-cli` for that)
- Complex interactions requiring video recording for debugging
- Long-running scraping or monitoring sessions

**NOT for:** deterministic scripted flows (`mk:playwright-cli`), E2E test code generation (`mk:qa-manual`).

## Example Prompt

```
Log into our SaaS dashboard at https://app.example.com, navigate to the billing page, update the payment method to the test card, take an annotated screenshot of the confirmation, and record the session for debugging.
```

## Core Capabilities

| Category | Example Commands |
|----------|-----------------|
| Navigation | `open`, `back`, `forward`, `reload`, `close` |
| Snapshot | `snapshot -i` (interactive with @e refs), `-c`, `-d N`, `-s selector` |
| Interaction | `click @e1`, `fill @e2 "text"`, `type`, `select`, `check`, `uncheck`, `press`, `hover`, `scroll`, `drag`, `upload` |
| Information | `get text`, `get html`, `get value`, `get attr`, `get title`, `get url`, `get count`, `get box`, `get styles` |
| State Check | `is visible`, `is enabled`, `is checked` |
| Screenshot/PDF | `screenshot path.png`, `screenshot --full`, `pdf output.pdf` |
| Video Recording | `record start`, `record stop`, `record restart` |
| Wait | `wait @e1`, `wait --text "..."`, `wait --url "**/pattern"`, `wait --load networkidle`, `wait --fn "..."` |
| Semantic Locators | `find role button click --name "Submit"`, `find label "Email" fill "..."`, `find placeholder "Search" type "..."` |
| Auth | `auth save/load`, `state save/load`, `cookies set/get/clear`, `set credentials` |
| Network | `network route`, `network requests`, `network unroute` |
| JS Execution | `eval "expr"`, `eval -b` `BASE64`, `eval --stdin` |
| Debugging | `console`, `errors`, `highlight`, `inspect`, `trace`, `profiler` |

## Installation

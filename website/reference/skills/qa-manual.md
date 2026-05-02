---
title: "mk:qa-manual"
description: "Spec-driven manual QA and Playwright E2E code generation — orchestrates browser skills to test like a human tester."
---

# mk:qa-manual

Orchestrates browser skills to act like a human tester: navigate, interact, verify, and report. Produces structured test reports or Playwright `.spec.ts` E2E code. Always prompts user for credentials — never guesses or stores auth.

## When to use

QA testing, E2E generation, login flow testing, exploratory testing from a URL. NOT for unstructured browsing (`mk:browse`); NOT for AI-autonomous flows (`mk:agent-browser`).

## Usage

```bash
/mk:qa-manual <spec-path | url> [--report | --generate]
```

## Key behaviors

- Dynamic routing: each action uses best browser skill (routing tree in Phase 1.2)
- Auth protocol: prompt-always — never guess credentials
- Role-based locators mandatory (`getByRole`, `getByLabel`) — not CSS selectors
- Script for Playwright execution — deterministic, not LLM judgment

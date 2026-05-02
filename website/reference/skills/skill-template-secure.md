---
title: "mk:skill-template-secure"
description: "Secure skill template with prompt injection defenses. Copy this template when creating new skills."
---

# mk:skill-template-secure

Secure template for creating new MeowKit skills with prompt injection defenses built in. Use as the starting point when creating skills that handle untrusted input.

## When to use

Creating any new skill that processes external content (user input, web pages, API responses, file content). Copy the template and customize.

## Key security elements

- **Security Anchor** — marks skill instructions as non-overridable by processed data
- **Trust Model** — defines what operations are allowed, what network access exists
- **Rule of Two** — a skill must not satisfy all three: process untrusted input + access sensitive data + change state
- **Input boundaries** — `===DATA_START===` / `===DATA_END===` markers for untrusted content

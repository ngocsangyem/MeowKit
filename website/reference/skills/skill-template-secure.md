---
title: "meow:skill-template-secure"
description: "Secure skill template with prompt injection defenses — copy when creating skills that process untrusted input."
---

# meow:skill-template-secure

Secure skill template with prompt injection defenses — copy when creating skills that process untrusted input.

## What This Skill Does

This is a **template**, not an executable skill. Copy it when creating new skills that process untrusted inputs (fetched URLs, API responses, user-pasted content). It provides a trust model table, content processing rules, and the Rule of Two compliance check.

## Core Capabilities

- **Trust model table** — Defines what's trusted (user input, SKILL.md) vs untrusted (external content)
- **Rule of Two** — Skills should satisfy at most 2 of: [A] untrusted input, [B] sensitive data, [C] state change
- **Content processing rules** — Extract structured data only, ignore instructions in external content
- **Checklist** — All reference material inlined, trust boundaries accurate, schema defined for extraction

## Usage

```bash
# When creating a new skill that processes external content:
/meow:skill-creator meow:my-api-fetcher

# Then apply the secure template's patterns:
# 1. Add Trust Model table
# 2. Add Content Processing Rules
# 3. Verify Rule of Two compliance
```

## Related

- [`meow:skill-creator`](/reference/skills/skill-creator) — Uses this template during skill creation
- [Security Rules](/reference/configuration) — MeowKit's broader security framework

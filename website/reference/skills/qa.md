---
title: "meow:qa"
description: "Systematic QA testing with bug fixing, health scores, and ship-readiness assessment across three tiers."
---

# meow:qa

Systematic QA testing with bug fixing, health scores, and ship-readiness assessment across three tiers.

## What This Skill Does

`meow:qa` goes beyond finding bugs — it finds them, fixes them, and verifies the fixes. Three tiers of thoroughness: Quick (critical/high only), Standard (+ medium), Exhaustive (+ cosmetic). Produces before/after health scores and a ship-readiness summary.

## Core Capabilities

- **Find + fix + verify** — Not just reporting, actually fixes bugs in source code
- **Three tiers** — Quick, Standard, Exhaustive based on thoroughness needed
- **Health scoring** — Before/after scores to quantify improvement
- **Atomic commits** — Each fix committed independently for clean history
- **Ship-readiness** — Final summary: is this ready to ship?

## When to Use This

::: tip Use meow:qa when...
- A feature is ready for testing and you want bugs found AND fixed
- You need a ship-readiness assessment
- You want before/after quality metrics
:::

## Usage

```bash
/meow:qa                    # Standard tier
/meow:qa https://app.com    # QA a specific URL
```

## Related

- [`meow:qa-manual`](/reference/skills/qa-manual) — Spec-driven QA + E2E code generation
- [`meow:browse`](/reference/skills/browse) — The browser tool QA uses

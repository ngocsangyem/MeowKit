---
title: "meow:cso"
description: "Chief Security Officer mode — infrastructure-first security audit with OWASP Top 10, STRIDE, supply chain, and LLM/AI security scanning."
---

# meow:cso

Chief Security Officer mode — infrastructure-first security audit with OWASP Top 10, STRIDE, supply chain, and LLM/AI security scanning.

## What This Skill Does

`meow:cso` runs a comprehensive security audit that thinks like a CSO, not a linter. Instead of just pattern-matching code, it starts with architecture and infrastructure — secrets archaeology, dependency supply chain, CI/CD pipeline security, and LLM/AI attack vectors — then layers on OWASP Top 10 and STRIDE threat modeling. It has two modes: daily (high confidence, zero noise) and comprehensive (deep scan, more findings).

## Core Capabilities

- **14-phase audit** — From architecture mapping through OWASP, STRIDE, and data flow analysis
- **Two modes** — Daily (8/10 confidence gate, zero noise) and Comprehensive (2/10 bar, surfaces more)
- **Infrastructure-first** — Secrets, dependencies, CI/CD, webhooks before code patterns
- **LLM/AI security** — Scans for prompt injection vectors and skill supply chain risks
- **False positive filtering** — Dedicated phase to eliminate noise before reporting
- **Trend tracking** — Compares findings across audit runs to show improvement/regression

## When to Use This

::: tip Use meow:cso when...
- You need a thorough security assessment before a release
- You're onboarding a new codebase and want to understand its security posture
- You've had a security incident and need to audit broadly
- You want to check for OWASP Top 10 or STRIDE threats
:::

## Usage

```bash
# Full daily audit (default — high confidence, zero noise)
/meow:cso

# Comprehensive deep scan (lower confidence threshold, more findings)
/meow:cso comprehensive

# Specific scope
/meow:cso src/api/
```

## Example Prompts

| Prompt | Mode | Focus |
|--------|------|-------|
| `/meow:cso` | Daily | Full project, 8/10 confidence |
| `/meow:cso comprehensive` | Comprehensive | Full project, 2/10 bar |
| `security audit before release` | Daily | Auto-activates CSO |
| `check for OWASP vulnerabilities` | Daily | OWASP-focused scan |

## Quick Workflow

```
Phase 0-1: Architecture + Attack Surface Mapping
Phase 2-3: Secrets Archaeology + Dependency Supply Chain
Phase 4-6: CI/CD + Infrastructure + Webhooks
Phase 7-8: LLM/AI Security + Skill Supply Chain
Phase 9-11: OWASP Top 10 + STRIDE + Data Flow
Phase 12: False Positive Filtering
Phase 13-14: Report Generation + Save
```

Each finding answers: What? Where? Why? Impact? How to fix?

## Related

- [`meow:vulnerability-scanner`](/reference/skills/) — Code-level pattern scanning
- [`meow:review`](/reference/skills/review) — Security is one of 5 review dimensions

---
title: Security Audit
description: Run a comprehensive security audit with OWASP, STRIDE, supply chain, and platform-specific scanning.
persona: B
---

# Security Audit

> Infrastructure-first security assessment covering secrets, dependencies, CI/CD, and code patterns.

**Best for:** Before releases, after incidents, onboarding new codebases  
**Time estimate:** 15-30 minutes  
**Skills used:** [mk:cso](/reference/skills/cso), [mk:vulnerability-scanner](/reference/skills/vulnerability-scanner)  
**Agents involved:** security (auto-inserts on auth/payments)

## Overview

MeowKit offers two levels of security scanning. The **vulnerability-scanner** does code-level pattern matching (OWASP Top 10, secret detection). The **CSO** skill goes deeper — it starts with infrastructure (secrets archaeology, dependency supply chain, CI/CD pipeline), then layers on OWASP + STRIDE threat modeling.

## Step-by-step guide

### Step 1: Choose your scan depth

```bash
# Quick code-level scan
/mk:vulnerability-scanner

# Full CSO audit — daily mode (high confidence, zero noise)
/mk:cso

# Deep scan — comprehensive mode (lower threshold, more findings)
/mk:cso comprehensive

# Scan specific directory
/mk:cso src/api/
```

### Step 2: Understand the 14-phase CSO audit

| Phase | What it checks | Agent/Tool |
|-------|---------------|-----------|
| 0-1 | Architecture + attack surface mapping | security agent reads codebase structure |
| 2-3 | Secrets archaeology + dependency supply chain | Grep patterns + `npm audit` / `pip audit` |
| 4-6 | CI/CD pipelines + infrastructure + webhooks | Checks workflow files, Docker configs |
| 7-8 | LLM/AI security + skill supply chain | Scans for prompt injection vectors |
| 9-11 | OWASP Top 10 + STRIDE threat model + data flow | Full threat analysis |
| 12 | False positive filtering | Eliminates noise before reporting |
| 13-14 | Report generation + save | Structured findings with remediation |

### Step 3: Review findings

Each finding includes: **What** (vulnerability), **Where** (file:line), **Why** (root cause), **Impact** (business risk), **How to fix** (specific remediation).

```
CRITICAL: Hardcoded AWS key in src/config/aws.ts:12
  Pattern: AKIA[0-9A-Z]{16}
  Impact: Full AWS account access if leaked
  Fix: Move to environment variable, rotate the exposed key immediately

HIGH: SQL query uses string interpolation in src/api/users.ts:45
  Pattern: `SELECT * FROM users WHERE id = '${userId}'`
  Fix: Use parameterized query: db.query('SELECT * FROM users WHERE id = $1', [userId])
```

### Step 4: Platform-specific checks

The **security** agent applies platform-specific rules automatically:

| Platform | Key checks |
|----------|-----------|
| **NestJS** | Auth guards on all endpoints, class-validator for input, parameterized queries |
| **Vue** | No `v-html` with user input (XSS), CSRF tokens, no localStorage for auth |
| **Swift** | Keychain for credentials, certificate pinning, ATS compliance |
| **Supabase** | RLS on all tables, service key never on client |

### What happens with BLOCK verdicts

If the **security** agent finds a CRITICAL vulnerability, it issues a BLOCK verdict:

```
Security verdict: BLOCK
  CRITICAL: Hardcoded API key (src/config/aws.ts:12)
  Pipeline halted — must remediate before shipping.
  Only the security agent can clear this BLOCK after re-audit.
```

No other agent can override a security BLOCK. Fix the issue, then request re-audit.

## Next workflow

→ [Refactoring](/workflows/refactoring) — safely improve existing code

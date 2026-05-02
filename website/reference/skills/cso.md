---
title: "mk:cso"
description: "Chief Security Officer — infrastructure-first security audit. Two modes: daily (zero-noise, 8/10 confidence gate) and comprehensive (monthly deep scan, 2/10 bar). Covers secrets archaeology, dependency supply chain, CI/CD pipeline, LLM/AI security, OWASP Top 10, STRIDE threat modeling, and active verification."
---

# mk:cso

Chief Security Officer mode (v2). Infrastructure-first security audit that thinks like an attacker but reports like a defender. Produces a Security Posture Report with concrete findings, severity ratings, exploit scenarios, and remediation plans. Does NOT make code changes.

## What This Skill Does

- **Secrets archaeology** -- scans git history, .env files, CI logs for exposed credentials
- **Dependency supply chain audit** -- checks for known CVEs, install scripts, typosquatting, unpinned dependencies
- **CI/CD pipeline security** -- audits workflows for `pull_request_target` misuse, script injection, unpinned actions, secrets exposure
- **Infrastructure audit** -- Docker/IaC config review, container security, deployment configs
- **Webhook/integration audit** -- checks for missing signature verification, open receivers
- **LLM/AI security** -- prompt injection risks, unbounded LLM calls, cost amplification, system prompt leaks
- **Skill supply chain scanning** -- audits SKILL.md files for injection patterns and unsafe operations
- **OWASP Top 10 assessment** -- A01-A10 mapped to repo-specific findings
- **STRIDE threat modeling** -- Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege
- **Active verification** -- for each surviving finding, attempts to prove exploitability via code tracing
- **Trend tracking** -- compares findings across audit runs, fingerprints findings, reports posture direction
- **Remediation roadmap** -- presents top-5 fix plans with effort estimates via AskUserQuestion

## When to Use

Run `/mk:cso` when the user requests a security audit, threat model, pentest review, OWASP assessment, or CSO review. Supports daily mode (8/10 confidence, zero noise) and comprehensive mode (2/10 bar, surfaces more).

**Scope:** Whole-repo infra + supply-chain audit. For diff-scoped security review gating a PR, use `mk:review` instead.

## Example Prompt

```
Run a comprehensive security audit on the entire repository before the v2.0 release. Check for leaked secrets in git history, vulnerable dependencies, CI/CD misconfigurations, OWASP Top 10 issues, and LLM prompt injection risks across all API endpoints.
```

## Core Capabilities

### Two Modes

| Mode | Command | Confidence Gate | Scope | Behavior |
|---|---|---|---|---|
| **Daily** | `/mk:cso --daily` | 8/10 | Changed files only | Zero-noise. Skips planning. Only report what you're sure about. |
| **Comprehensive** | `/mk:cso --comprehensive` | 2/10 | Full repo | Monthly deep scan. Requires plan via `mk:plan-creator --type security`. Surfaces more, flags TENTATIVE findings. |

### Scope Flags

| Flag | Scope | Phases Run |
|---|---|---|
| (no flags) | Full audit | 0-14 |
| `--infra` | Infrastructure only | 0-6, 12-14 |
| `--code` | Code only | 0-1, 7, 9-11, 12-14 |
| `--skills` | Skill supply chain only | 0, 8, 12-14 |
| `--supply-chain` | Dependency audit only | 0, 3, 12-14 |
| `--owasp` | OWASP Top 10 only | 0, 9, 12-14 |
| `--scope `DOMAIN` | Focused audit | Domain-filtered |
| `--diff` | Branch changes only | Combinable with any scope flag |

Scope flags are **mutually exclusive**. If multiple scope flags are passed, the skill errors immediately. `--diff` is combinable with any scope flag.

### 14-Phase Architecture

| Phase | Name | What It Does |
|---|---|---|
| 0 | Reconnaissance -- Architecture | Stack/framework detection, mental model, attack surface census |
| 1 | Reconnaissance -- Attack Surface | Public endpoints, auth boundaries, admin panels, API routes, file uploads, integrations, background jobs, WebSockets |
| 2 | Secrets Archaeology | Git history scan for API keys, tokens, credentials; .env file audit |
| 3 | Supply Chain | Dependency audit: CVEs, install scripts, typosquatting, lockfile integrity |
| 4 | CI/CD Pipeline | Workflow security: `pull_request_target`, unpinned actions, script injection, secrets exposure |
| 5 | Infrastructure | Docker/IaC configs, container security, deployment targets, secret management |
| 6 | Webhooks/Integrations | Webhook receivers, signature verification, third-party integration audit |
| 7 | LLM/AI Security | Prompt injection, unbounded LLM calls, cost caps, system prompt leaks |
| 8 | Skill Supply Chain | SKILL.md injection patterns, unsafe skill operations |
| 9 | OWASP Top 10 (A01-A10) | Broken access control, misconfiguration, injection, crypto failures, etc. |
| 10 | STRIDE Threat Model | Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation of privilege |
| 11 | Data Classification | PII/credentials in logs, data at rest, data in transit |
| 12 | False Positive Filtering | 22 hard-exclusion rules + confidence gate + active verification + variant analysis |
| 13 | Report + Remediation | Findings with exploit scenarios, trend tracking, incident response playbooks, remediation roadmap |
| 14 | Save Report | JSON schema to `.claude/memory/security-reports/` |

Phases 0, 1, 12, 13, 14 ALWAYS run regardless of scope flag.

### False Positive Filtering (Phase 12)

**Daily mode (8/10 gate):**
- 9-10: Certain exploit path. Could write a PoC.
- 8: Clear vulnerability pattern with known exploitation methods. Minimum bar.
- Below 8: Do not report.

**Comprehensive mode (2/10 gate):** Filter true noise only, but include anything that MIGHT be real. Flag as `TENTATIVE`.

**22 hard-exclusion rules** cover: DoS (except LLM cost amplification), secured-on-disk secrets, memory/CPU exhaustion, input validation without impact, missing hardening (except unpinned actions and missing CODEOWNERS), race conditions, test fixtures, log spoofing, SSRF (path-only), regex in non-untrusted code, doc files (except SKILL.md), missing audit logs, insecure randomness in non-security contexts, git history secrets committed+removed in same PR, CVEs < CVSS 4.0, dev Dockerfiles, archived workflows.

**Active verification:** For each surviving finding, attempt to prove exploitability via code tracing. Mark as VERIFIED (confirmed), UNVERIFIED (pattern match only), or TENTATIVE (comprehensive mode below 8/10). Uses parallel Agent tool sub-tasks for independent verification.

**Variant analysis:** When a finding is VERIFIED, search the entire codebase for the same vulnerability pattern. One confirmed SSRF may mean there are 5 more.

### Finding Structure

Every finding includes:
- Severity (CRITICAL / HIGH / MEDIUM), Confidence (N/10), Status (VERIFIED / UNVERIFIED / TENTATIVE)
- Phase and Category
- Description of what's wrong
- **Exploit scenario** -- concrete step-by-step attack path
- Impact -- what an attacker gains
- Recommendation -- specific fix with example

### Incident Response Playbooks

When a leaked secret is found: Revoke immediately, Rotate credential, Scrub history (`git filter-repo`), Force-push cleaned history, Audit exposure window, Check provider audit logs for abuse.

### Trend Tracking

When prior reports exist, fingerprints findings (sha256 of category + file + normalized title) to match across runs:

```
SECURITY POSTURE TREND
Compared to last audit ({date}):
  Resolved:    N findings fixed since last audit
  Persistent:  N findings still open
  New:         N findings discovered this audit
  Trend:       IMPROVING / DEGRADING / STABLE
  Filter stats: N candidates -> M filtered (FP) -> K reported
```

### Remediation Roadmap

For the top 5 findings, presents via AskUserQuestion with options: Fix now (specific code change), Mitigate (workaround), Accept risk (document + review date), Defer to TODOS.md.

## Arguments

```
/mk:cso                              # Full daily audit (all phases, 8/10 gate)
/mk:cso --comprehensive              # Monthly deep scan (all phases, 2/10 bar)
/mk:cso --infra                      # Infrastructure only
/mk:cso --code                       # Code only
/mk:cso --skills                     # Skill supply chain only
/mk:cso --diff                       # Branch changes only
/mk:cso --supply-chain               # Dependency audit only
/mk:cso --owasp                      # OWASP Top 10 only
/mk:cso --scope auth                 # Focused domain audit
/mk:cso --diff --comprehensive       # Branch changes, comprehensive mode
```

## Workflow

1. **Initialize** -- run preamble, parse arguments (mode, scope, diff)
2. **Plan-first gate** -- comprehensive mode invokes `mk:plan-creator --type security`; daily mode skips
3. **Reconnaissance** -- architecture + attack surface (Phases 0-1)
4. **Core audit** -- secrets + dependencies + CI/CD + infra + webhooks + LLM + skills (Phases 2-8)
5. **Assessment** -- OWASP Top 10 + STRIDE + data classification (Phases 9-11)
6. **Filtering** -- false positive elimination, confidence gate, active verification, variant analysis (Phase 12)
7. **Report** -- findings with exploit scenarios, trend tracking, remediation roadmap, disclaimer (Phase 13)
8. **Save** -- JSON report to `.claude/memory/security-reports/` (Phase 14)

## Usage

```bash
# Daily security scan
/mk:cso

# Comprehensive monthly audit
/mk:cso --comprehensive

# Infrastructure-only audit
/mk:cso --infra

# Branch-diff security review
/mk:cso --diff

# Dependency supply chain deep-dive
/mk:cso --supply-chain --comprehensive
```

## Common Use Cases

- Daily zero-noise scan before merging to main, catching secrets and CI/CD misconfigurations
- Monthly comprehensive audit run against the full repo as part of security cadence
- Pre-release pentest review focusing on OWASP Top 10 and STRIDE
- Supply chain audit after adding new dependencies or changing package registries
- Skill supply chain scan after importing community skills or updating skill dependencies
- Branch-diff security gate as part of PR review workflow

## Pro Tips

- **Think like an attacker, report like a defender** -- show the exploit path, then the fix.
- **Zero noise is more important than zero misses** -- a report with 3 real findings beats one with 3 real + 12 theoretical. Users stop reading noisy reports.
- **No security theater** -- don't flag theoretical risks with no realistic exploit path.
- **Daily mode confidence gate is absolute (8/10)** -- below that, do not report. Period.
- **Read-only** -- CSO never modifies code. Produces findings and recommendations only.
- **Framework-aware** -- know your framework's built-in protections. Rails has CSRF tokens by default. React escapes by default.
- **Lockfile not tracked by git** IS a finding for app repos, NOT for library repos.
- **Never auto-discard CI/CD findings** when `--infra` is active -- Phase 4 exists specifically to surface them.
- **SKILL.md files are NOT documentation** -- they are executable prompt code. Never exclude findings from Phase 8 under doc-file rules.
- **LLM cost amplification is NOT DoS** -- unbounded LLM calls without cost caps are financial risk, not resource exhaustion.
- **Protection file check:** if the project lacks `.gitleaks.toml` or `.secretlintrc`, recommend creating one.
- **Disclaimer required on every report:** "This tool is not a substitute for a professional security audit." Include it at the end of every `/mk:cso` report output.

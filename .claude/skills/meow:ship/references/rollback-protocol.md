# Skill: Rollback Protocol

**Purpose:** Every shipped change must have a documented rollback plan. This template ensures rollbacks are fast, safe, and verifiable.

## Contents

- [When to Use](#when-to-use)
- [Rollback Document Template](#rollback-document-template)
- [1. What Was Deployed](#1-what-was-deployed)
- [2. How to Rollback](#2-how-to-rollback)
  - [Option A: Git Revert (preferred for code changes)](#option-a-git-revert-preferred-for-code-changes)
  - [Option B: Redeploy Previous Version (for infrastructure/config)](#option-b-redeploy-previous-version-for-infrastructureconfig)
  - [Option C: Feature Flag (if applicable)](#option-c-feature-flag-if-applicable)
  - [Estimated Rollback Time](#estimated-rollback-time)
- [3. How to Verify Rollback Worked](#3-how-to-verify-rollback-worked)
- [4. Who to Notify](#4-who-to-notify)
- [5. Data Implications](#5-data-implications)
  - [Is rollback data-safe?](#is-rollback-data-safe)
  - [If rollback is NOT data-safe:](#if-rollback-is-not-data-safe)
- [Rules](#rules)
- [Quick Rollback Decision Tree](#quick-rollback-decision-tree)


## When to Use

Create a rollback document for EVERY ship. Attach it to the PR description and, for high-risk changes, also save to `docs/rollback/`.

---

## Rollback Document Template

```markdown
# Rollback Plan: [Change Description]

## 1. What Was Deployed

- **Commit SHA:** [full SHA]
- **PR Link:** [URL to the pull request]
- **Deploy Date:** YYYY-MM-DD HH:MM UTC
- **Environments:** [canary / staging / production]
- **Services Affected:** [list of services or modules]

## 2. How to Rollback

### Option A: Git Revert (preferred for code changes)

```bash
git revert <commit-sha>
git push origin <branch>
# Create revert PR or merge directly if urgent
```

### Option B: Redeploy Previous Version (for infrastructure/config)

```bash
deploy --environment production --version <previous-commit-sha>
```

### Option C: Feature Flag (if applicable)

```bash
# Disable the feature flag
feature-flag set <flag-name> --enabled=false --environment=production
```

### Estimated Rollback Time
- Git revert: ~10 minutes (including CI)
- Redeploy: ~5 minutes
- Feature flag: ~1 minute

## 3. How to Verify Rollback Worked

After rollback, check:

- [ ] Health check endpoint returns 200
- [ ] Error rates return to pre-deployment baseline
- [ ] Affected functionality works as it did before the change
- [ ] No new errors in application logs
- [ ] [Specific check for this change: e.g., "users can log in", "payments process"]

Verification command:
```bash
# Example: check health
curl -s https://api.example.com/health | jq '.status'

# Example: check error rates
monitoring-cli query 'error_rate{service="api"}' --last=5m
```

## 4. Who to Notify

| Role | Contact | When to Notify |
|------|---------|---------------|
| On-call engineer | [name/handle] | Immediately on rollback |
| Team lead | [name/handle] | Within 1 hour |
| Product owner | [name/handle] | If user-facing impact |
| Security team | [name/handle] | If security-related change |

## 5. Data Implications

### Is rollback data-safe?

- **YES — safe to rollback** if:
  - [ ] No database migrations were run
  - [ ] No data format changes were made
  - [ ] No data was deleted or modified irreversibly

- **NO — rollback has data implications** if:
  - [ ] Database migration added new columns (rollback may need reverse migration)
  - [ ] Data was backfilled or transformed (may need to undo transformation)
  - [ ] Data was deleted (cannot be recovered by rollback alone)

### If rollback is NOT data-safe:
- Document the reverse migration or data recovery steps
- Estimate data recovery time
- Identify if any data will be permanently lost
```

---

## Rules

1. **Every PR** must include at minimum items 1, 2, and 3 in the PR description.
2. **High-risk changes** (auth, payments, schema, infrastructure) must have the full template saved to `docs/rollback/[date]-[description].md`.
3. **Rollback must be tested** in staging before shipping to production (for high-risk changes).
4. **Never assume** rollback is safe — explicitly evaluate data implications.
5. **Keep rollback docs updated** — if the deployment process changes, update the rollback steps.

## Quick Rollback Decision Tree

```
Issue detected in production
    ↓
Is it a security vulnerability?
    YES → Rollback immediately, notify security team
    NO  ↓
Is it affecting > 1% of users?
    YES → Rollback immediately
    NO  ↓
Can it be fixed forward in < 30 min?
    YES → Fix forward, monitor
    NO  → Rollback, then fix
```
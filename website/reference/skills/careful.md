---
title: "mk:careful"
description: "Session-scoped safety guardrails for destructive commands with environment-aware blocking — warns or blocks rm -rf, DROP TABLE, force-push, git reset --hard, kubectl delete, terraform destroy, and more."
---

## What This Skill Does

Intercepts every Bash command via a PreToolUse hook (`bin/check-careful.sh`) and checks it against a comprehensive catalog of destructive patterns. In development contexts, destructive commands trigger a warning the user can override. In production/staging contexts, CRITICAL patterns are **blocked with no override**. All overrides are logged to `.claude/memory/security-log.md` for audit trail.

## When to Use

- Touching production, debugging live systems, working in shared environments
- User asks "be careful", "safety mode", "prod mode", "careful mode"
- Before running any infrastructure or database operations

**NOT for:** scoping file edits to a directory (use `mk:freeze`).

## Example Prompt

```
Enable careful mode before running the production database migration. I need to execute `prisma migrate deploy` on the prod cluster, but I want safety guardrails against accidental DROP TABLE or TRUNCATE commands.
```

## Core Capabilities

### Pattern Categories Covered

| Category | Examples | Count |
|----------|---------|-------|
| File System | `rm -rf`, `find -delete`, `shred`, `dd`, `chmod -R` | 6 patterns |
| Database (SQL) | `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, `prisma migrate reset`, `rails db:drop` | 6 patterns |
| Database (NoSQL) | `redis-cli FLUSHALL`, `mongosh db.dropDatabase()` | 3 patterns |
| Git | `push --force`, `reset --hard`, `checkout .`, `clean -fd`, `filter-branch`, `rebase -i` | 6 patterns |
| Kubernetes/Containers | `kubectl delete`, `docker rm -f`, `helm uninstall` | 4 patterns |
| Cloud/Infra | `terraform destroy`, `aws s3 rm --recursive`, `gcloud ... delete` | 3 patterns |

### Severity Levels

| Level | Meaning | Override? |
|-------|---------|-----------|
| CRITICAL | Irreversible, potential data loss or production impact | In dev: ask; **In prod: BLOCK (no override)** |
| HIGH | Reversible but costly to recover | Ask in all environments |
| MEDIUM | Dangerous in certain contexts | Ask in all environments |

### Production Auto-Block

When any of `NODE_ENV`, `APP_ENV`, or `ENVIRONMENT` contains `production`/`prod`/`staging`:
- CRITICAL patterns return `permissionDecision: "block"` — cannot be overridden
- HIGH and MEDIUM patterns still warn with override option

## Workflow

1. **Invoke** — user runs `/mk:careful` or triggers it contextually
2. **Hook activates** — `bin/check-careful.sh` registers as PreToolUse on all Bash calls
3. **Pattern matching** — every bash command string is checked against ~30 destructive patterns
4. **Decision** — allow (no match or safe exception), ask (match in dev), or block (CRITICAL match in prod)
5. **Audit** — all overrides logged with timestamp and command to `.claude/memory/security-log.md`
6. **Deactivate** — end session or start new conversation; hooks are session-scoped

## Safe Exceptions (Never Warned)

Build and dependency caches that are safe to delete: `node_modules`, `.next`, `dist`, `build`, `.turbo`, `coverage`, `__pycache__`, `.cache`, `.gradle`, `target`, `vendor`, `Pods`, `.venv`/`venv`.

Container housekeeping: `docker rm $(docker ps -aq)` (stopped containers only), `docker rmi $(docker images -f "dangling=true" -q)` (dangling images only).

## Common Use Cases

1. **Working on a production database** — `mk:careful` blocks `DROP TABLE`, `TRUNCATE`, `prisma migrate reset`
2. **Infrastructure changes** — blocks `terraform destroy`, `kubectl delete namespace`, `aws s3 rm --recursive`
3. **Git history rewrites** — warns on `push --force`, `reset --hard`, `filter-branch`
4. **Debugging live systems** — warns before any destructive filesystem or database operation
5. **Teaching/mentoring sessions** — prevents accidental damage in shared environments

## Pro Tips

- **Interaction with `mk:investigate`:** When careful is active during an investigation, destructive-Bash warnings still fire. Debugging commands that touch state require explicit user confirmation per warning — do not bypass.
- Pattern matching is **command-scoped**, not content-scoped. Source code mentioning `rm -rf` in comments will not trigger.
- Shell aliases (e.g., `alias del='rm -rf'`) can bypass detection — document project-specific dangerous aliases.
- Multi-line commands with backslash continuations may not match single-line regex.
- Run `git stash` before `git reset --hard` to prevent uncommitted work loss.
- In production environments, CRITICAL patterns are fully blocked — use migration systems with rollback instead.

### Notes

- Hook script: `.claude/skills/careful/bin/check-careful.sh`
- Pattern reference: `.claude/skills/careful/references/destructive-patterns.md` (200+ lines)
- Source: gstack
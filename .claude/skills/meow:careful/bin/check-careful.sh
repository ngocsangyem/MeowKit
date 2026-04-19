#!/usr/bin/env bash
# check-careful.sh — PreToolUse hook for meow:careful skill
# Reads JSON from stdin, checks Bash command for destructive patterns.
# Returns {"permissionDecision":"ask","message":"..."} to warn, or
# {"permissionDecision":"block","message":"..."} in production for CRITICAL patterns, or
# {} to allow.
# Patterns mirror references/destructive-patterns.md — keep in sync.
set -euo pipefail

# Read stdin (JSON with tool_input)
INPUT=$(cat)

# Extract the "command" field value from tool_input
# Try grep/sed first (handles 99% of cases), fall back to Python for escaped quotes
CMD=$(printf '%s' "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//;s/"$//' || true)

# Python fallback if grep returned empty (e.g., escaped quotes in command)
if [ -z "$CMD" ]; then
  CMD=$(printf '%s' "$INPUT" | python3 -c 'import sys,json; print(json.loads(sys.stdin.read()).get("tool_input",{}).get("command",""))' 2>/dev/null || true)
fi

# If we still couldn't extract a command, allow
if [ -z "$CMD" ]; then
  echo '{}'
  exit 0
fi

# Normalize: lowercase for case-insensitive SQL matching
CMD_LOWER=$(printf '%s' "$CMD" | tr '[:upper:]' '[:lower:]')

# Detect production context (env-aware blocking)
IS_PROD=false
case "${NODE_ENV:-}${APP_ENV:-}${ENVIRONMENT:-}" in
  *production*|*prod*|*staging*) IS_PROD=true ;;
esac

# --- Check for safe exceptions (rm -rf of build artifacts) ---
if printf '%s' "$CMD" | grep -qE 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*[[:space:]]+|--recursive[[:space:]]+)' 2>/dev/null; then
  SAFE_ONLY=true
  RM_ARGS=$(printf '%s' "$CMD" | sed -E 's/.*rm[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*//;s/--recursive[[:space:]]*//')
  for target in $RM_ARGS; do
    case "$target" in
      */node_modules|node_modules|*/\.next|\.next|*/dist|dist|*/__pycache__|__pycache__|*/\.cache|\.cache|*/build|build|*/\.turbo|\.turbo|*/coverage|coverage|*/\.gradle|\.gradle|*/target|target|*/vendor|vendor|*/Pods|Pods|*/\.venv|\.venv|*/venv|venv)
        ;; # safe target
      -*)
        ;; # flag, skip
      *)
        SAFE_ONLY=false
        break
        ;;
    esac
  done
  if [ "$SAFE_ONLY" = true ]; then
    echo '{}'
    exit 0
  fi
fi

# --- Destructive pattern checks ---
WARN=""
PATTERN=""
SEVERITY=""  # CRITICAL | HIGH | MEDIUM

# --- File system ---

# rm -rf / rm -r / rm --recursive
if printf '%s' "$CMD" | grep -qE 'rm\s+(-[a-zA-Z]*r|--recursive)' 2>/dev/null; then
  WARN="Destructive: recursive delete (rm -r). This permanently removes files."
  PATTERN="rm_recursive"
  SEVERITY="CRITICAL"
fi

# find ... -delete
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'find\s+.*-delete\b' 2>/dev/null; then
  WARN="Destructive: find -delete removes matched files. Run with -print first to review."
  PATTERN="find_delete"
  SEVERITY="HIGH"
fi

# find ... -exec rm
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'find\s+.*-exec\s+rm\b' 2>/dev/null; then
  WARN="Destructive: find -exec rm mass-deletes files. Run with -print first to review."
  PATTERN="find_exec_rm"
  SEVERITY="HIGH"
fi

# shred / wipe
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE '\b(shred|wipe)\s+' 2>/dev/null; then
  WARN="Destructive: shred/wipe irreversibly overwrites files."
  PATTERN="shred_wipe"
  SEVERITY="CRITICAL"
fi

# dd with disk target (/dev/sdX, /dev/disk)
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE '\bdd\s+.*of=/dev/(sd|disk|nvme)' 2>/dev/null; then
  WARN="Destructive: dd with disk target overwrites raw disk. Can destroy the machine."
  PATTERN="dd_disk"
  SEVERITY="CRITICAL"
fi

# chmod -R 000 or 777
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'chmod\s+(-R\s+|--recursive\s+)(000|777)\b' 2>/dev/null; then
  WARN="Destructive: recursive chmod 000/777 corrupts permissions. Apply to specific paths instead."
  PATTERN="chmod_recursive_dangerous"
  SEVERITY="HIGH"
fi

# --- SQL databases ---

# DROP TABLE / DROP DATABASE / DROP SCHEMA
if [ -z "$WARN" ] && printf '%s' "$CMD_LOWER" | grep -qE 'drop\s+(table|database|schema)' 2>/dev/null; then
  WARN="Destructive: SQL DROP detected. This permanently deletes database objects."
  PATTERN="sql_drop"
  SEVERITY="CRITICAL"
fi

# TRUNCATE
if [ -z "$WARN" ] && printf '%s' "$CMD_LOWER" | grep -qE '\btruncate\b' 2>/dev/null; then
  WARN="Destructive: SQL TRUNCATE deletes all rows from a table."
  PATTERN="sql_truncate"
  SEVERITY="CRITICAL"
fi

# prisma migrate reset
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'prisma\s+migrate\s+reset\b' 2>/dev/null; then
  WARN="Destructive: prisma migrate reset drops and recreates the database."
  PATTERN="prisma_reset"
  SEVERITY="CRITICAL"
fi

# rails / rake db:drop
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE '(rails|rake|bundle\s+exec\s+rake)\s+db:drop\b' 2>/dev/null; then
  WARN="Destructive: db:drop wipes the Rails database."
  PATTERN="rails_db_drop"
  SEVERITY="CRITICAL"
fi

# flyway clean
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'flyway\s+clean\b' 2>/dev/null; then
  WARN="Destructive: flyway clean drops all DB objects managed by Flyway."
  PATTERN="flyway_clean"
  SEVERITY="CRITICAL"
fi

# --- NoSQL / cache ---

# redis-cli FLUSHALL / FLUSHDB
if [ -z "$WARN" ] && printf '%s' "$CMD_LOWER" | grep -qE 'redis-cli\s+.*\b(flushall|flushdb)\b' 2>/dev/null; then
  WARN="Destructive: Redis FLUSH wipes keys. FLUSHALL hits all DBs; FLUSHDB hits current."
  PATTERN="redis_flush"
  SEVERITY="CRITICAL"
fi

# mongo dropDatabase
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE '(mongo|mongosh).*dropDatabase\(' 2>/dev/null; then
  WARN="Destructive: MongoDB dropDatabase removes the entire database."
  PATTERN="mongo_drop_db"
  SEVERITY="CRITICAL"
fi

# --- Git ---

# git push --force / git push -f
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'git\s+push\s+.*(-f\b|--force\b)' 2>/dev/null; then
  WARN="Destructive: git force-push rewrites remote history. Prefer --force-with-lease."
  PATTERN="git_force_push"
  SEVERITY="CRITICAL"
fi

# git reset --hard
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'git\s+reset\s+--hard' 2>/dev/null; then
  WARN="Destructive: git reset --hard discards all uncommitted changes. Stash first."
  PATTERN="git_reset_hard"
  SEVERITY="HIGH"
fi

# git checkout . / git restore .
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'git\s+(checkout|restore)\s+\.' 2>/dev/null; then
  WARN="Destructive: discards all uncommitted changes in the working tree. git diff first."
  PATTERN="git_discard"
  SEVERITY="HIGH"
fi

# git clean -fd / -fdx
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'git\s+clean\s+(-[a-zA-Z]*f[a-zA-Z]*d|-f\s+-d)' 2>/dev/null; then
  WARN="Destructive: git clean -fd/-fdx deletes untracked files. Use -n for dry run first."
  PATTERN="git_clean_force"
  SEVERITY="HIGH"
fi

# git filter-branch / git filter-repo
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'git\s+filter-(branch|repo)\b' 2>/dev/null; then
  WARN="Destructive: git filter-branch/filter-repo rewrites entire history. Backup branch first."
  PATTERN="git_filter"
  SEVERITY="CRITICAL"
fi

# --- Kubernetes / containers ---

# kubectl delete namespace
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'kubectl\s+delete\s+(namespace|ns)\b' 2>/dev/null; then
  WARN="Destructive: kubectl delete namespace removes the entire namespace and all its resources."
  PATTERN="kubectl_delete_ns"
  SEVERITY="CRITICAL"
fi

# kubectl delete (generic)
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'kubectl\s+delete\b' 2>/dev/null; then
  WARN="Destructive: kubectl delete removes Kubernetes resources. Describe first to understand dependencies."
  PATTERN="kubectl_delete"
  SEVERITY="HIGH"
fi

# docker rm -f / docker system prune -a
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'docker\s+(rm\s+.*-f|system\s+prune\s+.*-a)' 2>/dev/null; then
  WARN="Destructive: docker force-remove or prune -a. Removes containers/images/volumes."
  PATTERN="docker_destructive"
  SEVERITY="HIGH"
fi

# helm uninstall
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'helm\s+uninstall\b' 2>/dev/null; then
  WARN="Destructive: helm uninstall tears down the release. Run 'helm get all <release>' first."
  PATTERN="helm_uninstall"
  SEVERITY="HIGH"
fi

# --- Cloud / infra ---

# terraform destroy
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'terraform\s+destroy\b' 2>/dev/null; then
  WARN="Destructive: terraform destroy removes all managed infrastructure. Run 'terraform plan -destroy' first."
  PATTERN="terraform_destroy"
  SEVERITY="CRITICAL"
fi

# aws s3 rm --recursive
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'aws\s+s3\s+rm\s+.*(--recursive|-r\b)' 2>/dev/null; then
  WARN="Destructive: aws s3 rm --recursive wipes bucket contents. Enable versioning first."
  PATTERN="aws_s3_rm_recursive"
  SEVERITY="CRITICAL"
fi

# gcloud ... delete (CRITICAL scopes)
if [ -z "$WARN" ] && printf '%s' "$CMD" | grep -qE 'gcloud\s+.*\bdelete\b' 2>/dev/null; then
  WARN="Destructive: gcloud delete removes a cloud resource. Check dependencies via console first."
  PATTERN="gcloud_delete"
  SEVERITY="HIGH"
fi

# --- Output ---
if [ -n "$WARN" ]; then
  WARN_ESCAPED=$(printf '%s' "$WARN" | sed 's/"/\\"/g')
  # In production context, escalate CRITICAL patterns from ask → block
  if [ "$IS_PROD" = "true" ] && [ "$SEVERITY" = "CRITICAL" ]; then
    printf '{"permissionDecision":"block","message":"[careful] PRODUCTION BLOCK: %s Override requires a human to unset NODE_ENV/APP_ENV/ENVIRONMENT."}\n' "$WARN_ESCAPED"
  else
    printf '{"permissionDecision":"ask","message":"[careful] %s"}\n' "$WARN_ESCAPED"
  fi
else
  echo '{}'
fi

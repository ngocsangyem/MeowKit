#!/bin/bash
# secret-scrub.sh — Shared secret-scrubbing helper for meowkit hooks.
# Phase 8 (Q6 Option A): extracted at first duplication. Reused by Phase 9
# conversation-summary-cache.sh and append-trace.sh.
#
# Usage (sourced):
#   . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/secret-scrub.sh"
#   clean=$(scrub_secrets "$dirty_text")
#
# Replaces common secret patterns with [REDACTED]. Conservative — false positives
# are acceptable; missed secrets are not. Patterns reflect OWASP secret-detection
# heuristics + provider-specific prefixes.
#
# Sourcing guard
if [ "${BASH_SOURCE[0]:-}" = "${0}" ]; then
  echo "ERROR: secret-scrub.sh must be sourced, not executed directly" >&2
  exit 1
fi

scrub_secrets() {
  local input="$1"
  if [ -z "$input" ]; then
    echo ""
    return 0
  fi

  # Use a single sed pipeline with multiple expressions
  # Order matters — more-specific patterns first, generic patterns after.
  # RT-C C2 fix: split per-scheme — BSD sed (macOS) rejects ERE alternation
  # in a grouped capture inside the DB-URL pattern. One bad expr aborted the
  # whole pipeline and returned empty output. Per-scheme -e entries keep it
  # portable across GNU sed and BSD sed.
  # RT-C C3 fix: add Stripe sk_live_ / sk_test_ / rk_ / pk_ patterns so shell
  # paths (post-session.sh, conversation-summary-cache.sh, append-trace.sh)
  # redact the same Stripe keys the JS port (secret-scrub.cjs) catches.
  echo "$input" | sed -E \
    -e 's/sk-ant-[A-Za-z0-9_-]{20,}/[REDACTED-ANTHROPIC-KEY]/g' \
    -e 's/sk-[A-Za-z0-9_-]{20,}/[REDACTED-OPENAI-KEY]/g' \
    -e 's/sk_(live|test)_[A-Za-z0-9]{16,}/[REDACTED-STRIPE-KEY]/g' \
    -e 's/rk_(live|test)_[A-Za-z0-9]{16,}/[REDACTED-STRIPE-RESTRICTED-KEY]/g' \
    -e 's/pk_(live|test)_[A-Za-z0-9]{16,}/[REDACTED-STRIPE-PUB-KEY]/g' \
    -e 's/AKIA[0-9A-Z]{16}/[REDACTED-AWS-KEY]/g' \
    -e 's/ghp_[A-Za-z0-9]{30,}/[REDACTED-GH-TOKEN]/g' \
    -e 's/gho_[A-Za-z0-9]{30,}/[REDACTED-GH-OAUTH]/g' \
    -e 's/glpat-[A-Za-z0-9_-]{20,}/[REDACTED-GITLAB-PAT]/g' \
    -e 's/xox[bpars]-[0-9]+-[0-9]+-[0-9]+-[A-Za-z0-9]{24,}/[REDACTED-SLACK-TOKEN]/g' \
    -e 's|https://hooks\.slack\.com/services/[A-Z0-9/]+|[REDACTED-SLACK-WEBHOOK]|g' \
    -e 's/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/[REDACTED-JWT]/g' \
    -e 's/-----BEGIN [A-Z ]*PRIVATE KEY-----[^-]*-----END [A-Z ]*PRIVATE KEY-----/[REDACTED-PRIVATE-KEY]/g' \
    -e 's/(api[_-]?key|apikey|password|passwd|secret|token)[[:space:]]*[:=][[:space:]]*[\x27"]?[A-Za-z0-9_/+=.-]{16,}[\x27"]?/\1=[REDACTED]/Ig' \
    -e 's/Bearer [A-Za-z0-9_/+=.-]{20,}/Bearer [REDACTED]/g' \
    -e 's|mysql://[^[:space:]\"]+|mysql://[REDACTED-DB-URL]|g' \
    -e 's|postgres://[^[:space:]\"]+|postgres://[REDACTED-DB-URL]|g' \
    -e 's|postgresql://[^[:space:]\"]+|postgresql://[REDACTED-DB-URL]|g' \
    -e 's|mongodb://[^[:space:]\"]+|mongodb://[REDACTED-DB-URL]|g' \
    -e 's|redis://[^[:space:]\"]+|redis://[REDACTED-DB-URL]|g' \
    -e 's/[A-Za-z0-9._%+-]{3,}@[A-Za-z0-9.-]{3,}\.[A-Za-z]{2,}/[REDACTED-EMAIL]/g' \
    -e 's/(MEOWKIT_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD))[[:space:]]*=[[:space:]]*[^[:space:]]{8,}/\1=[REDACTED]/g'
}

# When sourced, the function is now available. No automatic action.
return 0 2>/dev/null || true

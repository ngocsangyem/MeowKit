#!/bin/bash
# MeowKit Privacy Block Hook
# PreToolUse: BLOCKS reads of sensitive files via exit code 2 (per Claude Code hooks API).
# Exit 2 = blocking error (Claude Code stops the action and feeds stderr back to the model).
# Exit 1 = non-blocking error (Claude Code logs and proceeds — NOT suitable for policy enforcement).
# Upgrades injection-rules.md Rule 4 from behavioral to preventive.
#
# Matches: Read, Edit, Write, Bash tool calls
#
# Load .claude/.env (each hook is a separate subprocess)
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true
# Blocks:
#   - .env*, *.key, *.pem, *credentials*, *secret*, *.keystore, ~/.ssh/*  (R4 sensitive files)
#   - .claude/cache/web-fetches/index.jsonl                                (C10 — browsing history disclosure)
#   - **/*.quarantined                                                     (C6 — injection-stopped content)
#   - Bash invocations of meow:web-to-markdown scripts with unsafe URLs    (C8 — defense-in-depth for SSRF)
#
# When blocked: writes block reason to stderr (Claude Code feeds stderr to model on exit 2).
# Agent must use AskUserQuestion tool to get explicit approval before retrying.

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Hook profile gating — safety-critical: NEVER skip regardless of profile
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"

# Phase 7 (260408): source JSON-on-stdin parser; prefer HOOK_* env vars, fall back to $1.
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi
FILE_PATH="${HOOK_FILE_PATH:-$1}"
COMMAND="${HOOK_COMMAND:-}"

# ---- Check 1: sensitive file path patterns (R4 — existing behavior) ----
if [ -n "$FILE_PATH" ]; then
  if echo "$FILE_PATH" | grep -qiE '\.env($|\.)|\.key$|\.pem$|credentials|secret|keystore|\.ssh/'; then
    echo "@@PRIVACY_BLOCK@@" >&2
    echo "File '$FILE_PATH' matches sensitive file pattern (injection-rules.md R4)." >&2
    echo "Use AskUserQuestion to get explicit user approval before accessing." >&2
    exit 2
  fi

  # web-to-markdown cache / manifest / quarantine — C6 + C10
  # Block reads of the manifest (browsing history) and quarantined content (untrusted).
  if echo "$FILE_PATH" | grep -qE '\.claude/cache/web-fetches/index\.jsonl$|\.quarantined$'; then
    echo "@@PRIVACY_BLOCK@@" >&2
    echo "File '$FILE_PATH' is a web-to-markdown cache artifact." >&2
    echo "The manifest contains browsing history; quarantined files contain injection-stopped content." >&2
    echo "Reading these files may disclose browsing history OR re-inject untrusted content into agent context." >&2
    echo "Use AskUserQuestion to get explicit user approval before accessing." >&2
    exit 2
  fi
fi

# ---- Check 2: web-to-markdown script invocations via Bash (C8 — defense in depth) ----
# The Python _safe_url guard is Phase 1 line-of-defense. This hook is Phase 0 defense-in-depth.
# If an agent bash-invokes fetch_as_markdown.py with a URL pointing at private/loopback/metadata IPs,
# block it here before the Python ever runs.
if [ -n "$COMMAND" ]; then
  case "$COMMAND" in
    *fetch_as_markdown.py*|*meow:web-to-markdown*)
      # Extract http(s) URL argument (best-effort — agent may quote it arbitrarily)
      URL=$(echo "$COMMAND" | grep -oE 'https?://[^[:space:]"'\''`]+' | head -1)
      if [ -n "$URL" ]; then
        HOST=$(echo "$URL" | sed -E 's|^https?://||; s|[:/].*$||; s|.*@||')
        # Reject obvious SSRF targets at hook layer (Python _safe_url is still the real guard)
        case "$HOST" in
          localhost|127.*|10.*|192.168.*|169.254.*|metadata.google.internal|metadata.*)
            echo "@@PRIVACY_BLOCK@@" >&2
            echo "Web fetch target '$HOST' is a private/loopback/metadata address." >&2
            echo "SSRF risk. Use AskUserQuestion for explicit user approval before proceeding." >&2
            exit 2
            ;;
        esac
        # Reject non-http(s) schemes that sneak into the command line
        case "$URL" in
          file://*|chrome://*|about:*|data:*|javascript:*)
            echo "@@PRIVACY_BLOCK@@" >&2
            echo "Web fetch target scheme in '$URL' is not http/https." >&2
            echo "Unsafe scheme — use AskUserQuestion for explicit user approval before proceeding." >&2
            exit 2
            ;;
        esac
      fi
      ;;
  esac
fi

exit 0

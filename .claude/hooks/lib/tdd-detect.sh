#!/bin/sh
# tdd-detect.sh — TDD mode source of truth.
#
# TDD enforcement is OPT-IN (TDD-optional migration).
# Default: OFF. Opt in via:
#   1. MEOWKIT_TDD={1,true,yes,on,enable,enabled,...}  (env — CI/shell rc)
#   2. .claude/session-state/tdd-mode = "on"           (sentinel — slash command --tdd)
#   3. MEOW_PROFILE=fast                                (legacy, forces off, deprecated)
#   4. (default)                                        off
#
# PRECEDENCE CONTRACT: env var > sentinel > legacy profile > default OFF.
# Do NOT reorder the case statements below — precedence is load-bearing
# (verified by Phase 7 Test 4).
#
# Usage:
#   . "$CLAUDE_PROJECT_DIR/.claude/hooks/lib/tdd-detect.sh"
#   if is_tdd_enabled; then ... else ... fi
#
# After is_tdd_enabled returns, $_tdd_mode and $_tdd_src are set:
#   _tdd_mode = on | off
#   _tdd_src  = env | sentinel | profile | default

_tdd_mode=off
_tdd_src=default

is_tdd_enabled() {
  # 1. Env var (highest priority — CI, shell rc, explicit export)
  case "${MEOWKIT_TDD:-}" in
    1|true|True|TRUE|yes|Yes|YES|on|On|ON|enable|Enable|enabled|Enabled)
      _tdd_mode=on
      _tdd_src=env
      return 0
      ;;
    '')
      ;;
    *)
      echo "[tdd] WARN: MEOWKIT_TDD='${MEOWKIT_TDD}' not recognized, ignoring (treating as OFF)" >&2
      ;;
  esac

  # 2. Sentinel file (slash command dispatch — see Phase 5)
  sentinel="${CLAUDE_PROJECT_DIR:-.}/.claude/session-state/tdd-mode"
  if [ -f "$sentinel" ]; then
    v=$(head -n1 "$sentinel" 2>/dev/null | tr -d '[:space:]')
    case "$v" in
      on)
        _tdd_mode=on
        _tdd_src=sentinel
        return 0
        ;;
    esac
  fi

  # 3. Legacy profile alias (deprecated — to be removed in next major)
  case "${MEOW_HOOK_PROFILE:-${MEOW_PROFILE:-standard}}" in
    fast)
      _tdd_mode=off
      _tdd_src=profile
      _tdd_warn_legacy_profile_once
      ;;
  esac

  return 1
}

# Warn-once stderr message when MEOW_PROFILE=fast is the effective source.
# Tracked via .claude/session-state/tdd-deprecation-warned marker (cleared
# on SessionStart by project-context-loader.sh alongside the sentinel).
_tdd_warn_legacy_profile_once() {
  marker="${CLAUDE_PROJECT_DIR:-.}/.claude/session-state/tdd-deprecation-warned"
  if [ ! -f "$marker" ]; then
    echo "[tdd] DEPRECATION: MEOW_PROFILE=fast will be removed in the next major version; use MEOWKIT_TDD=1 or --tdd flag instead (or unset for the new default-OFF behavior)" >&2
    mkdir -p "$(dirname "$marker")" 2>/dev/null || true
    : > "$marker" 2>/dev/null || true
  fi
}

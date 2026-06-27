#!/bin/bash
# control-probe.sh — Fires on Stop (verified-real CC event) to provide a control signal.
# Without this, "no fires" on PreCompact/PostToolUseFailure is ambiguous between
# "event unsupported" and "logger broken." Compare control fires to probe fires
# during Phase 3 telemetry analysis.
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" 2>/dev/null || true
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/hook-logger.sh" 2>/dev/null || exit 0
log_hook_event "control-probe" "fired"
exit 0

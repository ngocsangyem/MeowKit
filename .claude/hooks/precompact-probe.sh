#!/bin/bash
# precompact-probe.sh — Logs PreCompact hook fires to verify CC supports the event.
# Telemetry-only; never blocks. Replace with real summary-flush handler if/when verified.
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" 2>/dev/null || true
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/hook-logger.sh" 2>/dev/null || exit 0
log_hook_event "precompact-probe" "fired"
exit 0

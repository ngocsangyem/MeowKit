#!/bin/sh
# emit-event.sh — Fire-and-forget typed-event emitter for meowkit safety hooks.
#
# Usage (sourced):
#   . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/emit-event.sh"
#   emit_event gate.blocked "{\"gate\":\"gate1-no-plan\",\"reason\":\"...\",\"file\":\"$FILE_PATH\"}"
#
# Routes the payload through append-trace.sh (which scrubs secrets, builds the
# canonical record, and appends atomically). NEVER changes the caller's exit code,
# stream, or output — it always returns 0 and writes nothing to stdout/stderr.
#
# CRITICAL: call this OUTSIDE any `{ ...; } >&2` block and BEFORE `exit`. Inside a
# redirected compound the emitter's own output would pollute the block, and a
# non-zero return could flip the compound status so the intended `exit` is skipped.
#
# Payloads carry sanitized descriptors + paths only — never raw blocked commands
# or file contents. append-trace.sh's scrubber is the secret-scrubbing backstop.

emit_event() {
  _ev_name="$1"
  # NOTE: do NOT write ${2:-{}} — bash parses it as ${2:-{} + a literal }, which
  # appends a stray } and corrupts the JSON payload. Use a separate default assignment
  # (same hazard documented in append-trace.sh).
  _ev_data="$2"
  [ -z "$_ev_data" ] && _ev_data="{}"
  _ev_writer="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh"
  if [ -x "$_ev_writer" ]; then
    bash "$_ev_writer" "$_ev_name" "$_ev_data" >/dev/null 2>&1 || true
  fi
  unset _ev_name _ev_data _ev_writer
  return 0
}

# Install a per-hook ERR trap that emits hook.failed when an unhandled non-zero
# command runs. Guarded on BASH_VERSION: the ERR pseudo-signal is a bash feature,
# and these hooks are invoked via `bash` in settings.json. Under a dash invocation
# (no BASH_VERSION) the trap is skipped so it cannot raise "bad trap".
#
# SIDE EFFECT: this enables `set -E` (errtrace) in the *sourcing* hook's shell, not
# just here. That is intentional (so the ERR trap fires for failures inside the
# hook's functions/subshells too). Consequence: any BARE command in the hook that
# can legitimately exit non-zero OUTSIDE a conditional (if/while/&&/||/!) would fire
# a spurious hook.failed. Today none exist; if you add a bare `grep`/`find`/etc. to
# a hook that sources this lib, append `|| true` to keep it off the error path.
#   install_hook_failed_trap <hook-name>
install_hook_failed_trap() {
  _hf_hook="$1"
  if [ -n "${BASH_VERSION:-}" ]; then
    # shellcheck disable=SC3043,SC2064
    set -E 2>/dev/null || true
    trap '_hf_rc=$?; bash "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" hook.failed "{\"hook\":\"'"$_hf_hook"'\",\"shell\":\"$0\",\"exit_code\":$_hf_rc}" >/dev/null 2>&1 || true' ERR
  fi
  unset _hf_hook
  return 0
}

return 0 2>/dev/null || true

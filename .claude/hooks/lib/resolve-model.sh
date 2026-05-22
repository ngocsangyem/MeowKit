#!/bin/bash
# resolve-model.sh — Resolve the active model id for hook subprocesses.
#
# Why this exists:
#   Claude Code does NOT export CLAUDE_MODEL / MEOWKIT_MODEL_HINT / ANTHROPIC_MODEL
#   to Stop-hook subprocesses (verified 260408, harness-rules.md Rule 7).
#   The canonical source is session-state/detected-model.json written by
#   handlers/model-detector.cjs at SessionStart. This helper reads that file
#   with python3 (safe path), falls back to grep+sed if python is missing,
#   sanitizes the value, then falls back to env vars only when both fail.
#
# Resolution order:
#   1. session-state/detected-model.json -> model_id (python json.load)
#   2. session-state/detected-model.json -> model_id (grep+sed bash fallback)
#   3. Env-var chain: MEOWKIT_MODEL_HINT, CLAUDE_MODEL, ANTHROPIC_MODEL
#   4. "unknown"
#
# If the JSON file contains the literal "unknown" (model-detector.cjs:90
# failure fallback), the helper emits a stderr diagnostic naming the
# upstream failure and continues through to the env-var chain. This avoids
# silently propagating an unknown value through downstream writers when the
# real issue is SessionStart-side detection.
#
# Source contract: this file defines a function; sourcing it is side-effect
# free. Callers do `. resolve-model.sh; m=$(resolve_model)`.
#
# Security: the value is sanitized via `tr -cd 'a-zA-Z0-9._-'` before return.
# detected-model.json is writable by any process with file-system access;
# the sanitizer is defense-in-depth against a crafted model_id flowing into
# downstream `sed -i` substitution (post-session.sh model-change branch).

resolve_model() {
  local detected_file="${CLAUDE_PROJECT_DIR:-.}/session-state/detected-model.json"
  local model=""
  local source=""

  if [ -f "$detected_file" ] && command -v python3 >/dev/null 2>&1; then
    model=$(python3 -c '
import json, sys
try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
        v = d.get("model_id", "")
        print(v if isinstance(v, str) else "")
except Exception: pass
' "$detected_file" 2>/dev/null)
    [ -n "$model" ] && source="detected-model.json/python"
  fi

  if [ -z "$model" ] && [ -f "$detected_file" ]; then
    model=$(grep -o '"model_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$detected_file" \
      | head -1 \
      | sed 's/.*"model_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    [ -n "$model" ] && source="detected-model.json/grep"
  fi

  model=$(printf '%s' "$model" | tr -cd 'a-zA-Z0-9._-')

  if [ "$model" = "unknown" ] && [ -n "$source" ]; then
    echo "resolve-model: detected-model.json contains 'unknown' — model-detector.cjs at SessionStart failed to identify model. See harness-rules.md Rule 7." >&2
    model=""
  fi

  if [ -z "$model" ]; then
    model="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-${ANTHROPIC_MODEL:-unknown}}}"
    model=$(printf '%s' "$model" | tr -cd 'a-zA-Z0-9._-')
    [ -z "$model" ] && model="unknown"
  fi

  printf '%s' "$model"
}

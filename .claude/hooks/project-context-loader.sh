#!/bin/bash
# MeowKit Project Context Loader Hook
# SessionStart: Auto-load docs/project-context.md into agent context.
# Supports Phase 5 (Project Context System).
#
# If docs/project-context.md exists, outputs its content for injection.
# If not, outputs a reminder to generate it.

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Hook profile gating — context loading always needed: NEVER skip regardless of profile
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"

CONTEXT_FILE="docs/project-context.md"
VENV_PYTHON=".claude/skills/.venv/bin/python3"

# Check Python venv existence — required for MeowKit scripts
if [ ! -f "$VENV_PYTHON" ]; then
  echo "## WARNING: Python venv not found"
  echo ""
  echo "MeowKit scripts require \`.claude/skills/.venv/bin/python3\` but it doesn't exist."
  echo "Run \`npx mewkit setup\` to create the venv and install dependencies."
  echo "Until then, python-based skills (validate, security-scan, multimodal, llms) will fail."
  echo ""
fi

if [ -f "$CONTEXT_FILE" ]; then
  echo "## Project Context (auto-loaded)"
  echo ""
  cat "$CONTEXT_FILE"
else
  echo "## Project Context"
  echo ""
  echo "No project-context.md found. Run \`meow:project-context generate\` to create one."
  echo "This file helps all agents understand your project's tech stack, conventions, and anti-patterns."
fi

# ═══════════════════════════════════════════════════════════════════
# Phase 7 LocalContext expansion (LangChain harness research)
# ═══════════════════════════════════════════════════════════════════
# Inject directory structure + tool availability + package scripts at session start.
# Eliminates a whole class of "agent doesn't know what tools are available" errors.

# Session ID detection + counter reset (P16)
# Parse JSON on stdin via shared shim (if available)
if [ -f ".claude/hooks/lib/read-hook-input.sh" ]; then
  . ".claude/hooks/lib/read-hook-input.sh"
fi
LAST_SESSION_FILE="session-state/last-session-id"
mkdir -p session-state 2>/dev/null
if [ -n "${HOOK_SESSION_ID:-}" ]; then
  LAST_SESSION=""
  [ -f "$LAST_SESSION_FILE" ] && LAST_SESSION=$(cat "$LAST_SESSION_FILE" 2>/dev/null)
  if [ "$HOOK_SESSION_ID" != "$LAST_SESSION" ]; then
    # New session — reset per-session counters
    echo '{}' > session-state/edit-counts.json 2>/dev/null || true
    echo '{}' > session-state/precompletion-attempts.json 2>/dev/null || true
    echo '{}' > session-state/build-verify-cache.json 2>/dev/null || true
    rm -f session-state/conversation-summary.lock 2>/dev/null || true
    echo "$HOOK_SESSION_ID" > "$LAST_SESSION_FILE"

    # Phase 9 (M2 fix): clear conversation-summary cache on new session.
    # This is the correct home — SessionStart always runs (post-session.sh is
    # gated by MEOW_HOOK_PROFILE and exits early in default `standard` profile).
    SUMMARY_CACHE=".claude/memory/conversation-summary.md"
    if [ -f "$SUMMARY_CACHE" ]; then
      cat > "$SUMMARY_CACHE" << 'CLEAR_EOF'
---
session_id: ""
last_updated: ""
event_count: 0
transcript_size_bytes: 0
summaries: 0
---

# Conversation Summary

(empty — populated by `.claude/hooks/conversation-summary-cache.sh` on Stop event when throttle thresholds are met)
CLEAR_EOF
    fi
  fi
fi

echo ""
echo "## Directory (depth 2)"
# P11 — POSIX `find`, not `tree` (not guaranteed); P17 — line-based truncation
find . -maxdepth 2 -type d \
  -not -path '*/node_modules*' \
  -not -path '*/.git*' \
  -not -path '*/.venv*' \
  -not -path '*/target*' \
  -not -path '*/dist*' \
  -not -path '*/build*' \
  -not -path '*/.next*' \
  2>/dev/null | head -n 30

echo ""
echo "## Tools available"
for t in python3 node pnpm npm yarn bun uv cargo go rustc tsc eslint ruff mypy; do
  if command -v "$t" >/dev/null 2>&1; then
    echo "  - $t"
  fi
done

echo ""
echo "## Package scripts"
if [ -f package.json ] && [ -x "$VENV_PYTHON" ]; then
  # P18 robust parse — wrap in try/except, limit to first 10 scripts
  "$VENV_PYTHON" -c "
import json
try:
    with open('package.json') as f:
        d = json.load(f)
    scripts = d.get('scripts', {})
    for i, k in enumerate(sorted(scripts)):
        if i >= 10:
            print('  ... (' + str(len(scripts) - 10) + ' more)')
            break
        print('  - ' + k)
except Exception:
    pass  # silent on parse error
" 2>/dev/null
elif [ -f pyproject.toml ]; then
  echo "  (pyproject.toml detected — scripts in [project.scripts] or [tool.poetry.scripts])"
elif [ -f Cargo.toml ]; then
  echo "  (Cargo.toml detected — run 'cargo build' / 'cargo test')"
else
  echo "  (no recognized manifest)"
fi

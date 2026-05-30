#!/bin/bash
# the toolkit Project Context Loader Hook
# SessionStart: Auto-load docs/project-context.md into agent context.
# Supports Phase 5 (Project Context System).
#
# If docs/project-context.md exists, outputs its content for injection.
# If not, outputs a reminder to generate it.

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Load .claude/.env — shared dotenv lib (each hook is a separate subprocess,
# so every hook that reads MEOWKIT_* vars must source this independently).
# Note: as of the native `env` field fix, most control vars now come from
# settings.json `env` block. .env loading remains for API keys + overrides.
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh"
fi

# CWD mismatch guard (Fix 1b — dev-repo only but harmless in production):
# if the toolkit's dispatch.cjs marker is absent, we're not at a toolkit root.
if [ ! -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/dispatch.cjs" ]; then
  echo "## NOTE: the toolkit's hooks not detected at project root"
  echo "MEOWKIT_* config may not be loaded. Run from project root where .claude/ lives."
  echo ""
fi

# Hook profile gating — context loading always needed: NEVER skip regardless of profile
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"

CONTEXT_FILE="docs/project-context.md"
VENV_PYTHON=".claude/skills/.venv/bin/python3"

# Check Python venv existence — required for toolkit scripts
if [ ! -f "$VENV_PYTHON" ]; then
  echo "## WARNING: Python venv not found"
  echo ""
  echo "the toolkit's scripts require \`.claude/skills/.venv/bin/python3\` but it doesn't exist."
  echo "Run \`npx mewkit setup\` to create the venv and install dependencies."
  echo "Until then, python-based skills (validate, security-scan, multimodal, llms) will fail."
  echo ""
fi

# Pre-injection size gate. Gates the `cat` call on bytes so oversized
# project-context.md is truncated BEFORE injection — not warned about after.
# MEOWKIT_MAX_PROJECT_CONTEXT_BYTES=0 disables the cap entirely.
MEOWKIT_MAX_PROJECT_CONTEXT_BYTES="${MEOWKIT_MAX_PROJECT_CONTEXT_BYTES:-12288}"
# Validate integer to prevent arithmetic injection.
case "$MEOWKIT_MAX_PROJECT_CONTEXT_BYTES" in
  ''|*[!0-9]*) MEOWKIT_MAX_PROJECT_CONTEXT_BYTES=12288 ;;
esac
if [ -f "$CONTEXT_FILE" ]; then
  echo "## Project Context (auto-loaded)"
  echo ""
  if [ "${MEOWKIT_MAX_PROJECT_CONTEXT_BYTES}" -gt 0 ]; then
    CTX_BYTES=$(wc -c < "$CONTEXT_FILE" 2>/dev/null | tr -d ' ')
    CTX_BYTES="${CTX_BYTES:-0}"
    DOUBLE_THRESHOLD=$(( MEOWKIT_MAX_PROJECT_CONTEXT_BYTES * 2 ))
    if [ "$CTX_BYTES" -gt "$DOUBLE_THRESHOLD" ]; then
      echo "## ⚠⚠ project-context.md is ${CTX_BYTES}B (>${DOUBLE_THRESHOLD}B). Truncating to ${MEOWKIT_MAX_PROJECT_CONTEXT_BYTES}B."
      echo ""
      head -c "$MEOWKIT_MAX_PROJECT_CONTEXT_BYTES" "$CONTEXT_FILE"
      echo ""
    elif [ "$CTX_BYTES" -gt "$MEOWKIT_MAX_PROJECT_CONTEXT_BYTES" ]; then
      echo "## ⚠ project-context.md is ${CTX_BYTES}B (>${MEOWKIT_MAX_PROJECT_CONTEXT_BYTES}B). Consider trimming."
      echo ""
      head -c "$MEOWKIT_MAX_PROJECT_CONTEXT_BYTES" "$CONTEXT_FILE"
      echo ""
    else
      cat "$CONTEXT_FILE"
    fi
  else
    cat "$CONTEXT_FILE"  # cap disabled
  fi
else
  echo "## Project Context"
  echo ""
  echo "No project-context.md found. Run \`mk:project-context generate\` to create one."
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
    # Note: precompletion-attempts.json is NOT reset here. pre-completion-check.sh
    # owns its own lifecycle — it clears the counter when verification passes
    # (line ~110) or when the 3-attempt soft-nudge cap is hit (line ~152).
    # Resetting here breaks the cap because the host runtime assigns a new session ID
    # for every blocked-Stop cycle, which would otherwise wipe the counter mid-loop.
    echo '{}' > session-state/build-verify-cache.json 2>/dev/null || true
    # Truncate the safety/phase-zero sentinel log from prior sessions. The log
    # is keyed by session_id, so leaving stale entries in place could falsely
    # match if a session_id were ever recycled. Single-file overwrite (no
    # per-session-ID glob).
    : > session-state/session-sentinels.jsonl 2>/dev/null || true
    # CF1 fix: clear TDD sentinel + deprecation flag (written to .claude/session-state/)
    rm -f "${CLAUDE_PROJECT_DIR:-.}/.claude/session-state/tdd-mode" 2>/dev/null || true
    rm -f "${CLAUDE_PROJECT_DIR:-.}/.claude/session-state/tdd-deprecation-warned" 2>/dev/null || true
    # NOTE: session-state/active-plan is cross-skill coordination state (read by
    # pre-completion-check.sh, review/step-03b, and consumed by mk:evaluate). It
    # MUST persist across SessionStart — do NOT add a wipe here.
    echo "$HOOK_SESSION_ID" > "$LAST_SESSION_FILE"
  fi
fi


# ═══════════════════════════════════════════════════════════════════
# the toolkit's Config Status (stdout bridge — RC-0 / Fix 0c)
# ═══════════════════════════════════════════════════════════════════
# Agent cannot inspect env vars directly. Hooks load them but the LLM has no
# process.env access. Emit active control vars to stdout so agent context sees
# them. Gated on new sessions to avoid polluting resume/clear/compact events.
if [ -n "${HOOK_SESSION_ID:-}" ] && [ "$HOOK_SESSION_ID" != "${LAST_SESSION:-}" ]; then
  echo ""
  echo "## the toolkit Config"
  [ "${MEOWKIT_TDD:-0}" = "1" ] && echo "- TDD: **enabled** (strict red-green-refactor)" || echo "- TDD: off (default)"
  [ "${MEOWKIT_BUILD_VERIFY:-on}" = "off" ] && echo "- Build verify: **disabled**" || echo "- Build verify: on (default)"
  [ "${MEOWKIT_LOOP_DETECT:-on}" = "off" ] && echo "- Loop detection: **disabled**" || echo "- Loop detection: on (default)"
  [ -n "${MEOWKIT_HARNESS_MODE:-}" ] && echo "- Harness density: **${MEOWKIT_HARNESS_MODE}** (overridden)" || echo "- Harness density: auto-detect"
  echo ""
  echo "_Config sources: settings.json \`env\` (defaults) → .claude/.env (overrides) → shell export (highest). Agent sees this block at session start only._"
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

# ═══════════════════════════════════════════════════════════════════
# Personal preferences injection
# ═══════════════════════════════════════════════════════════════════
PREFS_FILE=".claude/memory/preferences.md"
if [ -f "$PREFS_FILE" ]; then
  echo ""
  echo "## Personal Preferences"
  echo "<preferences-data>"
  head -c 4096 "$PREFS_FILE"
  echo ""
  echo "</preferences-data>"
  echo ""
  echo "Note: Project rules in .claude/rules/ override personal preferences."
fi

# ═══════════════════════════════════════════════════════════════════
# Agent readiness check — advisory banner
# ═══════════════════════════════════════════════════════════════════
READY_SCORE=0
READY_MAX=5
READY_MISSING=""

if [ -f "CLAUDE.md" ] || [ -f ".claude/CLAUDE.md" ]; then
  READY_SCORE=$((READY_SCORE + 1))
else
  READY_MISSING="${READY_MISSING} CLAUDE.md"
fi

if [ -f "docs/project-context.md" ]; then
  READY_SCORE=$((READY_SCORE + 1))
else
  READY_MISSING="${READY_MISSING} project-context"
fi

# Detect test/lint/typecheck across project types
HAS_TEST=0 HAS_LINT=0 HAS_TYPECHECK=0
if [ -f "package.json" ]; then
  grep -q '"test"' package.json 2>/dev/null && HAS_TEST=1
  grep -q '"lint"' package.json 2>/dev/null && HAS_LINT=1
  grep -qE '"typecheck"|"tsc"' package.json 2>/dev/null && HAS_TYPECHECK=1
elif [ -f "pyproject.toml" ]; then
  grep -qE 'pytest|unittest' pyproject.toml 2>/dev/null && HAS_TEST=1
  grep -qE 'ruff|flake8|pylint' pyproject.toml 2>/dev/null && HAS_LINT=1
  grep -qE 'mypy|pyright' pyproject.toml 2>/dev/null && HAS_TYPECHECK=1
elif [ -f "Makefile" ]; then
  grep -q 'test:' Makefile 2>/dev/null && HAS_TEST=1
  grep -q 'lint:' Makefile 2>/dev/null && HAS_LINT=1
elif [ -f "Cargo.toml" ]; then
  HAS_TEST=1  # cargo test is built-in
  command -v clippy >/dev/null 2>&1 && HAS_LINT=1
fi

[ "$HAS_TEST" -eq 1 ] && READY_SCORE=$((READY_SCORE + 1)) || READY_MISSING="${READY_MISSING} test-cmd"
[ "$HAS_LINT" -eq 1 ] && READY_SCORE=$((READY_SCORE + 1)) || READY_MISSING="${READY_MISSING} lint-cmd"
[ "$HAS_TYPECHECK" -eq 1 ] && READY_SCORE=$((READY_SCORE + 1)) || READY_MISSING="${READY_MISSING} typecheck"

echo ""
echo "## Agent Readiness: ${READY_SCORE}/${READY_MAX}"
if [ -n "$READY_MISSING" ]; then
  echo "Missing:${READY_MISSING}"
fi

# Memory dir audit — report .md topic files exceeding 500 lines.
# Display-only (no mutation); pairs with the auto-prune block in post-session.sh.
MEM_DIR=".claude/memory"
if [ -d "$MEM_DIR" ]; then
  echo ""
  echo "## Memory files"
  BLOATED=""
  for f in "$MEM_DIR"/*.md; do
    [ -f "$f" ] || continue
    LINES=$(wc -l < "$f" 2>/dev/null | tr -d ' ')
    LINES="${LINES:-0}"
    if [ "$LINES" -gt 500 ]; then
      BLOATED="${BLOATED} $(basename "$f"):${LINES}lines"
    fi
  done
  if [ -n "$BLOATED" ]; then
    echo "⚠ Memory files >500 lines:${BLOATED}"
    echo "  Run \`/mk:memory --prune\` to trim entries >90 days."
  else
    echo "OK (all memory topic .md files ≤500 lines)"
  fi
fi

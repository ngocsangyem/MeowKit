#!/bin/sh
# pre-task-check.sh — Context isolation hook (Layer 3 defense)
# Runs BEFORE /cook, /fix, /plan, /review commands execute.
# Scans task description for prompt injection patterns.
#
# Usage: pre-task-check.sh <task-description>
# Exit codes: 0 = PASS, 1 = BLOCK
#
# POSIX-compatible (macOS + Linux). No bash-isms.

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Hook profile gating — skip context check in fast profile for speed
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"
case "$MEOW_PROFILE" in
  fast) exit 0 ;;
esac

TASK="$1"

if [ -z "$TASK" ]; then
  echo "PASS — no task description provided, skipping injection check."
  exit 0
fi

TASK_LEN=$(printf '%s' "$TASK" | wc -c | tr -d ' ')
HAS_BLOCK=0
HAS_WARN=0
FINDINGS=""

add_finding() {
  _level="$1"
  _msg="$2"
  FINDINGS="${FINDINGS}${_level} — ${_msg}
"
  if [ "$_level" = "BLOCK" ]; then
    HAS_BLOCK=1
  elif [ "$_level" = "WARN" ]; then
    HAS_WARN=1
  fi
}

# --- Check 1: Task description length ---
if [ "$TASK_LEN" -gt 5000 ]; then
  add_finding "WARN" "Task description is very long (${TASK_LEN} chars). Possible context flooding attempt."
elif [ "$TASK_LEN" -gt 500 ]; then
  add_finding "WARN" "Task description is unusually long (${TASK_LEN} chars). Review before proceeding."
fi

# --- Check 2: Instruction override patterns ---
TASK_LOWER=$(printf '%s' "$TASK" | tr '[:upper:]' '[:lower:]')

check_pattern() {
  _pattern="$1"
  _desc="$2"
  _level="$3"
  if printf '%s' "$TASK_LOWER" | grep -q "$_pattern"; then
    add_finding "$_level" "$_desc"
  fi
}

# BLOCK-level patterns — strong injection signals
check_pattern "ignore previous" "Contains 'ignore previous' — instruction override attempt" "BLOCK"
check_pattern "ignore all previous" "Contains 'ignore all previous' — instruction override attempt" "BLOCK"
check_pattern "disregard.*instructions" "Contains 'disregard instructions' — instruction override attempt" "BLOCK"
check_pattern "disregard.*rules" "Contains 'disregard rules' — rule override attempt" "BLOCK"
check_pattern "new instructions" "Contains 'new instructions' — instruction injection attempt" "BLOCK"
check_pattern "system prompt" "Contains 'system prompt' — prompt extraction/override attempt" "BLOCK"
check_pattern "you are now" "Contains 'you are now' — identity override attempt" "BLOCK"
check_pattern "forget your rules" "Contains 'forget your rules' — rule override attempt" "BLOCK"
check_pattern "pretend you are" "Contains 'pretend you are' — role manipulation attempt" "BLOCK"
check_pattern "act as if" "Contains 'act as if' — role manipulation attempt" "BLOCK"
check_pattern "ignore your programming" "Contains 'ignore your programming' — override attempt" "BLOCK"
check_pattern "override.*safety" "Contains 'override safety' — safety bypass attempt" "BLOCK"
check_pattern "bypass.*security" "Contains 'bypass security' — security bypass attempt" "BLOCK"

# WARN-level patterns — suspicious but may be legitimate
check_pattern "base64" "Contains 'base64' — possible encoding obfuscation" "WARN"
check_pattern "curl.*exfil" "Contains suspicious curl + exfil pattern" "BLOCK"
check_pattern 'curl.*\$(' "Contains curl with command substitution — possible exfiltration" "BLOCK"
check_pattern 'wget.*\$(' "Contains wget with command substitution — possible exfiltration" "BLOCK"

# --- Check 3: References to paths outside project ---
if printf '%s' "$TASK" | grep -qE '(/etc/|/usr/|/var/|/tmp/|~/\.|~/.ssh|~/.bash|~/.zsh|/root/)'; then
  add_finding "WARN" "References paths outside project directory. Verify this is intentional."
fi

# --- Check 4: Remote file execution patterns ---
if printf '%s' "$TASK_LOWER" | grep -q "fetch.*and.*execute"; then
  add_finding "BLOCK" "Contains 'fetch and execute' — remote code execution attempt."
fi
if printf '%s' "$TASK_LOWER" | grep -q "download.*and.*run"; then
  add_finding "BLOCK" "Contains 'download and run' — remote code execution attempt."
fi
if printf '%s' "$TASK_LOWER" | grep -q "curl.*|.*sh"; then
  add_finding "BLOCK" "Contains 'curl | sh' — remote script execution pattern."
fi
if printf '%s' "$TASK_LOWER" | grep -q "curl.*|.*bash"; then
  add_finding "BLOCK" "Contains 'curl | bash' — remote script execution pattern."
fi

# --- Output results ---
if [ "$HAS_BLOCK" -eq 1 ]; then
  echo "==== BLOCK — Prompt injection patterns detected ===="
  printf '%s' "$FINDINGS" | grep "^BLOCK"
  echo ""
  echo "Task execution STOPPED. Review the task description for injection attempts."
  echo "If this is a false positive, modify the task description and retry."
  exit 1
fi

if [ "$HAS_WARN" -eq 1 ]; then
  echo "==== WARN — Suspicious patterns detected ===="
  printf '%s' "$FINDINGS" | grep "^WARN"
  echo ""
  echo "Confirm with user before proceeding."
  # Exit 0 — warnings are informational, not blocking. Claude Code treats non-zero as hook error.
  exit 0
fi

echo "PASS — no injection patterns detected."
exit 0

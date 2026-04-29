#!/bin/bash
# check-hook-registration.sh — exits non-zero if a hook script on disk is not
# registered in .claude/settings.json. Per meowkit-rules.md §3:
# "Every hook in .claude/hooks/ MUST be registered in .claude/settings.json."
#
# Excluded from check (correctly NOT registered):
#   - lib/*.sh        (sourced helpers)
#   - handlers/*.cjs  (dispatched via dispatch.cjs, not directly registered)
#   - .logs/          (log dir)
#   - __tests__/      (test files)
#   - references/     (documentation)
#
# Usage: bash scripts/check-hook-registration.sh [project-root]
# Exit:  0 if clean; 1 if any unregistered hook found.

set -uo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT" || { echo "Cannot cd to $ROOT" >&2; exit 1; }

SETTINGS=".claude/settings.json"
HOOKS_DIR=".claude/hooks"

[ -f "$SETTINGS" ] || { echo "No $SETTINGS" >&2; exit 1; }
[ -d "$HOOKS_DIR" ] || { echo "No $HOOKS_DIR" >&2; exit 1; }

# Hooks on disk: top-level .sh and .cjs only (exclude subdirs)
DISK_HOOKS=$(find "$HOOKS_DIR" -maxdepth 1 -type f \( -name '*.sh' -o -name '*.cjs' \) -exec basename {} \; 2>/dev/null | sort -u)

# Indirect-call allowlist — hooks that are NOT registered in settings.json by design,
# because they're invoked through other paths verified at audit time:
#   append-trace.sh           — shared-library; called by post-session.sh, learning-observer.sh, post-write-*.sh, lib/hook-logger.sh
#   post-write-build-verify.sh — dispatched by handlers/build-verify.cjs (PostToolUse Edit|Write chain)
#   post-write-loop-detection.sh — dispatched by handlers/loop-detection.cjs (PostToolUse Edit|Write chain)
#   pre-implement.sh          — invoked by developer agent (Subagent path), not Claude Code event (per tdd-rules.md enforcement matrix)
INDIRECT_CALL_ALLOWLIST="append-trace.sh post-write-build-verify.sh post-write-loop-detection.sh pre-implement.sh"

# Hooks registered in settings.json — extract every command string and pull the basename
PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"
REGISTERED=$("$PY" - "$SETTINGS" <<'PY' 2>/dev/null
import json, os, re, sys
data = json.load(open(sys.argv[1]))
out = set()
def walk(node):
  if isinstance(node, dict):
    cmd = node.get('command')
    if isinstance(cmd, str):
      m = re.search(r'\.claude/hooks/([^"\s]+)', cmd)
      if m:
        out.add(os.path.basename(m.group(1)))
    for v in node.values(): walk(v)
  elif isinstance(node, list):
    for v in node: walk(v)
walk(data.get('hooks', {}))
for n in sorted(out): print(n)
PY
)

# Subtract direct registrations + indirect-call allowlist from disk hooks
COMBINED=$(printf "%s\n%s\n" "$REGISTERED" "$(echo "$INDIRECT_CALL_ALLOWLIST" | tr ' ' '\n')" | sort -u)
UNREG=$(comm -23 <(echo "$DISK_HOOKS") <(echo "$COMBINED"))

if [ -z "$UNREG" ]; then
  total=$(echo "$DISK_HOOKS" | wc -l | tr -d ' ')
  echo "OK: all $total hook(s) registered or allowlisted (indirect-call)"
  exit 0
fi

echo "Hooks on disk but not registered in $SETTINGS (and not in indirect-call allowlist):" >&2
echo "$UNREG" | sed 's/^/  - /' >&2
echo "" >&2
echo "Action: register in settings.json OR add to INDIRECT_CALL_ALLOWLIST with comment explaining caller." >&2
exit 1

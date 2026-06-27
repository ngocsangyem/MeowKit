#!/bin/bash
# check-hook-registration.sh — bidirectional hook-drift check.
# Per meowkit-rules.md: "Every hook in .claude/hooks/ MUST be registered in
# .claude/settings.json." This script catches drift in BOTH directions plus the
# handlers.json dispatch registry:
#
#   UNREGISTERED:   a hook script on disk is not registered in settings.json
#   MISSING-ON-DISK: a hook registered in settings.json has no file on disk
#   MISSING-HANDLER: a handler path in handlers.json has no file on disk
#
# The MISSING-HANDLER pass closes a silent hole: dispatch.cjs exits 0 on a failed
# handler load, so a deleted handler was previously invisible.
#
# Excluded from the disk→settings check (correctly NOT registered):
#   - lib/*.sh        (sourced helpers)
#   - handlers/*.cjs  (dispatched via dispatch.cjs, not directly registered)
#   - .logs/          (log dir)
#   - __tests__/      (test files)
#   - references/     (documentation)
#
# Usage: bash scripts/check-hook-registration.sh [project-root]
# Exit:  0 if clean; 1 if any drift (any of the three classes) found.

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

# --- disk→settings pass (UNREGISTERED): hook file on disk, not in settings.json ---
COMBINED=$(printf "%s\n%s\n" "$REGISTERED" "$(echo "$INDIRECT_CALL_ALLOWLIST" | tr ' ' '\n')" | sort -u)
UNREG=$(comm -23 <(echo "$DISK_HOOKS") <(echo "$COMBINED"))

# --- settings→disk pass (MISSING-ON-DISK): registered hook with no file on disk ---
# Capture FULL relative paths under hooks/ that look like real scripts (.sh/.cjs,
# no shell/glob metachars) — this excludes case-statement artifacts like `*)`.
REGISTERED_PATHS=$("$PY" - "$SETTINGS" <<'PY' 2>/dev/null
import json, re, sys
data = json.load(open(sys.argv[1]))
out = set()
real = re.compile(r'^[A-Za-z0-9._/-]+\.(sh|cjs)$')
def walk(node):
  if isinstance(node, dict):
    cmd = node.get('command')
    if isinstance(cmd, str):
      for m in re.finditer(r'\.claude/hooks/([^"\s]+)', cmd):
        p = m.group(1)
        if real.match(p):
          out.add(p)
    for v in node.values(): walk(v)
  elif isinstance(node, list):
    for v in node: walk(v)
walk(data.get('hooks', {}))
for n in sorted(out): print(n)
PY
)
MISSING_ON_DISK=""
while IFS= read -r p; do
  [ -z "$p" ] && continue
  [ -f "$HOOKS_DIR/$p" ] || MISSING_ON_DISK+="$p"$'\n'
done <<< "$REGISTERED_PATHS"

# --- handlers.json pass (MISSING-HANDLER): dispatched handler with no file on disk ---
# handlers.json stores paths relative to .claude/hooks/ (e.g. ./handlers/x.cjs);
# dispatch.cjs resolves them against HOOKS_DIR, so we normalize ./ and resolve the
# same way. A naive root-relative test -f would false-fail on every clean tree.
HANDLERS_JSON="$HOOKS_DIR/handlers.json"
MISSING_HANDLER=""
if [ -f "$HANDLERS_JSON" ]; then
  HANDLER_PATHS=$("$PY" - "$HANDLERS_JSON" <<'PY' 2>/dev/null
import json, sys
data = json.load(open(sys.argv[1]))
out = set()
def walk(node):
  if isinstance(node, dict):
    for v in node.values(): walk(v)
  elif isinstance(node, list):
    for v in node: walk(v)
  elif isinstance(node, str) and node.endswith('.cjs'):
    out.add(node)
walk(data)
for n in sorted(out): print(n)
PY
)
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    norm="${p#./}"   # strip leading ./ ; anchored at .claude/hooks/
    [ -f "$HOOKS_DIR/$norm" ] || MISSING_HANDLER+="$norm"$'\n'
  done <<< "$HANDLER_PATHS"
fi

# --- guard: a command references hooks/ but the path regex extracted nothing ---
GUARD=$("$PY" - "$SETTINGS" <<'PY' 2>/dev/null
import json, re, sys
data = json.load(open(sys.argv[1]))
bad = []
def walk(node):
  if isinstance(node, dict):
    cmd = node.get('command')
    if isinstance(cmd, str) and 'hooks/' in cmd and not re.search(r'\.claude/hooks/[^"\s]+', cmd):
      bad.append(cmd.strip()[:80])
    for v in node.values(): walk(v)
  elif isinstance(node, list):
    for v in node: walk(v)
walk(data.get('hooks', {}))
for b in bad: print(b)
PY
)

# --- report all classes; exit 1 if any drift found ---
FAIL=0
if [ -n "$UNREG" ]; then
  FAIL=1
  echo "UNREGISTERED: hook(s) on disk not registered in $SETTINGS (and not allowlisted):" >&2
  echo "$UNREG" | sed 's/^/  - /' >&2
fi
if [ -n "$MISSING_ON_DISK" ]; then
  FAIL=1
  echo "MISSING-ON-DISK: hook(s) registered in $SETTINGS with no file in $HOOKS_DIR:" >&2
  printf '%s' "$MISSING_ON_DISK" | sed '/^$/d; s/^/  - /' >&2
fi
if [ -n "$MISSING_HANDLER" ]; then
  FAIL=1
  echo "MISSING-HANDLER: handlers.json entr(ies) with no file under $HOOKS_DIR:" >&2
  printf '%s' "$MISSING_HANDLER" | sed '/^$/d; s/^/  - /' >&2
fi
if [ -n "$GUARD" ]; then
  FAIL=1
  echo "GUARD: settings command references hooks/ but no .claude/hooks/<path> could be extracted:" >&2
  echo "$GUARD" | sed 's/^/  - /' >&2
fi

if [ "$FAIL" -eq 0 ]; then
  total=$(echo "$DISK_HOOKS" | wc -l | tr -d ' ')
  echo "OK: all $total hook(s) registered/allowlisted; settings + handlers paths all exist on disk"
  exit 0
fi
echo "" >&2
echo "Action: register/restore the listed files, fix handlers.json, or update INDIRECT_CALL_ALLOWLIST with a comment." >&2
exit 1

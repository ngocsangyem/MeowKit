#!/usr/bin/env bash
# story-sizer-auto-create-execution.test.sh — per-ticket execution + failure paths.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXEC="$ROOT/.claude/skills/story-sizer/scripts/execute-auto-create.py"
PY="$ROOT/.claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"
export CLAUDE_PROJECT_DIR="$ROOT"

PASS=0
FAIL=0
FAILED_NAMES=()

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS+1))
    printf "  ok   %s\n" "$name"
  else
    FAIL=$((FAIL+1))
    FAILED_NAMES+=("$name")
    printf "  FAIL %s\n      expected: %s\n      actual:   %s\n" "$name" "$expected" "$actual"
  fi
}

assert_contains() {
  local name="$1" needle="$2" haystack="$3"
  case "$haystack" in
    *"$needle"*) PASS=$((PASS+1)); printf "  ok   %s\n" "$name" ;;
    *)
      FAIL=$((FAIL+1))
      FAILED_NAMES+=("$name")
      printf "  FAIL %s\n      missing: %s\n      in:\n%s\n" "$name" "$needle" "$haystack"
      ;;
  esac
}

# Mock invoker — controlled by env var SIM_RESULT_BY_STORY (json blob).
TMPDIR_X=$(mktemp -d)
export INVOKER_STATE_DIR="$TMPDIR_X"
export INVOKER_PY="$PY"
INVOKER="$TMPDIR_X/invoker.sh"
cat > "$INVOKER" <<'INVOKER_EOF'
#!/usr/bin/env bash
# Mock invoker for story-sizer auto-create tests.
# Reads:
#   $1                       — the command string to "execute"
#   INVOKER_STATE_DIR        — scratch dir for state file (caller-owned)
#   INVOKER_PY               — python interpreter
#   SIM_RESULT_BY_STORY      — JSON blob controlling failure simulation
cmd="$1"
result_payload="${SIM_RESULT_BY_STORY:-}"
[ -z "$result_payload" ] && result_payload='{}'
state_file="$INVOKER_STATE_DIR/state.json"
[ -f "$state_file" ] || echo '{"counter": 200}' > "$state_file"

extract() {
  result_payload="$result_payload" "$INVOKER_PY" -c "
import json, os
d = json.loads(os.environ.get('result_payload') or '{}')
print(d.get('$1', ''))
" 2>/dev/null
}

if printf "%s" "$cmd" | grep -q "jira-issue create"; then
  next=$("$INVOKER_PY" -c "
import json
s = json.load(open('$state_file'))
s['counter'] += 1
json.dump(s, open('$state_file', 'w'))
print(s['counter'])
")
  story_summary=$(printf "%s" "$cmd" | sed -n 's/.*--summary "\([^"]*\)".*/\1/p')
  fail_story=$(extract fail_on_summary_substring)
  if [ -n "$fail_story" ] && printf "%s" "$story_summary" | grep -q "$fail_story"; then
    echo '{"ok":false,"error":"simulated Call A failure"}'
    exit 1
  fi
  echo "{\"ok\":true,\"new_key\":\"AUTH-$next\"}"
  exit 0
fi

if printf "%s" "$cmd" | grep -q "jira-collaborate add-comment"; then
  key=$(printf "%s" "$cmd" | head -1 | awk '{print $3}')
  fail_keys=$(extract fail_on_comment_keys)
  if [ -n "$fail_keys" ]; then
    case ",$fail_keys," in
      *",$key,"*) echo '{"ok":false,"error":"simulated Call B failure"}'; exit 1 ;;
    esac
  fi
  echo '{"ok":true}'
  exit 0
fi

echo "{\"ok\":false,\"error\":\"unknown command\"}"
exit 1
INVOKER_EOF
chmod +x "$INVOKER"

# Build canonical batch payload.
RECORDS='[
  {"id":"S1","title":"Add OAuth login","description":"Users sign in.","acceptance_criteria":["a","b"],"flags":[],"sizing":{"points":3,"refusal_reason":null,"split_proposal":null}},
  {"id":"S2","title":"Logout button","description":"","acceptance_criteria":["c"],"flags":[],"sizing":{"points":1,"refusal_reason":null,"split_proposal":null}},
  {"id":"S3","title":"Password reset","description":"","acceptance_criteria":["d","e"],"flags":[],"sizing":{"points":5,"refusal_reason":null,"split_proposal":null}}
]'
PAYLOAD_NO_REPORT=$(printf '{"records":%s,"project":"AUTH","epic":"AUTH-100","components":null,"labels":null,"report_path":""}' "$RECORDS")

# Case 1 — happy path, all 3 stories created + commented.
OUT=$(printf "%s" "$PAYLOAD_NO_REPORT" | env SIM_RESULT_BY_STORY='{}' "$PY" "$EXEC" --invoker-mock "$INVOKER" 2>/dev/null)
STATUS_1=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["status"])')
COUNT_1=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["created"]))')
COMMENT_STATUS_1=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print({c["comment_status"] for c in json.load(sys.stdin)["created"]} == {"ok"})')
assert_eq "happy path status ok"            "ok"  "$STATUS_1"
assert_eq "3 tickets created"                "3"   "$COUNT_1"
assert_eq "all comments status ok"           "True" "$COMMENT_STATUS_1"

# Case 2 — Call A fails on story 2 → batch stops, story 1 still recorded.
OUT=$(printf "%s" "$PAYLOAD_NO_REPORT" | env SIM_RESULT_BY_STORY='{"fail_on_summary_substring":"Logout"}' "$PY" "$EXEC" --invoker-mock "$INVOKER" 2>/dev/null)
STATUS_2=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["status"])')
CREATED_2=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["created"]))')
STOPPED_AT=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["stopped_at"])')
assert_eq "Call A failure → partial status"  "partial" "$STATUS_2"
assert_eq "Call A failure → 1 created"        "1"        "$CREATED_2"
assert_eq "stopped_at points to S2"           "S2"       "$STOPPED_AT"

# Case 3 — Call B fails on first ticket → batch continues, WARN logged.
rm -f "$TMPDIR_X/state.json"
OUT=$(printf "%s" "$PAYLOAD_NO_REPORT" | env SIM_RESULT_BY_STORY='{"fail_on_comment_keys":"AUTH-201"}' "$PY" "$EXEC" --invoker-mock "$INVOKER" 2>/dev/null)
STATUS_3=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["status"])')
CREATED_3=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["created"]))')
WARNS_3=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["comment_failures"]))')
WARN_STORY=$(printf "%s" "$OUT" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["comment_failures"][0]["story_id"])')
assert_eq "Call B failure → status ok"        "ok" "$STATUS_3"
assert_eq "Call B failure → all 3 created"    "3"  "$CREATED_3"
assert_eq "1 comment failure recorded"         "1"  "$WARNS_3"
assert_eq "comment failure on S1"              "S1" "$WARN_STORY"

# Case 4 — --epic propagates to every create call.
PLAN_OUT=$(printf "%s" "$PAYLOAD_NO_REPORT" | "$PY" "$EXEC" --plan-only 2>/dev/null)
EPIC_COUNT=$(printf "%s" "$PLAN_OUT" | "$PY" -c 'import json,sys; cmds=[p["command"] for p in json.load(sys.stdin)["planned_commands"] if p["call"]=="A"]; print(sum("--epic AUTH-100" in c for c in cmds))')
assert_eq "--epic propagated to 3 create calls" "3" "$EPIC_COUNT"

# Case 5 — every Call B uses --internal.
INTERNAL_COUNT=$(printf "%s" "$PLAN_OUT" | "$PY" -c 'import json,sys; cmds=[p["command"] for p in json.load(sys.stdin)["planned_commands"] if p["call"]=="B"]; print(sum("--internal" in c for c in cmds))')
B_COUNT=$(printf "%s" "$PLAN_OUT" | "$PY" -c 'import json,sys; print(sum(1 for p in json.load(sys.stdin)["planned_commands"] if p["call"]=="B"))')
assert_eq "every Call B carries --internal" "$B_COUNT" "$INTERNAL_COUNT"

# Case 6 — no Call B carries --public.
PUBLIC_COUNT=$(printf "%s" "$PLAN_OUT" | "$PY" -c 'import json,sys; cmds=[p["command"] for p in json.load(sys.stdin)["planned_commands"] if p["call"]=="B"]; print(sum("--public" in c for c in cmds))')
assert_eq "zero Call B carries --public" "0" "$PUBLIC_COUNT"

# Case 7 — comment template override via MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE.
CUSTOM_TEMPLATE_PATH="$TMPDIR_X/custom-template.txt"
cat > "$CUSTOM_TEMPLATE_PATH" <<'TMPL_EOF'
TEAM-FOO sizing: {{points}}pt — see {{report_path}} §{{story_id}}.
TMPL_EOF
PLAN_CUSTOM=$(printf "%s" "$PAYLOAD_NO_REPORT" | env MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE="$CUSTOM_TEMPLATE_PATH" "$PY" "$EXEC" --plan-only 2>/dev/null)
FIRST_B_BODY=$(printf "%s" "$PLAN_CUSTOM" | "$PY" -c 'import json,sys; cmds=[p["command"] for p in json.load(sys.stdin)["planned_commands"] if p["call"]=="B"]; print(cmds[0])')
assert_contains "MEOWKIT_* template override applied" "TEAM-FOO sizing" "$FIRST_B_BODY"

# Case 8 — no forbidden flags appear in any planned command.
FORBIDDEN_COUNT=$(printf "%s" "$PLAN_OUT" | "$PY" -c '
import json,sys
forbidden=("--assignee","--priority","--sprint","--blocks","--custom-fields")
cmds=[p["command"] for p in json.load(sys.stdin)["planned_commands"]]
print(sum(1 for c in cmds for f in forbidden if f in c))
')
assert_eq "zero forbidden v1 flags in planned commands" "0" "$FORBIDDEN_COUNT"

# Case 9 — comment template never carries raw description text.
RAW_DESC="Users sign in."
DESC_LEAK=$(printf "%s" "$PLAN_OUT" | "$PY" -c "
import json, sys
cmds=[p['command'] for p in json.load(sys.stdin)['planned_commands'] if p['call']=='B']
print(sum('$RAW_DESC' in c for c in cmds))
")
assert_eq "raw description not leaked into comment" "0" "$DESC_LEAK"

# Cleanup
rm -rf "$TMPDIR_X"

printf "\n%d passed, %d failed\n" "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf "failed cases:\n"
  for n in "${FAILED_NAMES[@]}"; do printf "  - %s\n" "$n"; done
  exit 1
fi

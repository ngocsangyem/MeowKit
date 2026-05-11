#!/usr/bin/env bash
# story-sizer-heuristics.test.sh — sizing heuristics determinism + Fibonacci coverage.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCORER="$ROOT/.claude/skills/story-sizer/scripts/score-story.py"
PY="$ROOT/.claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"

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

score() {
  local fixture="$1"
  printf "%s" "$fixture" | "$PY" "$SCORER" -
}

points_for() {
  printf "%s" "$1" | "$PY" -c '
import json, sys, os
target_id = os.environ.get("RECORD_ID", "S1")
data = json.load(sys.stdin)
match = next((r for r in data["records"] if r["id"] == target_id), None)
print(match["sizing"]["points"] if match else "missing")
'
}

# Fixture: simple AC-only story → expect 1-2 points
F_SIMPLE='{"records":[{"id":"S1","title":"Add about-us link","description":"Footer link","acceptance_criteria":["Link visible in footer","Click navigates to /about"],"source_body":"...","source_hash":"h","flags":[]}],"scout_context":null,"agile_loaded":false}'
RESULT="$(score "$F_SIMPLE")"
PTS_SIMPLE="$(RECORD_ID=S1 points_for "$RESULT")"
[ "$PTS_SIMPLE" = "1" ] || [ "$PTS_SIMPLE" = "2" ] && OK_SIMPLE="yes" || OK_SIMPLE="no"
assert_eq "simple AC-only → 1 or 2 points" "yes" "$OK_SIMPLE"

# Fixture: 3 ACs with one external integration → expect 3 points
F_INTEG='{"records":[{"id":"S1","title":"Login with Google OAuth","description":"User logs in using Google OAuth","acceptance_criteria":["Click Google button starts OAuth flow","Callback handler creates a session","Failed OAuth shows error"],"source_body":"...","source_hash":"h","flags":[]}],"scout_context":null,"agile_loaded":false}'
RESULT="$(score "$F_INTEG")"
PTS_INTEG="$(RECORD_ID=S1 points_for "$RESULT")"
assert_eq "3-AC + OAuth → 3 points" "3" "$PTS_INTEG"

# Fixture: 5 ACs touching 3 modules → expect 5-8 points
F_BROAD='{"records":[{"id":"S1","title":"Build admin reporting dashboard","description":"Admins see reports across billing, profile, and notification metrics. Render charts.","acceptance_criteria":["Dashboard renders for admin role","Billing chart shows daily revenue","Profile completion gauge displays","Notification volume bar chart","Export to CSV works"],"source_body":"...","source_hash":"h","flags":[]}],"scout_context":null,"agile_loaded":false}'
RESULT="$(score "$F_BROAD")"
PTS_BROAD="$(RECORD_ID=S1 points_for "$RESULT")"
[ "$PTS_BROAD" = "5" ] || [ "$PTS_BROAD" = "8" ] || [ "$PTS_BROAD" = "13" ] && OK_BROAD="yes" || OK_BROAD="no"
assert_eq "5-AC + cross-module → 5/8/13 points" "yes" "$OK_BROAD"

# Fixture: multi-concern + risk verb + many ACs → expect 13 with SPLIT
F_HUGE='{"records":[{"id":"S1","title":"Migrate auth, billing, and notifications to new stripe-driven OAuth pipeline","description":"Rewrite the auth module, refactor billing to call Stripe with OAuth tokens, integrate Twilio for SMS notifications, and update the admin dashboard. Adds Webhook handlers. Replaces SSO. Breaking change to API.","acceptance_criteria":["Auth tokens refresh via OAuth","Stripe billing webhook accepted","SMS notification sent via Twilio","Admin dashboard shows migration status","Old SSO endpoints return 410","Webhook signatures verified","Email confirmations sent","Audit log records each migration step"],"source_body":"...","source_hash":"h","flags":[]}],"scout_context":null,"agile_loaded":false}'
RESULT="$(score "$F_HUGE")"
PTS_HUGE="$(RECORD_ID=S1 points_for "$RESULT")"
SPLIT_PRESENT="$(printf "%s" "$RESULT" | "$PY" -c 'import json,sys; print(bool(json.load(sys.stdin)["records"][0]["sizing"]["split_proposal"]))')"
assert_eq "multi-concern + risk → 13 points"      "13"   "$PTS_HUGE"
assert_eq "13-pt story carries split_proposal"     "True" "$SPLIT_PRESENT"

# Fixture: AC contradiction → inconsistencies non-empty
F_CONTRA='{"records":[{"id":"S1","title":"Login redirect","description":"After login, redirect.","acceptance_criteria":["After successful login, redirect to /dashboard","After successful login, redirect to /app/dashboard"],"source_body":"...","source_hash":"h","flags":[]}],"scout_context":null,"agile_loaded":false}'
RESULT="$(score "$F_CONTRA")"
INCONS_COUNT="$(printf "%s" "$RESULT" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["records"][0]["sizing"]["inconsistencies"]))')"
[ "$INCONS_COUNT" -gt 0 ] && CONTRA_OK="yes" || CONTRA_OK="no"
assert_eq "AC contradiction flagged" "yes" "$CONTRA_OK"

# Fixture: NO_ACS flag → refuse sizing
F_NOACS='{"records":[{"id":"S1","title":"Foo","description":"","acceptance_criteria":[],"source_body":"...","source_hash":"h","flags":["[NO_ACS]"]}],"scout_context":null,"agile_loaded":false}'
RESULT="$(score "$F_NOACS")"
PTS_NOACS="$(printf "%s" "$RESULT" | "$PY" -c 'import json,sys; r=json.load(sys.stdin)["records"][0]["sizing"]; print("null" if r["points"] is None else r["points"])')"
REASON_NOACS="$(printf "%s" "$RESULT" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["records"][0]["sizing"]["refusal_reason"])')"
assert_eq "NO_ACS → points null"             "null"                      "$PTS_NOACS"
assert_eq "NO_ACS → refusal_reason set"      "missing acceptance criteria" "$REASON_NOACS"

# Determinism: same input twice produces same numeric output
A="$(score "$F_INTEG" | "$PY" -c 'import json,sys; r=json.load(sys.stdin)["records"][0]["sizing"]; print(r["points"], r["drivers_score"], r["complexity"])')"
B="$(score "$F_INTEG" | "$PY" -c 'import json,sys; r=json.load(sys.stdin)["records"][0]["sizing"]; print(r["points"], r["drivers_score"], r["complexity"])')"
assert_eq "deterministic numeric output across runs" "$A" "$B"

# DoR advisory present when agile_loaded=true
F_DOR='{"records":[{"id":"S1","title":"Add logout button","description":"As a user I want to log out so that my session is cleared.","acceptance_criteria":["When the user clicks logout, session cookie is cleared","User redirected to /login"],"source_body":"...","source_hash":"h","flags":[]}],"scout_context":null,"agile_loaded":true}'
RESULT="$(score "$F_DOR")"
DOR_PRESENT="$(printf "%s" "$RESULT" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["records"][0]["sizing"]["dor_status"] is not None)')"
assert_eq "DoR advisory present when agile_loaded" "True" "$DOR_PRESENT"

# DoR omitted when agile_loaded=false
F_NODOR='{"records":[{"id":"S1","title":"X","description":"y","acceptance_criteria":["z"],"source_body":"...","source_hash":"h","flags":[]}],"scout_context":null,"agile_loaded":false}'
RESULT="$(score "$F_NODOR")"
DOR_ABSENT="$(printf "%s" "$RESULT" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["records"][0]["sizing"]["dor_status"] is None)')"
assert_eq "DoR advisory omitted otherwise" "True" "$DOR_ABSENT"

printf "\n%d passed, %d failed\n" "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf "failed cases:\n"
  for n in "${FAILED_NAMES[@]}"; do printf "  - %s\n" "$n"; done
  exit 1
fi

#!/usr/bin/env bash
# story-sizer-input-adapter.test.sh — tests the paste-mode parser.

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/.claude/skills/story-sizer/scripts/parse-paste-stories.py"
PY="$(cd "$(dirname "$0")/.." && pwd)/.claude/skills/.venv/bin/python3"
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

run() {
  printf "%s" "$1" | "$PY" "$SCRIPT" -
}

# Case 1 — three well-formed stories.
INPUT_1='story: Add login form
description: Email + password fields with validation.
ac:
  - Form rejects empty email
  - Submitting sets session cookie
---
story: Forgot password flow
description: Email-based reset link.
ac:
  - Reset email sent within 30s
---
story: Logout button in header
ac:
  - Click clears session cookie
  - Redirects to /'
OUT_1="$(run "$INPUT_1")"
COUNT_1="$(printf "%s" "$OUT_1" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["records"]))')"
assert_eq "three well-formed stories" "3" "$COUNT_1"

# Case 2 — one story missing AC list → [NO_ACS] flag preserved as a record.
INPUT_2='story: Story with ACs
ac:
  - It works
---
story: Story without ACs
description: This one is missing the ac: list.'
OUT_2="$(run "$INPUT_2")"
NO_ACS_COUNT="$(printf "%s" "$OUT_2" | "$PY" -c 'import json,sys; print(sum(1 for r in json.load(sys.stdin)["records"] if "[NO_ACS]" in r["flags"]))')"
TOTAL_2="$(printf "%s" "$OUT_2" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["records"]))')"
assert_eq "two records emitted, one without ACs"  "2"  "$TOTAL_2"
assert_eq "[NO_ACS] flag on second story"          "1"  "$NO_ACS_COUNT"

# Case 3 — malformed: missing story: key, only a stray description: line.
INPUT_3='description: Just a description with no title key
ac:
  - First criterion'
OUT_3="$(run "$INPUT_3")"
ERR_COUNT_3="$(printf "%s" "$OUT_3" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["errors"]))')"
TOTAL_3="$(printf "%s" "$OUT_3" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["records"]))')"
[ "$ERR_COUNT_3" -gt 0 ] && ERR_3="present" || ERR_3="absent"
assert_eq "malformed block emits [MALFORMED_INPUT]" "present" "$ERR_3"
assert_eq "malformed block produces zero records"   "0"        "$TOTAL_3"

# Case 4 — title length > 255 → rejected.
LONG_TITLE="$(printf 'a%.0s' {1..260})"
INPUT_4="story: ${LONG_TITLE}
ac:
  - never reached"
OUT_4="$(run "$INPUT_4")"
TOTAL_4="$(printf "%s" "$OUT_4" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["records"]))')"
ERR_4="$(printf "%s" "$OUT_4" | "$PY" -c 'import json,sys; print("title" in json.load(sys.stdin)["errors"][0]["message"])')"
assert_eq "long-title story rejected (zero records)" "0"     "$TOTAL_4"
assert_eq "long-title error mentions title"          "True"  "$ERR_4"

# Case 5 — AC length > 500 → rejected.
LONG_AC="$(printf 'b%.0s' {1..510})"
INPUT_5="story: Short title
ac:
  - ${LONG_AC}"
OUT_5="$(run "$INPUT_5")"
TOTAL_5="$(printf "%s" "$OUT_5" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["records"]))')"
assert_eq "AC > 500 chars rejects the story" "0" "$TOTAL_5"

# Case 6 — whitespace-tolerant parsing: trailing spaces on keys.
INPUT_6='   story:    Trim test
description:    has padding
ac:
   - first
   - second   '
OUT_6="$(run "$INPUT_6")"
TITLE_6="$(printf "%s" "$OUT_6" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["records"][0]["title"])')"
AC_COUNT_6="$(printf "%s" "$OUT_6" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["records"][0]["acceptance_criteria"]))')"
assert_eq "whitespace-tolerant title" "Trim test" "$TITLE_6"
assert_eq "whitespace-tolerant ACs"   "2"          "$AC_COUNT_6"

# Case 7 — source_hash is deterministic and identical across all records in a batch.
HASH_A="$(run "$INPUT_1" | "$PY" -c 'import json,sys; d=json.load(sys.stdin); print(d["source_hash"])')"
HASH_B="$(run "$INPUT_1" | "$PY" -c 'import json,sys; d=json.load(sys.stdin); print(d["source_hash"])')"
PER_REC_HASH="$(run "$INPUT_1" | "$PY" -c 'import json,sys; d=json.load(sys.stdin); print(len({r["source_hash"] for r in d["records"]}))')"
assert_eq "source_hash deterministic across runs" "$HASH_A" "$HASH_B"
assert_eq "every record carries the batch hash"   "1"        "$PER_REC_HASH"

# Case 8 — ids are sequential S1..SN.
IDS="$(run "$INPUT_1" | "$PY" -c 'import json,sys; print(",".join(r["id"] for r in json.load(sys.stdin)["records"]))')"
assert_eq "sequential ids S1,S2,S3" "S1,S2,S3" "$IDS"

printf "\n%d passed, %d failed\n" "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf "failed cases:\n"
  for n in "${FAILED_NAMES[@]}"; do printf "  - %s\n" "$n"; done
  exit 1
fi

#!/usr/bin/env bash
# validate-contract.sh — Schema validator for sprint contract files.
# Usage:  validate-contract.sh <path-to-contract.md>
# Exit:   0 if valid, 1 if FAIL (diagnostics on stderr), 2 on usage error
# Reqs:   Bash 3.2+. Tested macOS BSD + GNU coreutils.
#
# Per Phase 4 spec:
#   - Required frontmatter fields present (including contract_schema_version)
#   - ≥ 5 testable AC entries (warns at > 20)
#   - Every AC has Given/When/Then OR explicit assertion form
#   - Every AC has a Verification line
#   - Every AC has a Rubric tie-in
#   - No instruction-like prompt-injection patterns in criterion text
set -u

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <path-to-contract.md>" >&2
  exit 2
fi

contract="$1"

if [ ! -f "$contract" ]; then
  echo "FAIL: contract file not found: $contract" >&2
  exit 1
fi

fail=0

# ---- Field extraction helper ----
get_field() {
  awk -v field="$1" '
    /^---$/{f++; next}
    f==1 && $0 ~ "^"field":" {
      sub("^"field":[[:space:]]*", "", $0)
      print $0
      exit
    }
  ' "$contract"
}

# 1. Required frontmatter fields
for field in "contract_schema_version" "task" "sprint" "plan_ref" "rubric_preset" "status" "rounds" "created"; do
  if [ -z "$(get_field "$field")" ]; then
    echo "FAIL: missing required frontmatter field: $field" >&2
    fail=1
  fi
done

# 2. status must be a valid value
status=$(get_field "status")
case "$status" in
  draft|negotiating|signed|amended|closed|"") ;;
  *)
    echo "FAIL: status '$status' not in {draft, negotiating, signed, amended, closed}" >&2
    fail=1
    ;;
esac

# 3. rubric_preset must be a known preset
preset=$(get_field "rubric_preset")
case "$preset" in
  frontend-app|backend-api|cli-tool|fullstack-product|"") ;;
  *)
    echo "FAIL: rubric_preset '$preset' not in canonical preset list" >&2
    fail=1
    ;;
esac

# 4. AC count: ≥ 5 (warn at > 20)
ac_count=$(grep -cE '^### \[AC-[0-9]+\]' "$contract" || true)
if [ "$ac_count" -lt 5 ]; then
  echo "FAIL: only $ac_count AC entries (minimum 5)" >&2
  fail=1
fi
if [ "$ac_count" -gt 20 ]; then
  echo "WARN: $ac_count AC entries — contract bloat risk (target 5–15)" >&2
fi

# 5. Every AC has a Verification line within its section
# Walk per-AC sections; for each, check that body contains "Verification:" + "Rubric tie-in:".
# Also check that body has Given/When/Then OR an explicit assertion form.
awk '
  BEGIN { current=""; has_when=0; has_then=0; has_verification=0; has_rubric=0; has_given=0; fail_state=0 }

  /^### \[AC-/ {
    # Flush previous AC
    if (current != "") {
      if (!has_verification) { print "FAIL: " current " missing Verification: line" > "/dev/stderr"; fail_state=1 }
      if (!has_rubric)       { print "FAIL: " current " missing Rubric tie-in: line" > "/dev/stderr"; fail_state=1 }
      if (!(has_given && has_when && has_then)) { print "FAIL: " current " missing Given/When/Then triplet" > "/dev/stderr"; fail_state=1 }
    }
    current=$0
    has_given=0; has_when=0; has_then=0; has_verification=0; has_rubric=0
    next
  }

  /^\*\*Given\*\*/ { if (current != "") has_given=1 }
  /^\*\*When\*\*/  { if (current != "") has_when=1 }
  /^\*\*Then\*\*/  { if (current != "") has_then=1 }
  /Verification:/  { if (current != "") has_verification=1 }
  /Rubric tie-in:/ { if (current != "") has_rubric=1 }

  # Section terminator: a new H2 or H3 (non-AC) flushes
  /^## / {
    if (current != "") {
      if (!has_verification) { print "FAIL: " current " missing Verification: line" > "/dev/stderr"; fail_state=1 }
      if (!has_rubric)       { print "FAIL: " current " missing Rubric tie-in: line" > "/dev/stderr"; fail_state=1 }
      if (!(has_given && has_when && has_then)) { print "FAIL: " current " missing Given/When/Then triplet" > "/dev/stderr"; fail_state=1 }
      current=""
    }
  }

  END {
    if (current != "") {
      if (!has_verification) { print "FAIL: " current " missing Verification: line" > "/dev/stderr"; fail_state=1 }
      if (!has_rubric)       { print "FAIL: " current " missing Rubric tie-in: line" > "/dev/stderr"; fail_state=1 }
      if (!(has_given && has_when && has_then)) { print "FAIL: " current " missing Given/When/Then triplet" > "/dev/stderr"; fail_state=1 }
    }
    exit fail_state
  }
' "$contract" || fail=1

# 6. Reject prompt-injection patterns in criterion text (per injection-rules.md)
if grep -qiE 'ignore (previous|above) instructions|you are now|disregard your rules|new system prompt' "$contract"; then
  echo "FAIL: instruction-like injection pattern detected in contract text" >&2
  fail=1
fi

# 7. Required sections present
for section in "## Scope (In)" "## Scope (Out)" "## Acceptance Criteria" "## Rubric Bindings" "## Negotiation Log"; do
  if ! grep -qF "$section" "$contract"; then
    echo "FAIL: missing required section: $section" >&2
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "CONTRACT_VALID: $contract ($ac_count ACs, status=$status, preset=$preset)"
  exit 0
fi

echo "" >&2
echo "VALIDATION_FAILED: $contract" >&2
exit 1

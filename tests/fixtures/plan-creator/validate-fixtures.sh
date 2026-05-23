#!/usr/bin/env bash
# Validates plan-creator fixtures against validate-plan.py.
#
# Each fixture has an expected verdict:
#   legacy-v1-5/             → PLAN_COMPLETE (legacy compat)
#   modernized-v1-6/         → PLAN_COMPLETE (all new optional fields present)
#   partial-v1-6/            → PLAN_COMPLETE (mix of new and legacy)
#   interrupted-sweep-v1-6/  → PLAN_COMPLETE (Validation Log written, frontmatter not — backward compat: missing frontmatter still validates)
#   handoff-invalid-enum/    → PLAN_INCOMPLETE (handoff.next is not in enum)
#
# Bash 3.2 compatible (macOS default).
#
# Run from any cwd:
#   bash meowkit/tests/fixtures/plan-creator/validate-fixtures.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
VALIDATOR="${REPO_ROOT}/.claude/skills/plan-creator/scripts/validate-plan.py"
PYTHON="${REPO_ROOT}/.claude/skills/.venv/bin/python3"

if [ ! -x "${PYTHON}" ]; then
  echo "ERROR: ${PYTHON} not found. Run 'npx mewkit setup' to create the venv." >&2
  exit 2
fi

if ! "${PYTHON}" -c 'import yaml' 2>/dev/null; then
  echo "ERROR: PyYAML missing from ${PYTHON}. Run 'npx mewkit setup'." >&2
  exit 2
fi

if [ ! -f "${VALIDATOR}" ]; then
  echo "ERROR: validator not found at ${VALIDATOR}" >&2
  exit 2
fi

FIXTURES="legacy-v1-5 modernized-v1-6 partial-v1-6 interrupted-sweep-v1-6 handoff-invalid-enum"
EXPECTED_legacy_v1_5="PLAN_COMPLETE"
EXPECTED_modernized_v1_6="PLAN_COMPLETE"
EXPECTED_partial_v1_6="PLAN_COMPLETE"
EXPECTED_interrupted_sweep_v1_6="PLAN_COMPLETE"
EXPECTED_handoff_invalid_enum="PLAN_INCOMPLETE"

pass_count=0
fail_count=0

for fixture in ${FIXTURES}; do
  plan_path="${SCRIPT_DIR}/${fixture}/plan.md"
  var_name="EXPECTED_$(echo "${fixture}" | tr '-' '_')"
  expected="$(eval "echo \"\${${var_name}}\"")"

  if [ ! -f "${plan_path}" ]; then
    echo "MISSING  ${fixture}: plan.md not found"
    fail_count=$((fail_count + 1))
    continue
  fi

  output="$("${PYTHON}" "${VALIDATOR}" "${plan_path}" 2>&1)"
  first_line="${output%%$'\n'*}"

  case "${first_line}" in
    "${expected}"*)
      echo "PASS     ${fixture}: ${first_line}"
      pass_count=$((pass_count + 1))
      ;;
    *)
      echo "FAIL     ${fixture}: expected '${expected}', got:"
      echo "${output}" | sed 's/^/         /'
      fail_count=$((fail_count + 1))
      ;;
  esac
done

echo
echo "Summary: ${pass_count} passed, ${fail_count} failed"
exit "${fail_count}"

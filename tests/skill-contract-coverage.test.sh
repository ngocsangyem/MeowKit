#!/usr/bin/env bash
# skill-contract-coverage.test.sh — aggregator for the critical-skill contract suites
# added to reach >=3 deterministic evals per critical skill (eval-coverage audit).
# Each suite pins documented SKILL.md invariants; a suite fails if a pinned invariant
# is edited away, so these double as contract drift protection.

set -e
HERE="$(cd "$(dirname "$0")" && pwd)"

for skill in investigate build-fix document-release validate-plan workflow-orchestrator resolving-merge-conflicts; do
  echo "== ${skill} =="
  bash "$HERE/${skill}-skill-contract.test.sh"
done

echo
echo "All critical-skill contract coverage suites passed."

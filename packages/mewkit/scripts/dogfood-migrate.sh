#!/usr/bin/env bash
# Dogfood: runs `mewkit migrate <tool> --dry-run` against this package's own
# bundled `.claude/` for every supported provider. Aggregates results and
# captures a snapshot of preflight outputs for review.
#
# Use as part of release checklist before tagging. NOT a unit test.
#
# Usage:
#   ./scripts/dogfood-migrate.sh             # all 15 providers, dry-run
#   ./scripts/dogfood-migrate.sh --real      # also run wet against project scope (DANGER)

set -euo pipefail

PKG_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SANDBOX="${TMPDIR:-/tmp}/mewkit-dogfood-${TIMESTAMP}"
REPORT="${PKG_ROOT}/plans/reports/dogfood-${TIMESTAMP}.md"

REAL_RUN=false
if [[ "${1:-}" == "--real" ]]; then
  REAL_RUN=true
fi

PROVIDERS=(
  cursor codex droid opencode goose gemini-cli antigravity
  github-copilot amp kilo kiro roo windsurf cline openhands
)

mkdir -p "${SANDBOX}"
mkdir -p "$(dirname "${REPORT}")"

echo "# Mewkit Migrate Dogfood Report" > "${REPORT}"
echo "" >> "${REPORT}"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "${REPORT}"
echo "Sandbox: \`${SANDBOX}\`" >> "${REPORT}"
echo "Real-run: \`${REAL_RUN}\`" >> "${REPORT}"
echo "" >> "${REPORT}"

if [[ ! -d "${PKG_ROOT}/dist" ]]; then
  echo "[!] dist/ not built. Running tsc..." >&2
  (cd "${PKG_ROOT}" && npx tsc)
fi

MEWKIT_BIN="${PKG_ROOT}/dist/index.js"
SOURCE_DIR="${PKG_ROOT}/.claude"

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "[!] No .claude/ at ${SOURCE_DIR}. Cannot dogfood — bundle a kit first." >&2
  exit 1
fi

PASS=0
FAIL=0

for provider in "${PROVIDERS[@]}"; do
  echo "" >> "${REPORT}"
  echo "## ${provider}" >> "${REPORT}"
  echo "" >> "${REPORT}"
  echo "\`\`\`" >> "${REPORT}"

  set +e
  cd "${SANDBOX}"
  rm -rf .claude
  cp -r "${SOURCE_DIR}" .
  OUTPUT="$(node "${MEWKIT_BIN}" migrate "${provider}" --dry-run --yes 2>&1)"
  EXIT=$?
  set -e

  echo "${OUTPUT}" | head -40 >> "${REPORT}"
  echo "\`\`\`" >> "${REPORT}"

  if [[ ${EXIT} -eq 0 ]]; then
    echo "Result: **PASS**" >> "${REPORT}"
    PASS=$((PASS + 1))
  else
    echo "Result: **FAIL** (exit ${EXIT})" >> "${REPORT}"
    FAIL=$((FAIL + 1))
  fi

  cd "${PKG_ROOT}"
done

if [[ "${REAL_RUN}" == "true" ]]; then
  echo "" >> "${REPORT}"
  echo "## Real-run (cursor only, sandbox)" >> "${REPORT}"
  echo "" >> "${REPORT}"
  echo "\`\`\`" >> "${REPORT}"
  cd "${SANDBOX}"
  set +e
  WET_OUT="$(node "${MEWKIT_BIN}" migrate cursor --yes 2>&1)"
  WET_EXIT=$?
  set -e
  echo "${WET_OUT}" | head -40 >> "${REPORT}"
  echo "\`\`\`" >> "${REPORT}"
  echo "Real-run exit: ${WET_EXIT}" >> "${REPORT}"
  cd "${PKG_ROOT}"
fi

echo "" >> "${REPORT}"
echo "## Summary" >> "${REPORT}"
echo "" >> "${REPORT}"
echo "- Providers tested: ${#PROVIDERS[@]}" >> "${REPORT}"
echo "- Pass: ${PASS}" >> "${REPORT}"
echo "- Fail: ${FAIL}" >> "${REPORT}"

echo ""
echo "[i] Dogfood complete. Report: ${REPORT}"
echo "    Pass: ${PASS} / ${#PROVIDERS[@]}"
echo "    Fail: ${FAIL}"

# Cleanup sandbox
rm -rf "${SANDBOX}"

exit ${FAIL}

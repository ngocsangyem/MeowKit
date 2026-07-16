#!/usr/bin/env bash
# Validates positive and negative fixtures against validate-skill.py.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
VALIDATOR="${REPO_ROOT}/.claude/skills/skill-creator/scripts/validate-skill.py"
PYTHON="${REPO_ROOT}/.claude/skills/.venv/bin/python3"

if [ ! -x "${PYTHON}" ] || [ ! -f "${VALIDATOR}" ]; then
  echo "ERROR: skill validator or Python venv is unavailable" >&2
  exit 2
fi

"${PYTHON}" "${VALIDATOR}" "${SCRIPT_DIR}/valid"

if "${PYTHON}" "${VALIDATOR}" "${SCRIPT_DIR}/invalid"; then
  echo "ERROR: invalid skill fixture unexpectedly passed" >&2
  exit 1
fi

echo "PASS: valid fixture accepted and invalid fixture rejected"

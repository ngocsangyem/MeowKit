#!/bin/bash
# compare-runs.sh — Read two prior benchmark run JSONs and emit a delta table.
#
# Usage:  compare-runs.sh <run-id-a> <run-id-b>
# Exit:   0 on success; 1 if either run not found
# Reqs:   Bash 3.2+, node
#
# Reads .claude/benchmarks/results/{run-id}.json for each run, joins by task name,
# emits a markdown delta table to stdout.
set -u

if [ $# -ne 2 ]; then
  echo "usage: $0 <run-id-a> <run-id-b>" >&2
  exit 2
fi

RUN_A="$1"
RUN_B="$2"

[ -n "${CLAUDE_PROJECT_DIR:-}" ] && cd "$CLAUDE_PROJECT_DIR"

RESULTS_DIR=".claude/benchmarks/results"
FILE_A="$RESULTS_DIR/${RUN_A}.json"
FILE_B="$RESULTS_DIR/${RUN_B}.json"

# Some users may pass just the timestamp prefix; try to find a matching file
if [ ! -f "$FILE_A" ]; then
  MATCH=$(ls "$RESULTS_DIR"/${RUN_A}*.json 2>/dev/null | head -1)
  [ -n "$MATCH" ] && FILE_A="$MATCH"
fi
if [ ! -f "$FILE_B" ]; then
  MATCH=$(ls "$RESULTS_DIR"/${RUN_B}*.json 2>/dev/null | head -1)
  [ -n "$MATCH" ] && FILE_B="$MATCH"
fi

[ -f "$FILE_A" ] || { echo "ERROR: run not found: $RUN_A (looked at $FILE_A)" >&2; exit 1; }
[ -f "$FILE_B" ] || { echo "ERROR: run not found: $RUN_B (looked at $FILE_B)" >&2; exit 1; }

FILE_A="$FILE_A" FILE_B="$FILE_B" node "$(dirname "$0")/lib/render-run-delta.cjs"

exit 0

#!/usr/bin/env bash
# story-sizer-all.test.sh — aggregator across every mk:story-sizer test suite.

set -e
HERE="$(cd "$(dirname "$0")" && pwd)"

bash "$HERE/story-sizer-input-adapter.test.sh"
bash "$HERE/story-sizer-heuristics.test.sh"
bash "$HERE/story-sizer-auto-create-gating.test.sh"
bash "$HERE/story-sizer-auto-create-execution.test.sh"

echo
echo "All mk:story-sizer phase suites passed."

#!/usr/bin/env bash
# trace-detect.test.sh: trace-records.cjs detect applies the taxonomy signals that the
# trace still carries, and threshold keeps only patterns at the minimum count.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/.claude/skills/trace-analyze/scripts/trace-records.cjs"
PASS=0; FAIL=0
check() {
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); printf '  ok   %s\n' "$1"
  else FAIL=$((FAIL+1)); printf '  FAIL %s (want %s, got %s)\n' "$1" "$3" "$2"; fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/log.jsonl" <<'EOF'
{"schema_version":"1.0","ts":"2026-01-01T00:00:00Z","event":"file_edited","run_id":"r1","data":{"file":"app/package.json"}}
{"schema_version":"1.0","ts":"2026-01-01T00:10:00Z","event":"session_end","run_id":"r1","data":{"duration_seconds":30000}}
{"schema_version":"1.0","ts":"2026-01-01T01:00:00Z","event":"verdict_written","run_id":"r2","data":{"overall":"FAIL","weighted_score":0.4}}
{"schema_version":"1.0","ts":"2026-01-01T01:30:00Z","event":"session_end","run_id":"r2","data":{"duration_seconds":100}}
{"schema_version":"9.9","ts":"2026-01-01T02:00:00Z","event":"session_end","run_id":"r3","data":{}}
EOF

node "$SCRIPT" ingest "$TMP/log.jsonl" "$TMP" >/dev/null 2>&1
node "$SCRIPT" detect "$TMP" >/dev/null
count() { node -e 'const j=require(process.argv[1]);console.log((j[process.argv[2]]||{}).occurrences??"none")' "$TMP/synthesized.json" "$1"; }

check "a run that ends without a verdict is premature" "$(count premature-exit-without-verify)" "1"
check "a long run without a verdict exceeds the time budget" "$(count time-budget-exceeded)" "1"
check "a low-scoring failed verdict is slop" "$(count slop-buildup)" "1"
check "an early package.json edit is missing context" "$(count missing-environmental-context)" "1"
check "an unknown schema version is skipped" "$(node -e 'const j=require(process.argv[1]);console.log(JSON.stringify(j["premature-exit-without-verify"].affected_runs))' "$TMP/synthesized.json")" '["r1"]'

node "$SCRIPT" threshold "$TMP" 2 >/dev/null
check "threshold drops patterns under the minimum" "$(node -e 'console.log(Object.keys(require(process.argv[1])).length)' "$TMP/filtered.json")" "0"

if node "$SCRIPT" detect "$TMP" no-such-pattern >/dev/null 2>&1; then
  FAIL=$((FAIL+1)); echo "  FAIL an unknown pattern name is an error"
else
  PASS=$((PASS+1)); echo "  ok   an unknown pattern name is an error"
fi

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0

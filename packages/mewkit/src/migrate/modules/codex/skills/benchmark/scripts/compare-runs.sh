#!/bin/bash
# compare-runs.sh — Read two prior benchmark run JSONs and emit a delta table.
#
# Usage:  compare-runs.sh <run-id-a> <run-id-b>
# Exit:   0 on success; 1 if either run not found
# Reqs:   Bash 3.2+, .claude/skills/.venv/bin/python3
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

PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"
command -v "$PY" >/dev/null 2>&1 || { echo "ERROR: python3 not found" >&2; exit 1; }

FILE_A="$FILE_A" FILE_B="$FILE_B" "$PY" -c '
import json, os

with open(os.environ["FILE_A"]) as f:
    a = json.load(f)
with open(os.environ["FILE_B"]) as f:
    b = json.load(f)

# Build per-task lookup
ta = {t["name"]: t for t in a.get("tasks", [])}
tb = {t["name"]: t for t in b.get("tasks", [])}

all_names = sorted(set(ta.keys()) | set(tb.keys()))

print(f"# Benchmark Comparison: {a[\"run_id\"]} vs {b[\"run_id\"]}")
print()
print(f"**Run A:** {a[\"run_id\"]} ({a[\"tier\"]}, model: {a.get(\"model\",\"?\")})")
print(f"**Run B:** {b[\"run_id\"]} ({b[\"tier\"]}, model: {b.get(\"model\",\"?\")})")
if a.get("model") != b.get("model"):
    print()
    print("> Model differs between runs — model upgrade is a confounding variable.")
print()
print("| Task | Run A | Run B | Δ score | Δ cost |")
print("|---|---|---|---|---|")

total_a_score = 0
total_b_score = 0
n_a = 0
n_b = 0

for name in all_names:
    a_task = ta.get(name, {})
    b_task = tb.get(name, {})
    a_raw = a_task.get("weighted_score")
    b_raw = b_task.get("weighted_score")
    # PENDING guard — null scores are excluded from averages (distinct from valid 0).
    if a_raw is None or b_raw is None:
        a_display = "PENDING" if a_raw is None else f"{a_raw:.2f}"
        b_display = "PENDING" if b_raw is None else f"{b_raw:.2f}"
        print(f"| {name} | {a_display} | {b_display} | — (PENDING — excluded from average) | — |")
        continue
    a_score = a_raw
    b_score = b_raw
    a_cost = a_task.get("cost_usd") or 0
    b_cost = b_task.get("cost_usd") or 0
    delta_score = b_score - a_score
    delta_cost = b_cost - a_cost
    sign_score = "+" if delta_score >= 0 else ""
    sign_cost = "+" if delta_cost >= 0 else ""
    print(f"| {name} | {a_score:.2f} | {b_score:.2f} | {sign_score}{delta_score:.2f} | {sign_cost}${delta_cost:.2f} |")
    total_a_score += a_score
    n_a += 1
    total_b_score += b_score
    n_b += 1

avg_a = total_a_score / n_a if n_a else 0
avg_b = total_b_score / n_b if n_b else 0
delta_avg = avg_b - avg_a
print(f"| **AVG** | {avg_a:.2f} | {avg_b:.2f} | {(\"+\" if delta_avg>=0 else \"\")}{delta_avg:.2f} | — |")
print()
print(f"**Run A total cost:** ${a.get(\"total_cost_usd\", 0):.2f}")
print(f"**Run B total cost:** ${b.get(\"total_cost_usd\", 0):.2f}")
'

exit 0

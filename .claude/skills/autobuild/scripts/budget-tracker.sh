#!/usr/bin/env bash
# budget-tracker.sh — Reads cost-log.json, computes cumulative spend, applies thresholds.
#
# Usage:
#   budget-tracker.sh check               # check current run cost vs thresholds; exit 0 ok / 1 warn / 2 block
#   budget-tracker.sh add <usd> <step>    # append a cost entry for the current run
#   budget-tracker.sh total               # echo cumulative spend (USD)
#
# Exit:
#   0  — under warn threshold
#   1  — over warn threshold (budget.warn, $30 default)
#   2  — over hard block threshold (budget.block, $100 default)
#   3  — over the user cap (budget.cap; 0 means no cap)
#
# All three thresholds are USD and come from .meowkit/config.yaml, which is the
# one place they are written. A shell cannot parse YAML, so they are resolved
# through the hook-side reader; without node the documented defaults apply.
#
# Reqs: Bash 3.2+, awk. node for the config read, optional.
set -u

# The reader ships beside this script, in the kit. Which PROJECT it answers for
# is CLAUDE_PROJECT_DIR, or the working directory, and the reader resolves that
# itself — so a kit invoked from outside its own tree still reads the right file.
config_reader="$(dirname "$0")/../../../hooks/lib/config-get.cjs"

# One resolved config value, or the fallback. A cost brake must not fail shut on
# an unreadable config, so every failure path prints the default and carries on.
config_get() {
  if command -v node >/dev/null 2>&1 && [ -f "$config_reader" ]; then
    node "$config_reader" "$1" "$2" 2>/dev/null || printf '%s\n' "$2"
  else
    printf '%s\n' "$2"
  fi
}

cost_log="${MEOWKIT_COST_LOG:-.meowkit/telemetry/cost-log.json}"
warn_threshold=$(config_get budget.warn 30)
block_threshold=$(config_get budget.block 100)
user_cap=$(config_get budget.cap 0)  # 0 = no user cap
run_id="${MEOWKIT_RUN_ID:-current}"

# Ensure cost log exists
if [ ! -f "$cost_log" ]; then
  mkdir -p "$(dirname "$cost_log")" 2>/dev/null || true
  echo '{"runs": {}}' > "$cost_log"
fi

# Compute total spend for current run from JSONL-like cost log.
# Format: each line is `{"run_id": "...", "step": "...", "usd": N.NN, "ts": "..."}`
get_total() {
  local rid="$1"
  awk -v rid="$rid" '
    /"run_id":/ {
      if ($0 ~ "\"run_id\": *\""rid"\"") {
        match($0, /"usd": *[0-9.]+/)
        if (RSTART > 0) {
          val = substr($0, RSTART+7, RLENGTH-7)
          gsub(/[^0-9.]/, "", val)
          sum += val + 0
        }
      }
    }
    END { printf "%.2f", sum }
  ' "$cost_log"
}

case "${1:-check}" in
  check)
    total=$(get_total "$run_id")
    # User cap (highest priority)
    if [ "$user_cap" != "0" ]; then
      if awk -v t="$total" -v c="$user_cap" 'BEGIN{exit !(t > c)}'; then
        echo "@@BUDGET_BLOCK@@: \$$total exceeds user cap \$$user_cap" >&2
        exit 3
      fi
    fi
    # Hard block
    if awk -v t="$total" -v c="$block_threshold" 'BEGIN{exit !(t > c)}'; then
      echo "@@BUDGET_BLOCK@@: \$$total exceeds hard block \$$block_threshold" >&2
      exit 2
    fi
    # Warn
    if awk -v t="$total" -v c="$warn_threshold" 'BEGIN{exit !(t > c)}'; then
      echo "@@BUDGET_WARN@@: \$$total exceeds warn threshold \$$warn_threshold" >&2
      exit 1
    fi
    echo "OK: \$$total"
    exit 0
    ;;

  add)
    usd="${2:-0}"
    # Validate usd is a non-negative number (prevents JSONL corruption + threshold bypass)
    # Reject: empty, non-numeric chars, multiple dots (e.g. 0.0.0), leading/trailing dots
    case "$usd" in
      ''|*[!0-9.]*|*.*.*|.*|*.) echo "ERROR: usd must be a non-negative number, got: $usd" >&2; exit 2;;
    esac
    step="${3:-unknown}"
    ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    entry="{\"run_id\": \"$run_id\", \"step\": \"$step\", \"usd\": $usd, \"ts\": \"$ts\"}"
    # Append as a new line (JSONL hybrid — each line a JSON object)
    echo "$entry" >> "$cost_log"
    echo "ADDED: \$$usd for $step (run=$run_id)"
    exit 0
    ;;

  total)
    total=$(get_total "$run_id")
    echo "$total"
    exit 0
    ;;

  -h|--help)
    sed -n '2,19p' "$0"
    exit 0
    ;;

  *)
    echo "ERROR: unknown subcommand: $1" >&2
    echo "usage: $0 [check|add <usd> <step>|total]" >&2
    exit 2
    ;;
esac

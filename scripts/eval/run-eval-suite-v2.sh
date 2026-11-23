#!/usr/bin/env bash
# Run an eval suite against two kit versions on one or more models, then compare.
#
# Run it in your own terminal, from the repository root, with your Claude Code
# token already exported (CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`, or
# ANTHROPIC_API_KEY). The script never prints, stores or forwards the token: it
# only passes your environment to `mewkit eval run`, which hands it to `claude`.
#
#   scripts/eval/run-eval-suite-v2.sh                       # suite v2, Haiku, kit before vs after the skill audit
#   scripts/eval/run-eval-suite-v2.sh --models "haiku sonnet" --suite v2-ext
#   scripts/eval/run-eval-suite-v2.sh --models "opus fable" --max-cost-usd 80
#
# Options (defaults in brackets):
#   --suite NAME        v2 | v2-ext                                   [v2]
#   --models LIST       any of: haiku sonnet opus fable               [haiku]
#   --base-ref REF      kit before the change                         [5a03c5b0, main before the skill audit]
#   --new-ref REF       kit after the change                          [42c00054, main after the core-workflow rewrite]
#   --max-cost-usd N    ceiling per `eval run`, shared across concurrent runs [25]
#   --dry-run           list the runs and stop; no model is called
#
# Output: one report per (kit, model) under .meowkit/telemetry/eval/, and one
# analysis per model under tasks/reports/ (eval-<suite>-<model>-<stamp>.txt).
set -euo pipefail

SUITE=v2
MODELS=haiku
BASE_REF=5a03c5b0
NEW_REF=42c00054
MAX_COST=25
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --suite) SUITE=$2; shift 2 ;;
    --models) MODELS=$2; shift 2 ;;
    --base-ref) BASE_REF=$2; shift 2 ;;
    --new-ref) NEW_REF=$2; shift 2 ;;
    --max-cost-usd) MAX_COST=$2; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,23p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

model_id() {
  case "$1" in
    haiku) echo claude-haiku-5-5 ;;
    sonnet) echo claude-sonnet-5-5 ;;
    opus) echo claude-opus-5-5 ;;
    fable) echo claude-fable-5-2 ;;
    *) echo "unknown model: $1 (use haiku, sonnet, opus or fable)" >&2; exit 2 ;;
  esac
}

REPO=$(git rev-parse --show-toplevel)
cd "$REPO"

# Build mewkit from this checkout into its own target folder, so a binary another
# eval run is using (target/debug/mewkit) is never replaced mid-run.
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$REPO/target/eval-v2}"
echo "Building mewkit into $CARGO_TARGET_DIR ..."
cargo build --quiet -p mewkit-cli
MEWKIT="$CARGO_TARGET_DIR/debug/mewkit"

TOTAL=$("$MEWKIT" eval run --suite "$SUITE" --dry-run | tail -1)
echo "Suite $SUITE: $TOTAL"
RUNS=$(echo "$TOTAL" | sed -E 's/.* ([0-9]+) runs.*/\1/')
MAX_RUNS=$((RUNS + RUNS / 10 + 1))
if [ "$DRY" = 1 ]; then
  for m in $MODELS; do echo "would run: $(model_id "$m") x kits $BASE_REF, $NEW_REF ($RUNS runs each, cap $MAX_RUNS)"; done
  exit 0
fi

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Export CLAUDE_CODE_OAUTH_TOKEN (from \`claude setup-token\`) or ANTHROPIC_API_KEY first." >&2
  exit 1
fi

WORK=$(mktemp -d "${TMPDIR:-/tmp}/eval-v2.XXXXXX")
cleanup() {
  for d in "$WORK"/kit-*; do [ -d "$d" ] && git worktree remove --force "$d" >/dev/null 2>&1 || true; done
  rm -rf "$WORK"
}
trap cleanup EXIT

# One kit archive per ref, built from a throwaway worktree of that commit.
build_kit() {
  local ref=$1 dir="$WORK/kit-$1"
  git worktree add --quiet --detach "$dir" "$ref"
  (cd "$dir" && node scripts/prepare-release-assets.cjs 0.0.0-eval >/dev/null)
  cp "$dir/dist/meowkit-release.zip" "$WORK/$ref.zip"
  git worktree remove --force "$dir"
  echo "$WORK/$ref.zip"
}
echo "Building kit archives for $BASE_REF and $NEW_REF ..."
BASE_ZIP=$(build_kit "$BASE_REF")
NEW_ZIP=$(build_kit "$NEW_REF")

run_suite() {
  local model=$1 zip=$2 log
  log=$("$MEWKIT" eval run --suite "$SUITE" --model "$model" \
    --kit-archive "$zip" --max-cost-usd "$MAX_COST" --max-runs "$MAX_RUNS" \
    --max-turns 30 --timeout-secs 900 | tee /dev/stderr)
  echo "$log" | sed -n 's/^Report: \(.*\) (complete: .*)$/\1/p' | tail -1
}

mkdir -p tasks/reports
STAMP=$(date +%y%m%d-%H%M)
i=0
for m in $MODELS; do
  id=$(model_id "$m")
  # Alternate which kit runs first, so slow drift on the provider side does not
  # always land on the same kit.
  if [ $((i % 2)) = 0 ]; then
    base_report=$(run_suite "$id" "$BASE_ZIP"); new_report=$(run_suite "$id" "$NEW_ZIP")
  else
    new_report=$(run_suite "$id" "$NEW_ZIP"); base_report=$(run_suite "$id" "$BASE_ZIP")
  fi
  i=$((i + 1))
  out="tasks/reports/eval-$SUITE-$m-$STAMP.txt"
  {
    echo "suite $SUITE, model $id, base $BASE_REF ($base_report), new $NEW_REF ($new_report)"
    python3 scripts/eval/analyze-eval-reports.py "$base_report" "$new_report"
    echo
    "$MEWKIT" eval compare "$base_report" "$new_report" || true
  } | tee "$out"
  echo "Analysis: $out"
done

#!/usr/bin/env bash
# density-select.sh — Echoes the harness scaffolding density token (MINIMAL|FULL|LEAN)
# based on detected model + tier. Used by meow:harness step-00 and any caller that
# needs scriptable density resolution.
#
# Usage:  density-select.sh [--tier auto|trivial|standard|complex] [--model <model-id>]
# Exit:   0 always (token to stdout); 2 on usage error
# Reqs:   Bash 3.2+. POSIX shell features only.
#
# Decision rules (per Phase 5 of harness plan):
#   tier == TRIVIAL                                            → MINIMAL
#   tier == STANDARD                                           → FULL
#   tier == COMPLEX + model contains opus-4-6/4.6/4-7          → LEAN
#   tier == COMPLEX + other model                              → FULL
#
# Override:
#   MEOWKIT_HARNESS_MODE=MINIMAL|FULL|LEAN  (env var, highest priority)
#   --tier flag                              (cli, second priority)
#   --model flag                             (cli, supplements tier)
#   auto-detection from CLAUDE_MODEL env var (fallback)
set -u

# 1. Highest priority: MEOWKIT_HARNESS_MODE env override
if [ -n "${MEOWKIT_HARNESS_MODE:-}" ]; then
  case "$MEOWKIT_HARNESS_MODE" in
    MINIMAL|FULL|LEAN)
      echo "$MEOWKIT_HARNESS_MODE"
      exit 0
      ;;
    *)
      echo "ERROR: invalid MEOWKIT_HARNESS_MODE='$MEOWKIT_HARNESS_MODE' (expected MINIMAL|FULL|LEAN)" >&2
      exit 2
      ;;
  esac
fi

# 2. Parse args
tier=""
# Model id auto-detection — try multiple env var names since Claude Code's
# canonical env var name has changed across versions and may not be set in all
# subagent contexts. Order: explicit MEOWKIT_MODEL_HINT > CLAUDE_MODEL > ANTHROPIC_MODEL > empty.
# (Closes red-team C3 — previously read only $CLAUDE_MODEL which may not be exported.)
model="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-${ANTHROPIC_MODEL:-}}}"
while [ $# -gt 0 ]; do
  case "$1" in
    --tier)
      tier="$2"
      shift 2
      ;;
    --model)
      model="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,17p' "$0"
      exit 0
      ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

# 3. Tier auto-detection (if not provided via flag)
if [ -z "$tier" ] || [ "$tier" = "auto" ]; then
  case "$model" in
    *haiku*)
      tier="TRIVIAL"
      ;;
    *opus-4-6*|*opus-4.6*|*opus-4-7*|*opus-4.7*)
      tier="COMPLEX"
      ;;
    *opus*)
      tier="COMPLEX"
      ;;
    *sonnet*)
      tier="STANDARD"
      ;;
    *)
      # Unknown model — default to STANDARD (safest middle)
      tier="STANDARD"
      ;;
  esac
fi

# Normalize tier value
case "$tier" in
  trivial|TRIVIAL) tier="TRIVIAL" ;;
  standard|STANDARD) tier="STANDARD" ;;
  complex|COMPLEX) tier="COMPLEX" ;;
  *)
    echo "ERROR: invalid tier='$tier' (expected TRIVIAL|STANDARD|COMPLEX)" >&2
    exit 2
    ;;
esac

# 4. Apply decision rules
case "$tier" in
  TRIVIAL)
    echo "MINIMAL"
    ;;
  STANDARD)
    echo "FULL"
    ;;
  COMPLEX)
    case "$model" in
      *opus-4-6*|*opus-4.6*|*opus-4-7*|*opus-4.7*)
        echo "LEAN"
        ;;
      *)
        echo "FULL"
        ;;
    esac
    ;;
esac

exit 0

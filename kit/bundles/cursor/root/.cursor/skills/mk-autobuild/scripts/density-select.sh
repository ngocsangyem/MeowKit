#!/usr/bin/env bash
# density-select.sh — Echoes the autobuild scaffolding density token (MINIMAL|FULL|LEAN)
# based on an explicit tier. Used by mk:autobuild step-00 and any caller that needs
# scriptable density resolution.
#
# Usage:  density-select.sh [--tier auto|trivial|standard|complex]
# Exit:   0 always (token to stdout); 2 on usage error
# Reqs:   Bash 3.2+. POSIX shell features only.
#
# Cursor note: a Cursor custom agent's `model` field is `inherit` — there is no
# session env var exposing the underlying model id to this script, so density can
# NEVER be auto-detected from a model string here. Tier must come from an explicit
# source (flag or env var); absent one, this script falls back to the safe
# STANDARD -> FULL default. LEAN is reachable ONLY via explicit opt-in.
#
# Decision rules:
#   tier == TRIVIAL                     -> MINIMAL
#   tier == STANDARD                    -> FULL
#   tier == COMPLEX (no explicit LEAN)  -> FULL
#   MEOWKIT_AUTOBUILD_MODE=LEAN (explicit opt-in, any tier) -> LEAN
#
# Override:
#   MEOWKIT_AUTOBUILD_MODE=MINIMAL|FULL|LEAN  (env var, highest priority)
#   --tier flag                              (cli, second priority)
#   (no override)                            -> STANDARD tier -> FULL density
set -u

# 1. Highest priority: MEOWKIT_AUTOBUILD_MODE env override
if [ -n "${MEOWKIT_AUTOBUILD_MODE:-}" ]; then
  case "$MEOWKIT_AUTOBUILD_MODE" in
    MINIMAL|FULL|LEAN)
      echo "$MEOWKIT_AUTOBUILD_MODE"
      exit 0
      ;;
    *)
      echo "ERROR: invalid MEOWKIT_AUTOBUILD_MODE='$MEOWKIT_AUTOBUILD_MODE' (expected MINIMAL|FULL|LEAN)" >&2
      exit 2
      ;;
  esac
fi

# 2. Parse args
tier=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tier)
      tier="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

# 3. No auto-detection is possible (no model-id signal available). Default to the
#    safe middle tier unless the caller passed an explicit --tier.
if [ -z "$tier" ] || [ "$tier" = "auto" ]; then
  tier="STANDARD"
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

# 4. Apply decision rules. LEAN is never derived here — it only arrives via the
#    MEOWKIT_AUTOBUILD_MODE branch above, since it requires an explicit user assertion
#    that the underlying model can handle reduced scaffolding.
case "$tier" in
  TRIVIAL)
    echo "MINIMAL"
    ;;
  STANDARD|COMPLEX)
    echo "FULL"
    ;;
esac

exit 0

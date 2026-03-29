#!/usr/bin/env bash
# check-freeze.sh — thin passthrough to meow:freeze/bin/check-freeze.sh
# Allows meow:investigate hooks to reference a local bin/ path while
# delegating actual freeze-boundary logic to the canonical implementation.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/../../meow:freeze/bin/check-freeze.sh"

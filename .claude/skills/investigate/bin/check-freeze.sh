#!/usr/bin/env bash
# check-freeze.sh — thin passthrough to mk:freeze/bin/check-freeze.sh
# Allows mk:investigate hooks to reference a local bin/ path while
# delegating actual freeze-boundary logic to the canonical implementation.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/../../mk:freeze/bin/check-freeze.sh"

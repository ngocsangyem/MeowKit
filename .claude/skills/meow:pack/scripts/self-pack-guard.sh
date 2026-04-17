#!/usr/bin/env bash
# self-pack-guard.sh — block packing the current repo without explicit --self
#
# Usage: self-pack-guard.sh <target> [--self]
# Exit 0: safe to proceed (target is remote / external / self override present)
# Exit 1: blocked (target resolves to current git root, no --self override)

set -euo pipefail

target="${1:-}"
self_flag="${2:-}"

# Empty target — defensive; skill should always pass a source
[ -z "$target" ] && exit 0

# Non-existent local path → treat as remote source (owner/repo, URL, etc.)
# repomix handles remote resolution itself; guard has no opinion here.
[ ! -d "$target" ] && exit 0

# Resolve target to absolute path
abs_target="$(cd "$target" 2>/dev/null && pwd || echo "")"
[ -z "$abs_target" ] && exit 0

# Resolve target's git root (may be empty if not a git repo)
target_root="$(git -C "$abs_target" rev-parse --show-toplevel 2>/dev/null || echo "")"
[ -z "$target_root" ] && exit 0

# Resolve current session's git root
current_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || echo "")"
[ -z "$current_root" ] && exit 0

# Same repo → require --self override
if [ "$target_root" = "$current_root" ] && [ "$self_flag" != "--self" ]; then
  echo "BLOCKED: refusing to pack the current repo ($current_root)." >&2
  echo "" >&2
  echo "  For inbound Claude context, use /meow:scout instead." >&2
  echo "  To deliberately export the current repo, pass --self." >&2
  exit 1
fi

exit 0

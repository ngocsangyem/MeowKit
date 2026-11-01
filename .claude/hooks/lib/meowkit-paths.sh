#!/usr/bin/env bash
# meowkit-paths.sh — shell twin of lib/meowkit-paths.cjs.
#
# Resolves the runtime-neutral `.meowkit/` state taxonomy so shell hooks, node
# handlers, and the mewkit CLI all agree on where state lives:
#   memory/     the team store (decisions.md, gotchas.md)
#   telemetry/  append logs (cost-log, trace-log, skill-usage, reviews)
#   state/      session markers, flags, model metadata
#   cache/      derived, rebuildable artifacts
#
# Pre-migration fallback: a project whose memory still lives at `.claude/memory`
# keeps using it until `mewkit migrate` moves it, so a user's history is never
# split across two trees.
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/meowkit-paths.sh"
#   MEMORY_DIR="$(meowkit_state_dir memory)"

meowkit_project_root() {
  printf '%s' "${CLAUDE_PROJECT_DIR:-$PWD}"
}

# Exit 0 when the legacy tree holds a recognised MEMORY store file (decisions.md or
# gotchas.md) and no `.meowkit/memory` counterpart exists. A stray log or cache file in
# that directory must not relocate the committed store into a gitignored path.
meowkit_using_legacy_tree() {
  local root legacy
  root="$(meowkit_project_root)"
  [ -d "$root/.meowkit/memory" ] && return 1
  legacy="$root/.claude/memory"
  [ -d "$legacy" ] || return 1
  [ -e "$legacy/decisions.md" ] || [ -e "$legacy/gotchas.md" ] || return 1
  return 0
}

# meowkit_state_dir <memory|telemetry|state|cache> -> absolute path
meowkit_state_dir() {
  local cls="$1" root
  root="$(meowkit_project_root)"
  # Legacy fallback is scoped to `memory`: telemetry/state/cache never lived there.
  if [ "$cls" = "memory" ] && meowkit_using_legacy_tree; then
    printf '%s' "$root/.claude/memory"
  else
    printf '%s' "$root/.meowkit/$cls"
  fi
}

#!/usr/bin/env bash
# meowkit-paths.sh — shell twin of lib/meowkit-paths.cjs.
#
# Resolves the runtime-neutral `.meowkit/` state taxonomy so shell hooks, node
# handlers, and the mewkit CLI all agree on where state lives:
#   memory/     curated stores + generated views
#   telemetry/  append logs (cost-log, trace-log, skill-usage, reviews, eureka)
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

# Exit 0 when the legacy tree holds real content and no `.meowkit/` counterpart exists.
meowkit_using_legacy_tree() {
  local root legacy
  root="$(meowkit_project_root)"
  [ -d "$root/.meowkit/memory" ] && return 1
  legacy="$root/.claude/memory"
  [ -d "$legacy" ] || return 1
  # Any entry other than the tracked .gitkeep marker counts as real content.
  find "$legacy" -mindepth 1 ! -name '.gitkeep' -print -quit 2>/dev/null | grep -q . || return 1
  return 0
}

# meowkit_state_dir <memory|telemetry|state|cache> -> absolute path
meowkit_state_dir() {
  local cls="$1" root
  root="$(meowkit_project_root)"
  if meowkit_using_legacy_tree; then
    printf '%s' "$root/.claude/memory"
  else
    printf '%s' "$root/.meowkit/$cls"
  fi
}

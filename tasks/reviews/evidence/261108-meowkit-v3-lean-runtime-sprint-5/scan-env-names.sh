#!/bin/sh
# Pinned universe scan. Trees: .claude packages scripts tests docs .github .meowkit
# Excluded: node_modules, .git, .claude/worktrees (duplicate checkout),
# packages/mewkit/src/migrate/modules (generated projections), RELEASING.md, tasks/
# Prefix fragments (a name ending in `_`) are discarded: they are interpolation stems, not names.
grep -rhoE '\b(MEOWKIT|MEOW|MK)_[A-Z0-9][A-Z0-9_]*' \
  .claude packages scripts tests docs .github .meowkit 2>/dev/null \
  --binary-files=without-match \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=worktrees --exclude-dir=modules --exclude-dir=dist --exclude-dir=.next \
  | grep -vE '_$' | sort -u

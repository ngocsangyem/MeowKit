#!/bin/sh
# scan-env-names.sh — the single definition of the kit's environment-name universe.
#
# Every count anywhere about `MEOWKIT_*` / `MEOW_*` / `MK_*` names comes from this
# script. A number produced by an ad-hoc grep is not a claim this repo makes.
#
# Trees scanned: .claude packages scripts tests docs .github .meowkit
# Excluded:
#   node_modules, .git            vendored and version-control internals
#   worktrees                     a duplicate checkout of this same tree
#   modules                       provider projections of .claude/. No generator
#                                 produces them — they are mirrors maintained by
#                                 hand, so a dropped name is held to the same
#                                 retention list there by its own test rather
#                                 than by this scan
#   dist, .next                   build output duplicating its own source
#   removed-env-names.ts          generated FROM the classification table, so a
#                                 name's own removal record would otherwise keep
#                                 it in the universe for ever — the same reason
#                                 the table itself lives outside these trees
# Out of scope by rule, because they are not scanned trees: repository-root files
#   (an immutable changelog is historical record) and tasks/ (workflow artefacts).
#
# A match ending in `_` is an interpolation stem, not a name, and is discarded.
#
# The classification table lives at the repository root, outside every scanned
# tree, on purpose: were it inside one, a name's own table row would keep that
# name in the universe forever and a deletion could never be observed.
grep -rhoE '\b(MEOWKIT|MEOW|MK)_[A-Z0-9][A-Z0-9_]*' \
  .claude packages scripts tests docs .github .meowkit 2>/dev/null \
  --binary-files=without-match \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=worktrees --exclude-dir=modules --exclude-dir=dist --exclude-dir=.next \
  --exclude=removed-env-names.ts \
  | grep -vE '_$' | sort -u

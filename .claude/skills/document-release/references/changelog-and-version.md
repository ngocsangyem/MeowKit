# CHANGELOG, version and TODOS

## CHANGELOG: polish wording only

The entry for this change was written by `/mk:ship` from the diff and commit history. It is the record, so this skill never replaces, regenerates, reorders or deletes entries, and never overwrites the file in one write.

1. Read the whole `CHANGELOG.md` first.
2. If it was not modified on this branch, skip the rest.
3. Edit within existing entries only, with exact-match edits.
4. If an entry looks wrong or incomplete, ask the user; do not fix it silently.

Voice: lead with what the user can now do ("You can now ..."), not implementation detail; rewrite any bullet that reads like a commit message; put contributor-only changes under "### For contributors"; use imperative mood. Fix minor wording directly; ask when a rewrite would change meaning.

## Version

A version number is a release decision, so this skill does not bump it. Check consistency only: the latest CHANGELOG version should equal `VERSION`. If `VERSION` was already bumped on this branch, read the CHANGELOG entry for it and the diff, and tell the user when substantial changes are not covered by that entry; they decide whether to give those changes their own version through `mk:ship publish`. Use whatever version format the repo's `VERSION` already uses.

## TODOS.md

Skip if the file does not exist. It complements what the ship step already marked:

1. Open items the diff clearly completes move to the Completed section with `**Completed:** vX.Y.Z (YYYY-MM-DD)`; with no clear evidence, leave them.
2. An item that names files or components the diff changed heavily may be stale: ask whether to update, complete or keep it.
3. `TODO`, `FIXME`, `HACK` and `XXX` comments in the diff that mark meaningful deferred work: ask whether to capture them in TODOS.md.

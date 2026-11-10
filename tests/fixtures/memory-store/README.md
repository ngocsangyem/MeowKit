# Memory-store lint fixture

A realistic, CLEAN team-memory store, committed so `mewkit validate --memory` is exercised
against real content instead of an absent directory.

Why it exists: this repo has no `.meowkit/memory/` of its own, so the CI lint step passed
vacuously — a lint that only ever sees "no store yet" proves nothing about the lint. The CI
step copies this tree into a temp directory, makes it a project root, and lints it.

Keep it clean. A poisoned variant belongs in a test-constructed temp store
(`packages/mewkit/src/core/__tests__/check-memory-store.test.ts`), not here: a committed
injection payload would be read by the documented `grep -rilE` and by anyone grepping the repo.

Keep it above the flood heuristic's 5,000-byte floor. `gotchas.md` carries ~30 extra entries
that share one `Apply when:` and one `Source:` line, the shape a real store grows into; a flood
check that misreads that shape as padding then fails CI here instead of blocking commits in a
user's project.

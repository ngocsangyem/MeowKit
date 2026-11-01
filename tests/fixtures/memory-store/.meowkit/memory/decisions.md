# Decisions

## The memory write path is a locked CLI command, not an agent edit   <!-- 2026-11-01 -->
Why: an agent `Edit` is read-whole then write-whole, so two concurrent appends silently drop
one entry, and no lint can see a missing entry. Every other durable writer in the CLI already
serializes through `withFileLock`; the shared team store was the one gap.
Apply when: adding any second writer to a durable shared file.
Source: packages/mewkit/src/commands/note.ts

## The team store is committed, so the PR diff is the approve gate   <!-- 2026-11-01 -->
Why: v2 gated memory behind a propose/approve workflow and a full-text index that this repo
never used once. Plain markdown in the diff gets the same human review for none of the
machinery — but only while the directory is NOT gitignored, which makes the stale v2 ignore
line a correctness bug rather than a cosmetic one.
Apply when: touching the gitignore template or the state-dir fallback.
Source: packages/mewkit/src/state/resolve-state-dir.ts

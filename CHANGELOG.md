# Changelog

All notable changes to MeowKit are documented here.

See [website changelog](https://docs.meowkit.dev/changelog)

## [Unreleased] — 2026-04-18

### Removed
- Auto-inject memory pipeline (`memory-loader`, `memory-parser`, `memory-filter`, `memory-injector` handlers)
- `NEEDS_CAPTURE` marker system and retroactive capture workflow
- `lessons.md` as active memory store (archived stub; content migrated to topic files)
- `patterns.json` monolith (deprecated stub; replaced by scoped split files)

### Added
- Topic-file memory layout: `fixes.md`, `review-patterns.md`, `architecture-decisions.md`, `security-notes.md`
- Scoped JSON files: `fixes.json`, `review-patterns.json`, `architecture-decisions.json` (schema v2.0.0)
- Vitest test suite for memory subsystem (first tests ever: 36 tests across 6 test files)
- Migration script: `.claude/scripts/memory-topic-file-migrator.cjs` (idempotent, run once)
- `.gitignore` exceptions so topic files and split JSON files are committed as team learnings

### Fixed
- C1: lock-failure fallthrough in `post-session.sh` now exits cleanly
- C2: commit-message privilege escalation removed
- H1: stale-lock false-eviction on `stat` failure fixed
- H2: `findMemoryDir` bounded to 5 levels + sentinel check; accepts optional `startDir` for testability
- H3: `secret-scrub.sh` extended with bearer token, DB URL, email, env-secret patterns
- M1: `cost-log.json` schema aligned to spec (session_id, model, cache token fields added)
- M2: `clearMemory` writes valid v2.0.0 skeleton instead of bare `[]`
- M7: `cost-log.json` write is now atomic (temp-rename)
- M8: `SESSION_ID` validated before use in `sed` pipeline

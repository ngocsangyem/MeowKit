# Changelog

All notable changes to MeowKit are documented here.

See [website changelog](https://docs.meowkit.dev/changelog)

## [2.4.1](https://github.com/ngocsangyem/MeowKit/releases/tag/v2.4.1) (2026-04-18)

### Memory Simplification

**Removed**
- Auto-inject memory pipeline (`memory-loader`, `memory-parser`, `memory-filter`, `memory-injector` handlers) — deleted entirely. Consumer skills now read topic files on demand via their SKILL.md `Read` step.
- `NEEDS_CAPTURE` marker system and retroactive-capture workflow.
- `lessons.md` as active memory store (archived stub; content migrated to topic files).
- `patterns.json` monolith (deprecated stub; replaced by scoped split files).

**Added**
- Topic-file memory layout: `fixes.md`, `review-patterns.md`, `architecture-decisions.md`, `security-notes.md` — each owned by a single consumer skill.
- Scoped JSON files: `fixes.json`, `review-patterns.json`, `architecture-decisions.json` (schema v2.0.0 with `scope` field for cross-file write protection).
- Vitest test suite for the memory subsystem (40 tests — first coverage ever).
- Migration script: `.claude/scripts/memory-topic-file-migrator.cjs` (idempotent; run once per install).

**Fixed (from 15-ID red-team audit)**
- **C1** — lock-failure fallthrough in `post-session.sh` now exits cleanly.
- **C2** — commit-message privilege escalation removed from retroactive capture.
- **C3** — legacy-block body re-injection channel closed by deletion of `memory-parser.cjs`.
- **H1** — stale-lock false-eviction on `stat` failure fixed (safe mtime retry).
- **H2** — `findMemoryDir` bounded to 5 levels + project-root sentinel; exported for testability.
- **H3** — `secret-scrub.sh` extended with bearer tokens, DB URLs, emails, env-secret patterns.
- **M1** — `cost-log.json` schema aligned to spec (`session_id`, `model`, cache token fields).
- **M2** — `clearMemory` writes valid v2.0.0 skeletons instead of bare `[]`.
- **M3** — `---` Markdown HR collision eliminated (parser deleted).
- **M4** — schema versioning activated (each split file declares version + scope).
- **M5** — semantic duplicate `pattern-202604121231` deduplicated into `gnu-grep-bre-macos` during migration.
- **M6** — lexical keyword-to-domain match retired; topic-file retrieval is explicit `Read`, not keyword-filtered.
- **M7** — `cost-log.json` write is atomic (temp-rename via `os.replace`).
- **M8** — `SESSION_ID` format-validated before use in `sed` pipeline.
- **M9** — consolidation hint checks sum of all topic files, not just one.

### Post-Red-Team Hardening

**Fixed (capture-path correctness)**
- **Atomic JSON writes in `immediate-capture-handler.cjs`** — `appendToPatterns` uses temp-rename to match `appendToArchitectureDecisions`; crash mid-write no longer corrupts split JSON files.
- **Unified per-file lock** — both `##decision:` and `##pattern:decision` routes write to `architecture-decisions.json` under the same lock (derived from target path), eliminating the dual-lock race.
- **Secret scrub on capture** — new `lib/secret-scrub.cjs` (JS port of `secret-scrub.sh`) redacts Anthropic, OpenAI, Stripe, AWS, GitHub, GitLab, Slack, JWT, DB URL, Bearer token, email, and private-key patterns before persist.
- **Fresh-install `MEMORY_DIR` guard** — handler now `mkdirSync(..., { recursive: true })` before any lock or file operation, so first-run captures don't silently fail ENOENT.

### Docs

- False `auto-loaded per turn` claim in `docs/project-context.md` corrected — `.claude/memory/` is a MeowKit convention, not Claude Code platform auto-memory.
- 17 website + internal docs + 7 skill/command references updated to describe the topic-file scheme (removed stale `lessons.md` / `patterns.json` / `NEEDS_CAPTURE` instructions).
- Plan/phase internal IDs removed from published docs.
- `.gitignore`: all `.claude/memory/*` content is now ignored; fresh installs get a blank memory directory via `npx mewkit setup`.

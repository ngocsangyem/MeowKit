# Gate 2 Verdict — Phase 6 Interface Layer (wiki CLI / render / skills)

- **Date:** 260629
- **Reviewer provenance:** performed inline by the orchestrator after the delegated `reviewer` subagent failed twice on transient infra errors (watchdog stall, then dropped connection — no verdict produced). Independence is therefore reduced; flagged honestly. All claims below are backed by the cited evidence + the verified-facts run.

## Overall: PASS — no FAIL, no BLOCK, 3 acknowledged WARN

| Dimension | Verdict |
|---|---|
| Correctness | PASS |
| Security | PASS |
| Maintainability | PASS |
| Testing | PASS (WARN-1) |
| Conventions | PASS |

## Evidence by focus area

1. **Render safety — PASS.** `render.ts` escapes `& < > "` via `esc()` and applies it to title, page title, content, and every provenance field (`render.ts:11-17,47-53,61-62`). All interpolation lands in text or `<title>`/`<h1>`/`<h2>`/`<pre>` contexts; the only HTML attribute is the static `class="prov"` (no user data in any single-quoted attribute), so `esc` covering `"` is sufficient. Inline CSS only; no `<script>`, no remote assets. `render.test.ts` asserts no `(src|href)=https?:`, no `<script`, no `@import`, no `url(https?:`, and that `<script>alert(1)</script>` is escaped.

2. **CLI dispatch — PASS.** `case "wiki"` (index.ts) mirrors the `index`/`query` dynamic-import pattern; `mewkit index`/`query` confirmed still working in the smoke run. Adapter construction is confined to `cli.ts buildService` — the interface is the only layer wiring concrete adapters. Advisory exit(0) on the no-`.claude` path; real errors throw.

3. **Context discipline — PASS.** `hint` returns `{title, score, path}` only (cli.ts) — never page content (report §7). `search` prints snippet+provenance+token; both read-only.

4. **Skills + inventory AC — PASS.** 3 SKILL.md files carry valid frontmatter (name/description, keywords 6-8, when_to_use, user-invocable, Gotchas) and `responsibility: project-memory`. `build-inventory.ts:193` reads `meta.responsibility` from skill frontmatter — so this is the correct skill-registration mechanism (NOT registry/`InventoryAdapter`, which would point at non-existent `.claude/` paths and itself cause drift). `mewkit validate` → "Substrate view in sync" (zero drift), Docs references PASS, skill names mk:-scoped PASS.

## WARN (need human acknowledgement at Gate 2)

- **WARN-1 (Testing) — RESOLVED (260629):** added `src/wiki/interface/__tests__/cli.test.ts` — an automated CLI smoke test driving `wikiCommand` through init→reindex→propose→approve→search→render in a temp dir (chdir), plus a `hint`-emits-title/score/path-only-never-content assertion. 2 tests, green; wiki suite now 127.
- **WARN-2 (Scope):** the read-hook is delivered as the tested `mewkit wiki hint` subcommand + the `wiki_retrieval` budget trigger, NOT wired as an always-on `UserPromptSubmit` plugin hook. A global prompt hook is a session-behavior change deferred to downstream opt-in. Defensible — the hint *substance* (title/score/path only) ships and is testable; activation is a config decision.
- **WARN-3 (Inventory mirror):** the wiki skills live in `plugin/skills/` (source); they are tagged `project-memory` and will be counted by the substrate once mirrored to `.claude/skills/` at install/build — consistent with how every other skill works. No drift in the current `.claude/`-based check.

## Recommendation

Route to Phase 7 (acceptance + docs + dead-weight registry) after the human acknowledges WARN-1/2/3. No security re-audit needed (no new external ingress beyond the Phase-5 fetcher, already audited).

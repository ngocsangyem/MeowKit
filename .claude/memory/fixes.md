# Fixes — Session Learnings

> Loaded on-demand by meow:fix. Read this file when diagnosing bugs or after fixing to record patterns.

<!-- migrated-id: L001 -->
## L001 — 2026-04-10 — Skill Scripts Stability Audit (status: live-captured) (2026-04-10, severity: critical)

## 2026-04-10 — Skill Scripts Stability Audit (status: live-captured)

### Key Findings
1. **GNU grep BRE on macOS is systemic** — `\|` and `\+` silently fail on BSD grep. Gate 2 was non-functional on every macOS dev machine. Always use `grep -E` for alternation/quantifiers.
2. **Shell→Python injection via heredoc** — 3 scripts interpolated shell vars into Python `"..."` heredocs. Fix: pass via env vars + single-quoted heredoc, or use `execFileSync` with argv arrays.
3. **execSync with user input = shell injection** — `fetch-chub.js` had 3 injection sites. Single-quote escaping (`shellEscapeSingleQuote`) already existed in the same skill but wasn't applied.
4. **Project root detection must skip skill subdirs** — Skills have their own `.claude/` directories. Use `CLAUDE.md` or `.claude/settings.json` as sentinel instead of `.claude/` dir.
5. **`r.apparent_encoding` crashes after streaming** — Never access `r.apparent_encoding` after `iter_content()`. Use `chardet.detect(raw)` on buffered bytes.
6. **Base64 scanner threshold matters** — {64,} missed all short injection phrases. {20,} + space filter catches them without false-positiving on UUIDs.
7. **Python `ipaddress` flags miss CGN** — `100.64.0.0/10` (RFC 6598) not flagged by `is_private` on Python 3.12. Add explicit network check.

### Process Learnings
- Red team review after fixes caught 1 CRITICAL missed instance (compare-runs.sh had same injection as run-canary.sh) — always search for same-class bugs across codebase.
- Two-batch parallel audit (split 9 scripts into 5+4) was effective for large skill audits.
- ~450k tokens actual vs 328k estimated — security-critical scripts cost 15-20k each, not 8k.

# Deep Mode Scout

> Loaded by `mk:prompt-enhancer` during Step 0 (Mode Selection) and Step 2.5
> (Bounded Scout) — only when `--deep` is active. Default mode never reads this file.

> **Allow-list changes require red-team review.** Re-confirm the skill stays at
> 2/3 of `injection-rules.md` Rule 11 (untrusted input + sensitive data + state
> change). Document any change in this file's header.

## Contents

1. [Purpose](#purpose)
2. [Allow-list](#allow-list)
3. [Forbid-list (default-deny)](#forbid-list-default-deny)
4. [Hard Caps](#hard-caps)
5. [Output Format](#output-format)
6. [Determinism / Eval Pinning](#determinism--eval-pinning)
7. [Fallback Policy](#fallback-policy)
8. [`mk:scout` Invocation Contract](#mkscout-invocation-contract)
9. [Sensitive-data Audit (Failsafe)](#sensitive-data-audit-failsafe)

---

## Purpose

Bounded codebase scout to surface `[FILL-IN]` candidates for the rewritten prompt.

- **Never auto-substitutes.** Suggestions are parenthetical inside `[FILL-IN]` brackets.
- **Never reads sensitive sources.** Default-deny against the forbid-list.
- **Never inlines code bodies.** Output is paths, top-level symbols, 1-line public
  docstring summaries — nothing more.

---

## Allow-list

Read only files matching these patterns. Listed in priority order:

```
docs/project-context.md
docs/*.md
CLAUDE.md
AGENTS.md
*/CLAUDE.md
**/CLAUDE.md
**/AGENTS.md
README.md
*/README.md
**/README.md
package.json
pyproject.toml
Cargo.toml
go.mod
**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,kt,swift,vue}
```

Notes:

- Source extensions mirror `scripts/scout-context.py` `SOURCE_EXTENSIONS` exactly.
  The script is the authoritative reach — the doc must never advertise an
  extension the scanner cannot read. Widening this set requires red-team
  re-confirm per this file's header (the 2/3 Rule-of-Two posture depends on it).
- `package.json` etc. are top-level metadata only — **do not** read lock files
  (`package-lock.json`, `yarn.lock`, `Cargo.lock`, `composer.lock`, `Gemfile.lock`, `pnpm-lock.yaml`).
- Source files (`*.ts`, `*.py`, …) are read for **first 100 lines max** each.
- Allow-list match is by glob; symlinks resolved must still match.

---

## Forbid-list (default-deny)

A file is read **only** if it survives the forbid-list AND matches the allow-list.
Forbid-list is checked first.

```
.meowkit/memory/*
.env
.env.*
tasks/
~/.ssh/
*.pem
*.key
*.keystore
*credentials*
*secret*
node_modules/
.git/
dist/
build/
out/
.next/
.cache/
```

Plus:

- Any file matched by the repo's `.gitignore` (the scout invokes `git
check-ignore` to verify).
- Anything matched by `injection-rules.md` Rule 4 (sensitive file protection).

If a path matches the forbid-list AND the allow-list, **forbid wins**. Default-deny.

---

## Hard Caps

| Cap              | Limit | On exceed                                                     |
| ---------------- | ----- | ------------------------------------------------------------- |
| Files read total | ≤ 8   | Stop scouting; return collected hits + `abort_reason` if zero |
| Lines per file   | ≤ 100 | Truncate; symbol extraction may miss content past line 100    |
| Wall clock       | ≤ 30s | Abort with `abort_reason: "SCOUT_BUDGET_EXCEEDED"`            |

When `SCOUT_BUDGET_EXCEEDED` fires:

- The skill falls back to default mode for the remainder of this run.
- A one-line note appears in the output: "Deep-mode scout exceeded budget (8
  files / 100 lines / 30s). Falling back to default."
- The user may re-run with smaller scope or address `[FILL-IN]` placeholders manually.

---

## Output Format

For each scout hit, emit a structured record:

```json
{
	"path": "src/api/products.ts",
	"symbols": ["productHandler", "GET", "ProductPayload"],
	"summary": "REST handler for /api/products list + detail"
}
```

Rules:

- `path` uses forward slashes (relative to git root).
- `symbols` are top-level declarations only — function names, class names,
  exported types. No imports, no inlined values.
- `summary` is the first non-empty line of a public docstring (top-of-file or
  top-of-symbol comment), truncated at 80 chars. If absent, omit `summary`.
- **Never** include the file body, statement bodies, or string literals.

The skill renders these as `[FILL-IN: <description> (suggested: <path-or-symbol>)]`
inside the rewritten prompt's `## 4. Enhanced Prompt` section.

---

## Determinism / Eval Pinning

The scout records `git rev-parse HEAD` at run start and emits it as the output
footer:

```
> Deep-mode footer: codebase snapshot `<git-sha>`; docs/project-context.md last
> updated `<YYYY-MM-DD>`.
```

The Phase-5 eval rubric checks this matches the baseline ref. Mismatch →
`STALE_BASELINE` warning; eval refuses to score until the baseline is refreshed.

`docs/project-context.md` last-updated date is checked separately — if >90 days
old, the footer carries an additional note: "context may be stale; re-run
`mk:project-context`".

---

## Fallback Policy

`--deep` aborts gracefully (does NOT silently fall through to forbidden sources)
when:

| Condition                               | `abort_reason`             | Behavior                                                             |
| --------------------------------------- | -------------------------- | -------------------------------------------------------------------- |
| Not in a git repo                       | `NO_GIT_REPO`              | Run as default mode + one-line note                                  |
| `MEOWKIT_AUTOBUILD_MODE=MINIMAL`          | `MINIMAL_DENSITY`          | Downgrade to default + one-line note (per `harness-rules.md` Rule 3) |
| Allow-list returns zero matches         | `NO_MATCHES`               | Run as default + one-line note "no codebase context found"           |
| Time/file/line caps exceeded            | `SCOUT_BUDGET_EXCEEDED`    | Use partial hits if any; otherwise fall back to default              |
| Forbid-list violation detected post-hoc | `SCOUT_BOUNDARY_VIOLATION` | Refuse to save output; emit error                                    |

In all fallback cases, the skill **never** silently reads forbidden files. The
default-deny posture is preserved.

---

## `mk:scout` Invocation Contract

The enhancer calls `mk:scout` with:

- The keyword set extracted from the input prompt (action verbs + nouns from the
  Goal/Context decomposition).
- The glob filter from this file's [Allow-list](#allow-list).

Then post-filters the result through this allow-list AND forbid-list.

**`scripts/scout-context.py` is a bounded hint scanner, not a `mk:scout`
replacement.** It is the fallback hint source used when a full `mk:scout`
invocation is unavailable or over-budget; it performs the same
allow/forbid-filtered, capped walk and inherits this file's allow-list,
forbid-list, and hard caps. When `mk:scout` is available and within budget,
prefer it and post-filter its result through the same lists. Either path
surfaces identifier-only hits — neither broadens the reach beyond the contract
above. The enhancer remains a *consumer* of bounded discovery, never a broad
codebase mapper (that is `mk:scout`'s own job).

---

## Sensitive-data Audit (Failsafe)

When the output is saved, the saver runs a final scan:

1. Search the saved file for any path matching the forbid-list.
2. Search the saved file for `.meowkit/memory/`, `.env`, secrets, credentials.
3. If any match → write `SCOUT_BOUNDARY_VIOLATION` and refuse to save. Emit:
   "Refusing to save — scout output contains forbid-list reference."

This failsafe is defensive — it should never trigger if the allow-list is
enforced upstream. If it does trigger, treat it as a critical bug in the scout
and file an incident.

The audit is also part of the canary suite (canary #9, deep-mode boundary test):

- Saved output grep: zero matches for `.env`, `.meowkit/memory/*`.
- Transcript audit: zero `Read` tool calls against forbidden paths.
- Both must pass for the boundary canary to PASS.

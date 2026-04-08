# Build-Verify Commands — Per-Language Lookup

Reference table for `post-write-build-verify.sh`. Maps file extension → compile/lint commands.

## Resolution Rules (per Phase 7 red-team P19)

1. **Per-file by extension.** The hook classifies each edited file by its extension and looks up the command set in the table below.
2. **Multi-language repos are fine.** A repo with both `package.json` and `pyproject.toml` gets TypeScript treatment for `.ts` files and Python treatment for `.py` files. No global ordering matters.
3. **Multiple commands per extension run sequentially.** First non-zero exit short-circuits and emits combined error output.
4. **Unknown extension → silent skip.** Exit 0 with a debug log to stderr only. NEVER print fake "passed" messages — that feeds false positive to the agent.
5. **Tool absence → silent skip with warning.** If `tsc` / `ruff` / `cargo` / etc. is not on PATH, log a stderr warning and exit 0. The agent should not see a false failure.

## Language Table

| Extension | Commands (in order) | Tool Detection | Timeout |
|---|---|---|---|
| `.ts`, `.tsx` | `tsc --noEmit` → `eslint` | `command -v tsc`, `command -v eslint` | 30s |
| `.js`, `.jsx`, `.mjs`, `.cjs` | `eslint` | `command -v eslint` | 15s |
| `.vue` | `eslint` + optional `vue-tsc --noEmit` | `command -v eslint`, `command -v vue-tsc` | 30s |
| `.svelte` | `svelte-check` | `command -v svelte-check` | 30s |
| `.py` | `ruff check` → `mypy` | `command -v ruff`, `command -v mypy` | 30s |
| `.go` | `go build ./...` | `command -v go` | 30s |
| `.rs` | `cargo check` | `command -v cargo` | 60s |
| `.java` | `javac -d /tmp -Xlint:all` | `command -v javac` | 30s |
| `.swift` | `swiftc -parse` | `command -v swiftc` | 30s |
| `.kt` | `kotlinc -script` | `command -v kotlinc` | 60s |
| `.rb` | `ruby -c` → `rubocop` | `command -v ruby`, `command -v rubocop` | 20s |
| `.cs` | `dotnet build --no-restore` | `command -v dotnet` | 60s |
| Other | (skip silently) | — | — |

## Skipped Paths

Files under these paths are ALWAYS skipped regardless of extension:

- `node_modules/`, `.venv/`, `venv/`, `vendor/`, `target/`, `dist/`, `build/`, `.next/`, `out/`
- `*.min.js`, `*.map`, `*.lock`, `*lock.json`
- `tasks/`, `docs/`, `.claude/`, `plans/` — meowkit working directories, not source code
- `*.test.*`, `*.spec.*`, `*/__tests__/*` — tests should run as tests, not build-verify

## Cache

The hook hashes each file's content and stores the hash in `session-state/build-verify-cache.json`. If a file is edited and its hash is unchanged from the last build-verify run, the hook skips re-running the command (cached PASS).

**Cache invalidation:** the cache is per-session. `session-state/` is cleared on new sessions. To force re-run, delete `session-state/build-verify-cache.json`.

## Environment Variables

| Var | Default | Purpose |
|---|---|---|
| `MEOWKIT_BUILD_VERIFY` | `on` | Set to `off` to skip the hook entirely |
| `MEOWKIT_BUILD_VERIFY_TIMEOUT` | (per-language) | Override timeout in seconds |
| `MEOWKIT_BUILD_VERIFY_DEBUG` | (unset) | Set to `1` for verbose stderr logging |

## Output Format

When a command fails, the hook emits a structured block to stdout (Claude Code picks this up and injects into the next turn):

```
@@BUILD_VERIFY_ERROR@@
file: src/foo.ts
command: tsc --noEmit
exit_code: 2

src/foo.ts:12:5 - error TS2322: Type 'string' is not assignable to type 'number'.

12     const count: number = "oops"
           ~~~~~
@@END_BUILD_VERIFY@@
```

The `@@BUILD_VERIFY_ERROR@@` marker lets the agent parse and prioritize compile errors over other context.

## Why Per-File and Not Project-Wide

Running `tsc --noEmit` on the whole project after every single file edit would take 30+ seconds on a real codebase. Per-file checking is imperfect (TypeScript can't fully type-check a file in isolation) but it catches 80% of errors in under 5 seconds. Full project typecheck is a user-triggered `meow:verify` concern, not an automatic middleware concern.

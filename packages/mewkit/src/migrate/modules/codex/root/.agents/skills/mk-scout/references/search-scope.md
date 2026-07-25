# Search Scope — 3-Tier Directory Rules

Load this reference during **Step 3** of the scout process when applying scope rules to determine which directories each Explore agent should search.

## Tier 1 — ALWAYS scan (high signal, low cost)

These directories contain the implementation and are always worth searching:

- `src/`, `lib/`, `app/`, `api/`, `packages/`
- `config/`, `types/`, `interfaces/`
- Root config files: `package.json`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`

**Rule:** Every scout run includes Tier 1. No exceptions.

## Tier 2 — SCAN ON REQUEST (medium cost, task-dependent)

Scan these only when the search target relates to testing, docs, infra, or CI:

- `tests/`, `__tests__/`, `spec/`, `e2e/`
- `docs/`, `scripts/`, `tools/`, `infra/`
- `migrations/`, `seeds/`, `fixtures/`
- `.github/`, `.gitlab/`, `ci/`

**Rule:** Include Tier 2 when the user's query mentions tests, docs, CI, migrations, or infrastructure. Otherwise skip — saves an agent slot for higher-signal work.

**Examples that trigger Tier 2:**
- "find auth tests" → include `tests/`, `__tests__/`
- "where are our migration files" → include `migrations/`
- "search CI config" → include `.github/`, `ci/`

## Tier 3 — NEVER scan (noise, always excluded)

These directories are generated, vendored, or binary — zero signal per token.

**Exclude regardless of task. No exceptions.**

**Package managers / vendored:**
- `node_modules/`, `vendor/`, `.pnpm-store/`

**Build output / generated:**
- `dist/`, `build/`, `.next/`, `.nuxt/`, `.output/`, `.svelte-kit/`
- `coverage/`, `.cache/`, `.turbo/`, `.vercel/`, `.terraform/`

**Python virtual environments:**
- `__pycache__/`, `.venv/`, `venv/`, `.tox/`, `.mypy_cache/`

**Version control:**
- `.git/`

**Generated files:**
- `*.min.js`, `*.min.css`, `*.map`, `*.lock` (content, not existence)

**Binary assets:**
- Images (`.png`, `.jpg`, `.gif`, `.svg`, `.ico`)
- Fonts (`.woff`, `.woff2`, `.ttf`, `.otf`)
- Compiled (`.wasm`, `.so`, `.dylib`, `.dll`, `.exe`)

**WHY:** Anthropic's context engineering research: "context must be treated as a finite resource with diminishing marginal returns." Every token spent on Tier 3 content is a token unavailable for actual code understanding. A single `node_modules/` scan can consume an Explore agent's entire 200K context window with zero useful information.

## Applying Tiers in Practice

When dividing directories in Step 4:

```
1. List all top-level directories: ls -d */ 2>/dev/null
2. Remove any Tier 3 matches from the list
3. Include all Tier 1 matches
4. Include Tier 2 matches ONLY if task keywords match
5. Assign remaining directories to agents
```

If a directory doesn't appear in any tier (e.g., a custom `scripts/` or `playground/`), treat it as Tier 2 — scan if potentially relevant, skip if not.

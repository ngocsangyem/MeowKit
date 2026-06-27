# Project Standards

These are the rulekit's **recommended default** Vue conventions — recommended, not mandatory.
Detect the project's actual dependencies (read `package.json`) before applying any stack-specific
guidance; do not force this stack onto a project that uses different tools.

## Stack (recommended default)

Vue 3, TypeScript, TailwindCSS v4, Vue Router, Pinia, Pinia Colada. Swap any layer for the project's
actual choice when it differs.

## Conventions

- Composition API + `<script setup lang="ts">` only — never the Options API.
- `type` over `interface` for object/prop shapes; keep types alongside the code.
- TailwindCSS classes, not manual CSS; never hard-code colors — use the Tailwind color system.
- Arrow functions for methods and callbacks.
- Named exports over default exports — except composables, which use `export default`.
- Keep unit/integration tests alongside the file they test: `Button.vue` + `Button.spec.ts`.
- Only meaningful comments that explain *why*, not *what*.

## Project Structure

```
public/            # static files served as-is (favicon, robots.txt)
src/
├── api/           # individual functions that fetch data
├── components/    # reusable components (ui/, layout/, features/)
├── composables/   # composition functions (use*)
├── stores/        # Pinia stores for global state (NOT data fetching)
├── queries/       # Pinia Colada queries for data fetching
├── mutations/     # Pinia Colada mutations
├── pages/         # page components (file-based routing)
├── plugins/       # Vue plugins
├── utils/         # pure utility functions
├── assets/        # Vite-processed assets (e.g. CSS)
├── main.ts        # app entry: plugins + mount
├── App.vue        # root component
└── router/        # Vue Router configuration
```

## Commands

Use the project's lockfile-appropriate package manager (the rulekit default is `pnpm`):

- `pnpm run build` — production bundle.
- `pnpm run test` — run all tests.
- `pnpm vitest run <test-files>` — run specific test files (add `--coverage` for coverage).

## Testing

Do not restate testing workflow here — use the meowkit testing skills:

- `mk:testing` for writing/running tests and the red-green-refactor cycle.
- `mk:qa` / `mk:qa-manual` for browser-driven QA like a real user.

A dev server is typically already running with HMR; do not launch a duplicate one.

## Research & Documentation

- NEVER hallucinate or guess URLs.
- Try the library's `llms.txt` first (e.g. `https://pinia-colada.esm.dev/llms.txt`,
  `https://router.vuejs.org/llms.txt`); follow links in its table of contents.
- Verify examples and patterns from docs before using them.
- The meowkit-native retrieval path is `mk:docs-finder` (Context7 → Context Hub → web) — prefer it
  for any library/API lookup over relying on training data.

## Owned Elsewhere (pointers, not restated)

Git workflow, conventional commits, secret handling, and security blocks are owned by the meowkit
rules (`security-rules.md`, `development-rules.md`, `injection-rules.md`) — follow those rather than
duplicating them here, so the guidance does not drift.

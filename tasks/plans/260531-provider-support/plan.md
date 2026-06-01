# Provider support introspection plan

## Goal

Make MeowKit’s actual supported-tool matrix visible from the CLI, based on the effective provider registry inside `packages/mewkit`, without adding any `.meowkit/` folder or new generated project surface.

## Scout summary

- Project type: TypeScript/Node CLI package in `packages/mewkit`.
- Existing provider architecture: `src/migrate/providers/*` manifests + contracts, composed by `src/migrate/providers/index.ts`.
- Existing diagnostics: `src/migrate/provider-contract-diagnostics.ts` compares raw vs effective provider surfaces.
- Existing CLI pattern: commands live in `src/commands/*`, routed by `src/index.ts`.
- Existing tests: provider registry/contract tests already cover documented-surface filtering.

## Implementation slice

1. Add an internal provider support summary module under `packages/mewkit/src/migrate/`.
2. Add a new CLI command:
   - `mewkit providers`
   - `mewkit providers --json`
   - `mewkit providers <provider>`
   - `mewkit explain-support <provider>` as an alias if low-risk in current routing.
3. Output should distinguish:
   - known provider
   - support level: verified / experimental / deprecated
   - effective enabled surfaces after contract filtering
   - disabled/unsupported surfaces
   - practical harness role: full, hard-gate candidate, procedure, policy/advisory, config-only, disabled/deprecated
   - enforcement summary: hard / advisory / unsupported where derivable from enabled hooks/rules/config.
4. Keep everything inside `packages/mewkit`; do not add `.meowkit/` or extra project-generated files.
5. Add tests for:
   - provider count and support-level summary
   - disabled providers (`roo`, `kilo`, `openhands`) classified honestly
   - Codex identified as a hook-capable hard-gate candidate
   - Cursor/Antigravity identified as advisory policy projections
   - JSON output shape if practical without brittle CLI snapshots.

## Out of scope for this slice

- Do not implement provider projection validation yet.
- Do not change provider contracts or claim new surfaces.
- Do not change `npx mewkit init` generated outputs.
- Do not add `.meowkit/` to user projects.
- Do not bulk-annotate all skills for portability.

## Acceptance criteria

- `npm run typecheck` passes.
- Relevant Vitest tests pass.
- `npm run lint` passes or any failure is documented with exact cause.
- `node packages/mewkit/dist/index.js providers` prints the real effective support matrix after build.
- `node packages/mewkit/dist/index.js providers --json` emits parseable JSON.
- Existing `mewkit validate --portable` behavior is unchanged.

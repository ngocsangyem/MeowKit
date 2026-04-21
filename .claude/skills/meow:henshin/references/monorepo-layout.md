# Monorepo Layout

Canonical tree for `--both` mode (Node / TypeScript). Adapt paths for other ecosystems; the shared-core / thin-adapter shape is the invariant.

## Contents

- [`--both` tree](#both-tree)
- [Single-surface variants](#single-surface-variants)
- [`packages/core/package.json`](#packagescorepackagejson)
- [`packages/cli/package.json`](#packagesclipackagejson)
- [`packages/mcp/package.json`](#packagesmcppackagejson)
- [Root `package.json`](#root-packagejson)
- [Core / adapter boundary (non-negotiable)](#core-adapter-boundary-non-negotiable)
- [CI workflow outline (`.github/workflows/ci.yml`)](#ci-workflow-outline-githubworkflowsciyml)
- [Release workflow outline (`.github/workflows/release.yml`)](#release-workflow-outline-githubworkflowsreleaseyml)
- [Gotchas](#gotchas)


Load during Phase 5 (Transformation Spec) so the plan captures the exact tree `/meow:cook` will scaffold.

## `--both` tree

```
.
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── capabilities/       # one file per capability
│   │   │   ├── config/             # config schema + loader
│   │   │   ├── errors.ts           # typed error classes
│   │   │   └── index.ts            # public exports
│   │   ├── test/
│   │   ├── package.json            # private: true (not published)
│   │   └── tsconfig.json
│   ├── cli/
│   │   ├── src/
│   │   │   ├── commands/           # one file per command
│   │   │   ├── credentials.ts      # 6-tier resolution chain
│   │   │   ├── formatter.ts        # json + text renderers
│   │   │   └── bin.ts              # #!/usr/bin/env node entry
│   │   ├── test/
│   │   ├── package.json            # bin, files, engines, publishConfig
│   │   └── tsconfig.json
│   └── mcp/
│       ├── src/
│       │   ├── tools/              # one file per tool
│       │   ├── transports/
│       │   │   ├── stdio.ts
│       │   │   ├── sse.ts
│       │   │   └── streamable-http.ts
│       │   ├── auth.ts
│       │   └── server.ts           # transport-agnostic server factory
│       ├── test/
│       ├── package.json
│       ├── wrangler.toml           # Cloudflare Workers
│       ├── Dockerfile
│       └── tsconfig.json
├── .claude/skills/<tool-name>/     # companion skill (staged for the kit marketplace)
├── docs/
│   ├── cli.md
│   ├── mcp.md
│   ├── architecture.md
│   └── contributing.md
├── scripts/
├── .github/workflows/
│   ├── ci.yml                      # test + typecheck + lint on push/PR
│   └── release.yml                 # tag-triggered publish
├── package.json                    # pnpm/npm workspaces
├── tsconfig.base.json
└── README.md
```

## Single-surface variants

`--mcp` only: drop `packages/cli/`, keep `packages/core/` (future CLI can be added without reshape).
`--cli` only: drop `packages/mcp/`, keep `packages/core/`.

Core is **always** its own package, even when only one surface ships. Moving code out of an adapter later is 10× harder than splitting up front.

## `packages/core/package.json`

```json
{
  "name": "@<org>/<tool>-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  }
}
```

Core is private (`private: true`) — never published. Adapters depend on it via workspace protocol.

## `packages/cli/package.json`

```json
{
  "name": "<tool>",
  "version": "0.1.0",
  "type": "module",
  "bin": { "<tool>": "./dist/bin.js" },
  "files": ["dist"],
  "engines": { "node": ">=20" },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "prepublishOnly": "npm run build && npm test"
  },
  "dependencies": {
    "@<org>/<tool>-core": "workspace:*",
    "commander": "^14.0.0"
  }
}
```

- `provenance: true` publishes npm attestations (supply-chain hardening)
- `prepublishOnly` enforces clean build + tests before every release
- **No `postinstall` scripts** — they break in restricted environments and are a common supply-chain attack vector

## `packages/mcp/package.json`

```json
{
  "name": "@<org>/<tool>-mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": { "<tool>-mcp": "./dist/bin.js" },
  "files": ["dist"],
  "engines": { "node": ">=20" },
  "publishConfig": { "access": "public", "provenance": true },
  "dependencies": {
    "@<org>/<tool>-core": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

## Root `package.json`

```json
{
  "name": "<tool>-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build":     "npm run -ws build",
    "test":      "npm run -ws test",
    "typecheck": "tsc --noEmit -p tsconfig.base.json",
    "lint":      "eslint packages/*/src/**/*.ts"
  }
}
```

## Core / adapter boundary (non-negotiable)

- `core/` imports nothing CLI-specific (no `commander`, no `process.argv`) and nothing MCP-specific (no `@modelcontextprotocol/sdk`)
- `cli/` and `mcp/` import from `@<org>/<tool>-core` only
- Every capability is a plain function: `run(params) → result`. The adapter's only job is argument parsing + output shaping

If a change requires editing both adapters, the boundary is leaking — move the shared part into core.

## CI workflow outline (`.github/workflows/ci.yml`)

- Node LTS matrix (`20`, `22`)
- OS matrix for CLI tests (Linux, macOS, Windows)
- Cache pnpm/npm store
- Order: install → typecheck → lint → test
- Upload coverage on main branch only

## Release workflow outline (`.github/workflows/release.yml`)

Tag-triggered (`v*`):

1. Build + test + typecheck
2. `npm publish --provenance` for `cli/` and `mcp/`
3. `docker build` + push to GHCR (`ghcr.io/<org>/<tool>-mcp:<tag>`)
4. Deploy MCP to Cloudflare via `wrangler deploy` (only on `main` branch tags)

## Gotchas

- **`packages/core/` as public (published) is a trap.** It exposes internal types and becomes a reverse-compatibility burden. Keep it private; adapters are the public surface.
- **`postinstall` scripts run on every install.** They are a supply-chain risk and frequently break in CI / restricted networks. If a build step is needed, use `prepare` (runs once after install + before publish) or `prepublishOnly` (runs once before publish). Never `postinstall`.
- **Adapters importing each other is the first sign of rot.** CLI should never import from MCP and vice versa. Any shared logic moves to core or a separate `packages/shared/`.
- **`provenance: true` needs npm 9.5+ and GitHub Actions for OIDC.** Publishing from a laptop drops the attestation silently. Document this and fail the release workflow if provenance is missing.
- **Workspace protocol (`workspace:*`) must be replaced on publish.** Most package managers do this automatically; verify by inspecting `npm pack --dry-run` output before first release.
- **One file per capability in `core/capabilities/` scales better than one big module.** Glob imports from `capabilities/*` keep `index.ts` clean and make tree-shaking work.
# Monorepo layout

What the transformation spec states for `--both` mode (Node and TypeScript shown; adapt for other ecosystems). The shared-core and thin-adapter shape is the invariant. The spec names the layout and the decisions; the downstream plan writes the configuration and code, and checks current tool versions when it does.

## Contents

- [Layout](#layout)
- [Single-surface variants](#single-surface-variants)
- [Package decisions](#package-decisions)
- [Core and adapter boundary](#core-and-adapter-boundary)
- [CI and release](#ci-and-release)
- [Gotchas](#gotchas)

## Layout

| Path | Holds |
|---|---|
| `packages/core/` | One module per capability, config schema and loader, typed errors, public exports, tests. Private (never published) |
| `packages/cli/` | One file per command, the credential resolution chain, text and JSON renderers, the executable entry, tests. Published |
| `packages/mcp/` | One file per tool, the transport adapters, auth, a transport-agnostic server factory, deployment config for each chosen target, tests. Published |
| companion skill directory | A skill that teaches the workflow, when the approved scope includes one |
| `docs/` | CLI usage, MCP usage, architecture, contributing |
| `.github/workflows/` | CI (test, typecheck, lint on push and PR) and a tag-triggered release |
| root | Workspace config, a base compiler config, README |

## Single-surface variants

`--mcp` only: drop the CLI package, keep core. `--cli` only: drop the MCP package, keep core. Core is always its own package, even when only one surface ships, because moving code out of an adapter later is much harder than splitting up front.

## Package decisions

- Core is private; adapters depend on it through the workspace protocol.
- The CLI and MCP packages declare their executable entry, the files they publish, the minimum runtime, and publish with provenance attestations (supply-chain hardening).
- No install-time scripts (`postinstall`): they break in restricted environments and are a common supply-chain vector. A pre-publish script runs a clean build and the tests before every release.
- Package name, scope, license and ownership are the user's decisions, never defaulted.

## Core and adapter boundary

Non-negotiable:

- Core imports nothing CLI-specific (no argument parser, no `process.argv`) and nothing MCP-specific (no MCP SDK).
- The CLI and MCP packages import from core only, never from each other.
- Every capability is a plain function from parameters to a result; an adapter's only job is argument parsing and output shaping.

If a change needs edits in both adapters, the boundary is leaking: move the shared part into core.

## CI and release

- CI: a runtime-version matrix and, for the CLI, an OS matrix; order install, typecheck, lint, test; upload coverage on the main branch only.
- Release on a version tag: build, test, typecheck; publish the CLI and MCP packages with provenance; build and push a container image if the MCP target is a container; deploy the MCP package to the chosen platform only from the main branch's tags.

## Gotchas

- Publishing core is a trap: it exposes internal types and becomes a compatibility burden.
- Adapters importing each other is the first sign of rot; shared logic moves to core.
- Provenance needs a recent package manager and a CI identity provider; publishing from a laptop drops the attestation silently, so the release workflow should fail rather than skip it.
- The workspace protocol must be replaced on publish. Most package managers do it; verify with a dry-run pack before the first release.

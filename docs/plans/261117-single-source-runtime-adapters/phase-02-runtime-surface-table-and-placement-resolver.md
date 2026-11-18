# Phase 2 — Runtime surface table and placement resolver

**Priority:** high · **Status:** not started · **Effort:** 3d · **Depends on:** 1

## Overview

Put "which runtime loads which path" in one data table, and compute from it, for any set of installed runtimes, where each kind of content is written so that every runtime sees it once.

## Key insights

- Placement is a function of the set, not of one runtime: with Claude Code present, Cursor and Grok already receive its hooks; without it, `.cursor/hooks.json` serves both.
- The current `EmitRequest.other_scope` already hints at cross-runtime awareness; the resolver replaces ad-hoc handling such as `ship-run-once`.

## Architecture

```
surface table (data, cited)          installed set + requested set
        └──────────────┬──────────────────────┘
                 placement resolver  (pure, no I/O)
                       │  Placement { kind → root, dialect, readers }
        ┌──────────────┼───────────────┐
   emitter A       emitter B       emitter C      → Plan → shared executor
```

- **Surface table:** per runtime and content kind (skills, agents, rules, context file, hooks, MCP): native roots, foreign roots read, precedence, dedupe rule, project-level switch, source URL or probe row, version, date.
- **Resolver output:** for each kind, the roots to write, the dialect (host or shared), which runtimes read each root, and switches to set (for example OMP `disabledProviders`).
- **Invariant checked in tests:** for every non-empty subset of the six runtimes and every kind, each runtime's readable roots contain each item exactly once, or the item is identical bytes where the table says identical copies collapse.

## Related files

- Create: `crates/mewkit-adapters/src/surface_table.rs`, `surface_table.json` (data), `placement_resolver.rs`, `placement_resolver_tests.rs`
- Modify: `crates/mewkit-adapters/src/contract.rs` (`Runtime` gains `Grok`, `Pi`, `Omp`; `EmitRequest` gains `placement`), `registry.rs`
- Create: `docs/maintainer/runtime-surface-table.md` (rendered from the data, with sources)

## Steps

1. Encode research §1 as data; every cell carries its source.
2. Write the resolver for skills first, then hooks, rules and context, MCP, agents.
3. Property test over all 63 subsets; table-driven cases for the pairs known to overlap (Claude Code + Cursor, Cursor + Grok, Codex + Pi + OMP).
4. Render the maintainer doc from the data and add a test that the doc is current.

## Todo

- [ ] Data table with sources
- [ ] Resolver per content kind
- [ ] 63-subset invariant test
- [ ] Rendered doc and its freshness test

## Success criteria

- `cargo test -p mewkit-adapters placement` passes with the invariant on all subsets.
- No emitter reads another runtime's presence directly; it reads the placement.

## Risks

- Unknown dedupe (Cursor, Grok) → the resolver treats "ND" as "no dedupe".

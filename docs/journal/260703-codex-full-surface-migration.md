# Codex full-surface migration — fence-aware reference rewriting

Date: 2026-07-03
Scope: `packages/mewkit/src/migrate/` (+ CLI flags, README, website/migration.md)

## What changed

- New `references/` layer: a registry-derived rewrite table (single source of truth
  for `.claude/<type>/…` → provider target paths), a markdown span tokenizer
  (frontmatter / fenced / inline-code / prose + citation detection), and a
  fence-aware rewriter that emits a `ReferenceOccurrence` for every decision.
- `direct-copy`'s blanket `.claude/` → `<providerDir>/` replace is gone — it
  fabricated paths that don't exist on the target (e.g. `.codex/scripts/…`).
  Runnable content is now rewritten only with proof: the referenced asset must be
  part of the same migration AND the target must keep the file suffix.
- Codex surfaces brought to current conventions (verified against live docs):
  commands re-enabled as Agent Skills (`.agents/skills/source-command-<name>/SKILL.md`,
  dynamic syntax kept verbatim + warned), rules merged into `AGENTS.md` under the
  32 KiB `project_doc_max_bytes` budget (warn, never truncate), hooks capability
  table extended with the 10-event v0.142 entry (hooks now enabled by default),
  `.mcp.json` → `[mcp_servers]` behind `--include-mcp`, `--all-rules` opt-in.
- Validation layer: an in-memory pre-install conversion pass feeds new preflight
  report sections (preserved refs with file:line, conversion notes, budget
  projection) and an unresolved-reference scanner aborts before install if any
  source reference survives without a classifier decision.
- Branding: generated files carry zero toolkit strings — provenance header
  removed, sentinels neutralized (legacy branded sentinels still stripped on
  re-run), hook-wrapper header neutralized, project-scope lock directory removed
  on release.

## Decisions worth remembering

- **Never rewrite on uncertainty.** Fenced refs to merged/non-directory targets
  (codex agents TOML, rules-in-AGENTS.md) stay preserved even with migration
  proof, because the rewrite would drop the filename — a different fabrication.
- **Inline unmapped refs keep the historical neutralization** ("project runtime
  data/…") instead of the plan's preserve+warn, to keep the existing
  runtime-portability contract (and its tests) intact; fences are where
  preservation matters.
- **The runtime-compat audits had to become occurrence-aware.** They encoded the
  old "zero `.claude` refs" contract and would have failed every migration once
  the classifier deliberately preserved references. The blocking invariant moved
  to the scanner (unexplained refs only).
- **Reconciler upgrade semantics already existed**: the registry's
  `sourceChecksum` records the CONVERTED output checksum, so conversion-output
  changes reconcile as clean updates, not user conflicts (covered by the new
  upgrade-path e2e).

- **Command→skill slugs must be injective.** Review caught that mapping both
  "/" and "-" to "-" let `mk/fix` and `mk-fix` share one install directory
  (silent overwrite). Fixed by hyphen-doubling before the separator mapping.

## Verification

- 40 test files / 260 tests green in `src/migrate` (+ validate.test); typecheck,
  `build:cli`, `tokens:check`, `no-direct-io` clean.
- Pre-existing, unrelated failures confirmed identical on clean HEAD: orchviz CSS
  color lint, wiki/* + derived-index/hook-runner/pack-resolver (native deps),
  doctor-hard-gates + check-packs/context-budget live-harness probes.

## Open

- Upstream sync policy for the vendored claudekit-cli fork (drift is now larger).
- Codex skills→plugins transition: all Codex paths flow through the provider
  config + capability table, so a surface move is a single-point change.

# Branding Style Guide

Single-page reference for what stays branded ("MeowKit", "Claude Code", "Anthropic") versus what gets neutralized to runtime-agnostic prose. Enforced by `.claude/scripts/lint-brand-prose.sh` on every PR that touches `meowkit/.claude/**/*.md`.

## Where brand lives

Brand prose belongs at the **repo level**, not inside the runtime markdown:

- `README.md`
- `CHANGELOG.md`
- `package.json`
- `website/**`
- `docs/branding-*`
- `assets/**`

Brand does **not** belong in `.claude/` markdown body text. Converters substitute target-aware names at `mewkit migrate` time; source must use neutral terms for that to work.

## Allowed in runtime markdown text

- **"the toolkit"** / **"this toolkit"** / **"the kit"** — product self-reference
- **"the host runtime"** / **"the coding agent"** — runtime self-reference
- **"On Claude Code, ..."** factual prefix — for runtime-specific behavioral claims that need to stay accurate. Converters still rewrite the literal "Claude Code" to the target name on migrate, but the factual scoping survives because it's structural prose.

Do **not** wrap runtime-specific claims in `> **On Claude Code:** ...` blockquote callouts. No converter strips that wrapper, so migrated output regresses to brand prose.

## KEPT as identifiers (not banned)

These are operational tokens, not prose:

- `mewkit` / `npx mewkit ...` — CLI commands
- `mk:` — skill namespace prefix
- `MEOW_*` / `MEOWKIT_*` — env var names
- `$CLAUDE_PROJECT_DIR`, `${CLAUDE_PLUGIN_DATA}`, hook event names, tool names — runtime-injected APIs

The lint excludes backtick-wrapped tokens automatically, so `` `Claude Code` `` as an identifier reference passes. Bare narrative `Claude Code` does not.

## Allowed in research citations

Verbatim brand prose stays in research provenance:

- "Anthropic harness research"
- "Anthropic field report"
- "dead-weight thesis"

Pair every Anthropic citation with one of:

1. The HTML comment `<!-- research-citation -->` on the line above the citation
2. A "research", "thesis", or "field report" keyword within ±2 lines
3. A blockquote prefix (`> Anthropic...`)

The lint and the migrate converter both honor these markers.

## Banned in markdown narrative prose

- **"MeowKit"** in skill / agent / rule body prose. Use "the toolkit".
- **"Claude Code"** in attribution, section headers, or behavioral-claim sentences. Use "the host runtime" or the "On Claude Code, ..." factual prefix.
- **"Anthropic"** in non-citation attribution like "per Anthropic's documented behavior". Use "per the runtime's plugin contract".
- **"claude-code"** lowercase URL-slug form in narrative. Covered by the same lint.

## Why these rules

Phase 1 of the brand-prose plan added narrative substitution to `packages/mewkit/src/migrate/converters/md-strip.ts`. At `mewkit migrate codex|kiro|cursor` time, the converter rewrites brand prose into the target's display name. For that pipeline to produce clean output:

1. Source must use neutral terms — converters can't substitute words that aren't there.
2. Identifiers stay verbatim — converters route them per-target by their own path-rewrite rules, not by string substitution.
3. Citations stay verbatim — academic provenance is data, not branding.

## Before / after examples

### "MeowKit" → "the toolkit"

Before: `MeowKit ships with sane defaults.`
After: `the toolkit ships with sane defaults.`

### "Claude Code" → "the host runtime" (generic claim)

Before: `Claude Code injects this content into the forked agent.`
After: `the host runtime injects this content into the forked agent.`

### "Claude Code" → factual prefix (runtime-specific claim)

Before: `Claude Code does NOT export $CLAUDE_MODEL to hooks.`
After: `On Claude Code, $CLAUDE_MODEL is not exported to hooks.`

### "per Anthropic's documented behavior" → runtime contract

Before: `Skill-directory state is wiped on plugin upgrade per Anthropic's documented behavior.`
After: `Skill-directory state is wiped on plugin upgrade per the runtime's plugin contract.`

### Research citation — preserve verbatim

Acceptable: `Per Anthropic's harness research, dead weight degrades capable models.`
Acceptable: `<!-- research-citation -->\nAnthropic's field report confirms the finding.`

## Running the lint locally

```bash
cd meowkit
bash .claude/scripts/lint-brand-prose.sh
```

Expected exit codes:

- `0` — clean tree
- `1` — violations found (path:line listed)
- `2` — misconfigured (script run from wrong directory or allowlist missing)

## Updating the allowlist

`meowkit/.claude/.brand-allowlist.txt` accepts one glob per line. Add a file only when it is genuinely toolkit-internal navigation (index headers, archived state, research-only references). Hard ceiling: 30 entries. Above that, the lint stops paying for itself — fix the source instead.

## Related

- `.claude/scripts/lint-brand-prose.sh` — the enforcement
- `.claude/scripts/check-anthropic-context.py` — Anthropic context-window helper
- `packages/mewkit/src/migrate/converters/md-strip.ts` — runtime substitution
- `packages/mewkit/src/migrate/converters/fm-strip.ts` — Codex/Kiro/Cursor merged-agents header

# ADR: mk:confluence Skill Ecosystem Architecture (Path B — confluence-as shellout)

**Date:** 2026-05-10
**Status:** Accepted
**Deciders:** ngocsangyem (user), Claude (agent)

## Context

MeowKit needs Confluence Cloud integration for spec analysis, page CRUD, and integration with the existing `mk:planning-engine` workflow. Two upstream open-source repos relate to this need:

- `Confluence-Assistant-Skills` — a skill bundle of 17 granular skills + a router + a setup command, each shelling out to a binary.
- `confluence-as` (shipped by the `confluence-assistant-skills` PyPI distribution) — the underlying CLI library + binary that talks to Confluence Cloud's REST API.

Three integration paths were considered (per `plans/reports/brainstorm-260510-1435-confluence-meowkit-feasibility.md`):

- **Path A:** install `Confluence-Assistant-Skills` upstream as-is into MeowKit's skill directory.
- **Path B:** install only the `confluence-as` CLI as a pinned PyPI dependency; ship MeowKit-native skills that shell out to it.
- **Path C:** full port — re-implement the Confluence client in MeowKit's idiom.

A prior plan (`plans/260413-0252-planning-engine-and-confluence/phase-01-create-confluence-skill.md`) chose `mcp-atlassian` as the backend — that plan's Phase 1 is superseded by this one (`mk:planning-engine` from the prior plan stays; reports-not-automation principle preserved).

## Decision

**Path B** — pin upstream packages (`confluence-assistant-skills` distribution + transitive `confluence-as` library + transitive `assistant-skills-lib`), shell out to the `confluence-as` binary, ship 6 MeowKit-native skills (1 hub + 5 leaves), with `mk:confluence-spec-analyst` as the value-creating differentiator.

## Alternatives Rejected

- **Path A (install upstream as-is):** inherits 17-skill bloat (~6,200 lines of always-loaded SKILL.md text), open-pin deps, and plaintext credential fallback risk. Token bloat alone disqualifies it.
- **Path C (full port):** violates YAGNI; throws away ~5K LoC of tested upstream code; bears the burden of tracking Atlassian API drift indefinitely.
- **mcp-atlassian backend (prior plan choice):** good MCP citizen but introduces a separate execution model from `mk:jira-*` (which uses `jira-as` shellout). This plan supersedes it for backend autonomy + parity with the proven `mk:jira-*` pattern.

## Consequences

### Pinning burden
We pin THREE upstream packages: `confluence-assistant-skills` (CLI), `confluence-as` (library), `assistant-skills-lib` (infra). Empirically verified install (260510) — the upstream READMEs that document the binary as `confluence` are wrong; the binary is actually `confluence-as` and ships from the `confluence-assistant-skills` PyPI distribution. If `confluence-as` upstream stalls past 2026-Q3, we vendor.

### Cloud-only constraint
Server / Data Center users use the MCP escape hatch. The wrapper rejects non-`*.atlassian.net` URLs with exit 3.

### 70% reduction in always-loaded context
17 upstream skills → 6 MeowKit skills. Hub ≤ 80 lines, each leaf ≤ 55 lines. References live one level deep, loaded on demand per `skill-authoring-rules.md` Rule 3.

### Reports-not-automation preserved
`mk:confluence-spec-analyst` produces a Spec Research Report; the human runs `mk:jira-issue create` manually. `--with-commands` is opt-in, not default. Aligns with the prior plan's principle.

### Security posture
- Token never enters the agent context. The wrapper exports env vars per call and refuses `.claude/settings.local.json` fallback.
- CQL sanitizer (`cql-sanitize.sh`) is mandatory at the agent boundary — `confluence-as` does not export `_escape_cql_string` (it lives as a private function in the search command module).
- All Tier-4 ops require the 3-step dry-run ceremony with a typed confirmation token.
- No leaf is 3/3 on Rule of Two (`injection-rules.md` Rule 11).

## Lessons captured

- **Verify empirically before trusting upstream READMEs.** Both upstream repo READMEs document the binary name as `confluence`. Direct `pip install` showed the binary is `confluence-as`; `pip show confluence-as` returns "not found"; the distribution package is `confluence-assistant-skills`. Document this as a Gotcha, and as a reminder to always verify CLI surfaces with a throwaway venv install.
- **Red-team agents can be wrong about empirical facts.** A first-pass adversarial review claimed `pip install confluence-as` was sufficient and the binary was `confluence-as` from that package. User challenge + direct verification (read upstream `pyproject.toml` files + run the install) revealed the truth. Trust empirical reality over agent confidence.
- **Skill collapsing is high-leverage.** Folding 17 upstream skills into 6 MeowKit leaves saved ~70% always-loaded context with no functional loss — most of the upstream split was over-fragmentation (separate skills for `confluence-comment` / `confluence-attachment` / `confluence-label` / `confluence-watch` collapse cleanly into one collaborate leaf).
- **The Spec-Analyst skill IS the differentiator.** Without it, Confluence integration would be "yet another CRUD wrapper". With it, Confluence becomes a first-class input to `mk:planning-engine` — the value chain from spec → plan → tickets is closed without auto-creation magic.

## See also

- Plan: `plans/260510-1458-mk-confluence-ecosystem/plan.md` (overview), `phase-01-architecture-decisions.md` (full Adopt/Adapt/Reject table)
- Brainstorm: `plans/reports/brainstorm-260510-1435-confluence-meowkit-feasibility.md` (Path A/B/C tradeoff analysis)
- Research: `plans/reports/researcher-260510-1458-confluence-assistant-skills-deep.md`, `researcher-260510-1500-mk-jira-and-planning-engine.md`, `researcher-260510-1549-confluence-as-deep.md`
- Red-team: `plans/reports/red-team-260510-1610-confluence-plan.md`, `validation-260510-1610-confluence-plan.md`
- Superseded: `plans/260413-0252-planning-engine-and-confluence/phase-01-create-confluence-skill.md` (Phase 1 only)

## Addendum 2026-05-10: macro-aware fetch path

### Context

The v1 spec-analyst (this ADR's original scope) fetched `--representation storage` (XHTML) and let the LLM reason directly. PM specs use heavy macros — panels, decisions, task lists, mentions, Figma embeds, expand sections — and these flatten or get lost in storage XHTML, undermining the value of spec-analyst's gap-detection heuristics.

The upstream `confluence-as` library exposes an `adf_to_markdown` helper (`adf_helper.py`), but research found it lossy on the same macro families: `panel = Absent`, `expand = Absent`, `mention`, `media`, `decision`, `task-list` all flatten or drop content. Wrapping the lossy library in a new skill would inherit the loss; the macro problem is in the library function itself, not the interface.

### Decision

Add a small macro-aware walker to the shared scripts directory:

- `confluence/scripts/adf_to_md.py` — table-driven Python walker (stdlib-only, ≤250 lines)
- `confluence/scripts/adf-to-md.sh` — bash shim (stdin OR `--page-id <N>` modes; numeric page-id guard; exit 4 on missing `body.atlas_doc_format.value`)

`mk:confluence-spec-analyst` switches its fetch path from `--representation storage` to `--representation atlas_doc_format` and pipes the body through `adf-to-md.sh`. The walker emits explicit ASCII labels (`> [INFO]`, `> [DECISION]`, `- [ ]`, `<details>`, `@name`, `![alt](attachment:<id>)`) so macro content becomes a first-class signal for downstream gap detection.

### Why not a 7th skill (`mk:confluence-convert`)

A skill wrapping the upstream lossy function inherits the loss. Re-implementing the walker fixes the actual problem with no skill ceremony — pure transform, no untrusted-input × sensitive-data × state-change collision (Rule of Two: 0/3). One bash shim and one Python file in the existing `scripts/` directory is the right size for the work.

### Consequences

- Coupling to the ADF JSON shape (Atlassian's stable spec) instead of `confluence-as` Python internals — lower version-pin risk
- Existing `mk:confluence-spec-analyst` invocation surface is unchanged: `analyze PAGE-ID [--include-children N] [--no-images] [--with-commands]`
- Single-call fetch pattern (metadata + body extracted from one ADF response) halves the API request count per page; children cap reduced from 10 to 5 to stay inside the 10 req/s Cloud rate limit
- Per-child failure handling differentiates ROOT (abort) from CHILD (`[INCOMPLETE: child <id>]` flag, continue)
- Reverse direction (md → adf) is deferred — no consumer in MeowKit currently calls `page update --representation atlas_doc_format --content-file <json>`. Add when a real consumer surfaces.
- Unknown ADF nodes emit `[UNHANDLED_NODE: <type>]` with **keys-only metadata** — no raw text/attr values — closing the prompt-injection vector through custom macros

### See also

- Walker source: `meowkit/.claude/skills/confluence/scripts/adf-to-md.sh` + `adf_to_md.py`
- Walker fixture: `meowkit/.claude/skills/confluence/scripts/tests/fixtures/adf-macros.json` + `adf-macros.expected.md`
- Spec-analyst agent (consumer): `meowkit/.claude/agents/confluence-spec-analyst.md`

# Agent-Contract Governance Research

## Task 1 — Brand Neutrality Enforcement

**Script:** `.claude/scripts/check-anthropic-context.py`. Forbids 3 patterns in `.claude/` markdown (narrative prose, not backtick-wrapped, not in frontmatter/fences):
- `MeowKit` token (line 33/108) — the toolkit's OWN name — "use 'the toolkit'"
- `Claude Code` / `claude-code` token (line 34/111) — provider-brand product name — "use 'the host runtime'"; exempted when prefixed `On Claude Code, ` (`FACTUAL_PREFIX` regex, line 39/106)
- `Anthropic` token (line 32/113) — provider name — flagged unless in a "citation context" (±2 lines contain `research`/`thesis`/`field report`, `<!-- research-citation -->` marker, or blockquote prefixed `> ... Anthropic`)

**Both** provider brand (Anthropic/Claude Code) AND the toolkit's own name (MeowKit) are forbidden in narrative prose — this is a dual-neutrality lint, not just anti-self-promotion.

**`.claude/.brand-allowlist.txt` does not exist on disk** (`test -f` → MISSING). `load_allowlist()` (check-anthropic-context.py:42-54) silently returns `[]` when the file is absent — the lint runs with zero allowlisting currently, not an error state.

**Lint result (ran read-only, no changes made):** `bash .claude/scripts/lint-brand-prose.sh` → **exit 1**, 40 pre-existing violations across `.claude/benchmarks/`, `.claude/harness-substrate.md`, `.claude/memory/dead-weight-registry.md`, `.claude/rubrics/*`, `.claude/skills/{context-engineering,figma,markdown-reader,mk-loop,prompt-enhancer,scout,stitch,tech-graph}/*`. **`.claude/agents/*.md` tree has ZERO violations** (grep confirms no `^.claude/agents/` lines in output) — the agent tree currently passes this lint cleanly. A new agent-contract plan must keep it that way.

**Model tier (`model: haiku|opus|fable|inherit`) is NOT covered by this lint** — `check-anthropic-context.py` has zero references to `model`/`haiku`/`opus`/`fable`. No dedicated script validates the `model:` frontmatter value either (searched `.claude/scripts/*.py`, `.claude/schemas/*.json`, `packages/mewkit/src/core/*.ts` — no hits). Model-tier correctness is governed only by prose convention in `.claude/rules/model-selection-rules.md` — unenforced mechanically. Observed values in `.claude/agents/*.md`: `opus` (architect), `fable` (advisor), `haiku` (analyst, documenter, git-manager, journal-writer, researcher, project-manager, shipper), `inherit` (developer).

## Task 2 — Agent Authoring Contract

**(a) Required frontmatter schema** — no JSON schema file exists for agents (only `.claude/schemas/skill-schema.json` and `harness-metadata-schema.json`; no `agent-schema.json`). Schema is prose-only, two sources:
- `docs/governance/meowkit-agent-rules.md:47`: "frontmatter with `name`, `description`, `model`, and `tools`" (minimum, for both core and skill-scoped agents)
- `docs/core/meowkit-rules.md:72`: same 4-field minimum for skill-scoped agents ("same format as `.claude/agents/*.md`")

Observed in practice (`.claude/agents/*.md`), agents carry more fields than the documented minimum: `name, description, tools, model` + commonly `owner, criticality, status, runtime`, sometimes `memory, subagent_type, source`. These extras are convention, not schema-required.

**(b) Canonical status-block rule ID + schema** — `.claude/rules/agent-conduct.md` **Tier A1 "Subagent Status Protocol"** (agent-conduct.md:13-33). Literal schema:
```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentence summary of what was accomplished]
**Concerns/Blockers:** [if applicable — omit if DONE with no concerns]
```
Verified: `grep -rln "this status block" .claude/agents/*.md` → **22 agent files** dangle this exact phrase (`.claude/agents/jira-issue.md:57`: "End every response with this status block:"), all Jira/Confluence domain-integration agents + `story-sizer.md`. None of the 22 cite `agent-conduct.md` A1 by path/ID inline — the phrase alone is the dangling reference the plan needs to resolve (link or inline the schema).

**(c) Model-selection authority vs frontmatter hardcoding** — `.claude/rules/model-selection-rules.md` Rule 1: "ALWAYS print the model tier assignment before starting any task: `Task complexity: [TRIVIAL|STANDARD|COMPLEX] → using [model tier]`" — the **orchestrator's runtime declaration is authoritative**, not a static frontmatter value. Rule 3: "Once a task is assigned a tier, NEVER downgrade to a cheaper tier mid-task." Rule 5 documents an auto-detection cascade for `mk:autobuild` specifically: "(1) stdin `model` field, (2) `MEOWKIT_MODEL_HINT` env var, (3) default STANDARD/FULL" — i.e. the SESSION's actual model (from Claude Code SessionStart stdin) is authoritative over any hardcoded hint. Frontmatter `model:` values (`opus`/`haiku`/`fable`/`inherit`) are a **per-agent default/override that Task-tool spawning honors when invoking that subagent** — but per Rule 2, security-sensitive tasks force COMPLEX regardless of the assigned agent's usual frontmatter tier, and Rule 4 (Domain Override) says CSV domain match with `level=high` forces COMPLEX "regardless of any other signal — including manual classification." Net: **frontmatter `model:` is a default, the routing rules (CSV/risk-checklist/security escalation) are authoritative and can override it upward; nothing downgrades it.**

**(d) Rule of Two / trust-boundary for state changes** — defined in `.claude/rules/injection-rules.md` **Rule 11 "Skill Rule of Two"** (injection-rules.md:89-102): a skill/agent MUST NOT satisfy all three simultaneously: **[A]** process untrusted input, **[B]** access sensitive data, **[C]** change state. 2-of-3 acceptable; 3-of-3 forbidden, "a known prompt-injection escalation pattern and must be redesigned." Local filesystem writes fall under **[C] change state**. This is the ONLY canonical definition in the repo (confirmed via grep — appears in `injection-rules.md` plus 6 `SKILL.md` files that reference it, no local filesystem-write-specific variant exists). Note the rule's own text says it was previously in CLAUDE.md and `skill-template-secure/SKILL.md`, now restored here as the always-loaded canonical location — any new agent-contract plan should cite `injection-rules.md` Rule 11 directly, not re-derive a new trust-boundary rule.

## Task 3 — Generation Pipeline

**Yes**, `plugin/agents/` is generated from `.claude/agents/` via `npx mewkit build-plugin` (source: `packages/mewkit/src/commands/build-plugin.ts:1-9` — "Produces... `plugin/` the transformed plugin payload... The flat-copy source under `.claude/` is never modified — this is a generated variant that namespaces agent refs, renames the one divergent skill dir, and translates hook wiring"). Invoked directly (`npx mewkit build-plugin`) or transitively via `scripts/prepare-release-assets.cjs:49` during release.

**Editing `plugin/` directly is forbidden**, cited verbatim: `RELEASING.md:23` — "**Two distributions, one source.** `.claude/` is the only source of truth... Never hand-edit `plugin/`, `.claude-plugin/`, or `.agents/` — they are regenerated." CI enforces drift detection: `RELEASING.md:515` — `.github/workflows/ci.yml` runs `mewkit validate --plugin` on every PR, fails closed on stale/malformed plugin output.

**Sync status:** Canonical `.claude/agents/` has 42 `.md` files, generated `plugin/agents/` has 40. The 2-file diff is `AGENTS_INDEX.md` and `SKILLS_INDEX.md` — both intentionally excluded by the builder's `pruneNonAgents()` step (`packages/mewkit/src/core/plugin-payload.ts:103`, `nonAgentsPruned` counter) since they're index docs, not agent definitions. All 40 real agent files match 1:1 by name. Spot-checked `developer.md`: byte-identical between canonical and generated (no internal agent-name refs needing namespace rewrite in that file). **Currently in sync** — no drift detected.

## Unresolved Questions

1. `docs/governance/meowkit-agent-rules.md:3` says operational rules live in `docs/meowkit-rules.md`, but the actual file is at `docs/core/meowkit-rules.md` — a stale path reference inside a governance doc. Also note: `docs/governance/` and `docs/core/` are NOT on the Type-1 allowlist in `.claude/rules/docs-reference-contract.md` (kit-internal-only paths) — confirm these two files are meant to stay kit-repo-only (not shipped) before the new plan references them.
2. No agent frontmatter JSON schema exists (unlike skills, which have `skill-schema.json` + `validate-skill-frontmatter.py`). If the new agent-contract plan intends to mechanically enforce the 4-field minimum + extras (owner/criticality/status/runtime), that validator does not exist yet — confirm whether creating one is in scope.
3. `.claude/.brand-allowlist.txt` is absent — confirm whether the new plan should create it (to legitimately allowlist toolkit-internal navigation files) or whether the 40 existing violations should instead be fixed at the source.

Status: DONE
